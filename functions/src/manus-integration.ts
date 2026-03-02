import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { buildContextPackage, formatContextForPrompt } from './context-builder';

// Encryption key for Manus API keys (from env or Firebase config)
const ENCRYPTION_KEY = process.env.MANUS_ENCRYPTION_KEY || 'always-manus-default-key-32ch';
const IV_LENGTH = 16;

// =========================================
// ENCRYPTION HELPERS
// =========================================

export function encryptApiKey(apiKey: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedKey: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// =========================================
// USER MANUS SETTINGS
// =========================================

interface ManusUserSettings {
  apiKeyEncrypted: string;
  isActive: boolean;
  connectedAt: admin.firestore.Timestamp;
  lastUsedAt?: admin.firestore.Timestamp;
  agentProfile?: string;
}

export async function getUserManusSettings(
  userId: string
): Promise<ManusUserSettings | null> {
  const db = admin.firestore();
  const doc = await db
    .collection('users').doc(userId)
    .collection('integrations').doc('manus')
    .get();

  if (!doc.exists) return null;
  return doc.data() as ManusUserSettings;
}

export async function getUserManusApiKey(userId: string): Promise<string | null> {
  const settings = await getUserManusSettings(userId);
  if (!settings || !settings.isActive || !settings.apiKeyEncrypted) return null;

  try {
    return decryptApiKey(settings.apiKeyEncrypted);
  } catch (error) {
    console.error('Error decrypting Manus API key for user:', userId, error);
    return null;
  }
}

// =========================================
// MANUS API CLIENT
// =========================================

const MANUS_API_BASE = 'https://api.manus.ai/v1';

interface ManusCreateTaskRequest {
  prompt: string;
  agentProfile?: string;
  taskMode?: 'chat' | 'adaptive' | 'agent';
  connectors?: string[];
  hideInTaskList?: boolean;
  taskId?: string; // for multi-turn
}

interface ManusTaskResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url: string;
}

interface ManusTaskStatus {
  task_id: string;
  status: string;
  output?: string;
  task_url?: string;
}

export async function createManusTask(
  apiKey: string,
  request: ManusCreateTaskRequest
): Promise<ManusTaskResponse> {
  const response = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'API_KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      agentProfile: request.agentProfile || 'manus-1.6',
      taskMode: request.taskMode || 'agent',
      connectors: request.connectors,
      hideInTaskList: request.hideInTaskList,
      taskId: request.taskId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manus API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ManusTaskResponse>;
}

export async function getManusTaskStatus(
  apiKey: string,
  taskId: string
): Promise<ManusTaskStatus> {
  const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'API_KEY': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manus API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ManusTaskStatus>;
}

// =========================================
// PROMPT BUILDER
// =========================================

export function buildManusPrompt(action: {
  task: string;
  suggestedAction: string;
  targetService: string;
  context: string;
  assignee?: string;
  deadline?: string;
}): string {
  let prompt = `You are executing a task for the user based on information captured from their real conversations and meetings. The user's Knowledge Graph has been consulted to provide you with rich context about the people, projects, and topics involved.

TASK TO EXECUTE:
${action.task}
`;

  if (action.suggestedAction) {
    prompt += `\nSUGGESTED APPROACH: ${action.suggestedAction}\n`;
  }

  if (action.targetService && action.targetService !== 'other') {
    prompt += `\nTARGET SERVICE: ${action.targetService}\n`;
  }

  if (action.context) {
    prompt += `\nORIGINAL CONTEXT (from the conversation where this task was identified):\n${action.context}\n`;
  }

  if (action.assignee) {
    prompt += `\nRESPONSIBLE PERSON: ${action.assignee}\n`;
  }

  if (action.deadline) {
    prompt += `\nDEADLINE: ${action.deadline}\n`;
  }

  prompt += `
INSTRUCTIONS:
- Use the Knowledge Graph context below to make your execution precise and informed
- Reference specific details from the context (names, projects, decisions) in your output
- If writing an email or message, use the correct names and terminology from the corrections list
- Consider pending actions and recent decisions to avoid conflicts or redundancy
- If you need clarification on something not covered by the context, ask before proceeding
- Respond in the same language the user uses in their conversations (likely Spanish)
`;

  return prompt;
}
// =========================================
// EXECUTE ACTION WITH MANUS
// =========================================

export async function executeActionWithManus(
  userId: string,
  actionId: string,
  action: {
    task: string;
    suggestedAction: string;
    targetService: string;
    context: string;
    assignee?: string;
    deadline?: string;
  }
): Promise<{ taskId: string; taskUrl: string }> {
  const db = admin.firestore();

  // Get user's Manus API key
  const apiKey = await getUserManusApiKey(userId);
  if (!apiKey) {
    throw new Error('Manus API key not configured. Go to Profile > Integrations to add your key.');
  }

  // Build the base prompt
  const basePrompt = buildManusPrompt(action);

  // Enrich prompt with Knowledge Graph context
  // Use a comprehensive search text that includes all action details
  let enrichedPrompt = basePrompt;
  try {
    const searchParts = [
      action.task,
      action.context || '',
      action.assignee || '',
      action.suggestedAction || '',
    ].filter(Boolean);
    const searchText = searchParts.join(' ');

    const contextPackage = await buildContextPackage(userId, searchText, action.assignee);
    const kgContext = formatContextForPrompt(contextPackage);

    if (kgContext) {
      enrichedPrompt = basePrompt + '\n' + kgContext;
      console.log(`[Manus] Context enriched: ${contextPackage.entities.length} entities, ${contextPackage.relationships.length} relationships, ${contextPackage.conversationHistory.length} conversations`);
    } else {
      console.log('[Manus] No KG context found, using base prompt');
    }
  } catch (kgError) {
    console.warn('[Manus] KG context enrichment failed, using base prompt:', kgError);
  }

  // Create the task in Manus
  const manusResponse = await createManusTask(apiKey, {
    prompt: enrichedPrompt,
    taskMode: 'agent',
    agentProfile: 'manus-1.6',
  });

  // Update the action document with Manus info
  await db
    .collection('users').doc(userId)
    .collection('actions').doc(actionId)
    .update({
      manusTaskId: manusResponse.task_id,
      manusTaskUrl: manusResponse.task_url,
      manusStatus: 'submitted',
      manusPromptLength: enrichedPrompt.length,
      status: 'in_progress',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Update last used timestamp for Manus integration
  await db
    .collection('users').doc(userId)
    .collection('integrations').doc('manus')
    .update({
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`[Manus] Task created: ${manusResponse.task_id} for action ${actionId} (prompt: ${enrichedPrompt.length} chars)`);

  return {
    taskId: manusResponse.task_id,
    taskUrl: manusResponse.task_url,
  };
}
// =========================================
// WEBHOOK HANDLER
// =========================================

export async function handleManusWebhook(payload: {
  task_id: string;
  status: string;
  output?: string;
}): Promise<void> {
  const db = admin.firestore();

  // Find the action document with this manusTaskId
  // We need to search across all users
  const usersSnapshot = await db.collectionGroup('actions')
    .where('manusTaskId', '==', payload.task_id)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.warn(`No action found for Manus task: ${payload.task_id}`);
    return;
  }

  const actionDoc = usersSnapshot.docs[0];

  const updateData: Record<string, any> = {
    manusStatus: payload.status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (payload.output) {
    updateData.manusOutput = payload.output;
  }

  // Map Manus status to our action status
  if (payload.status === 'completed') {
    updateData.status = 'completed';
    updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (payload.status === 'failed') {
    updateData.status = 'pending'; // Revert so user can retry
    updateData.manusError = payload.output || 'Task failed';
  }

  await actionDoc.ref.update(updateData);
  console.log(`Manus webhook processed: task ${payload.task_id} -> ${payload.status}`);
}
