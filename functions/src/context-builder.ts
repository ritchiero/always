/**
 * Context Builder - Knowledge Graph Context for Manus Actions
 *
 * Builds a rich "Context Package" from the Knowledge Graph to enrich
 * Manus action prompts with entity details, relationships, conversation
 * history, temporal context, and graph traversal (2-level deep).
 *
 * Inspired by Obsidian's backlink system: every entity knows what it's
 * connected to, what was said about it recently, and how it relates
 * to the current action.
 */
import * as admin from 'firebase-admin';

export interface ContextPackage {
    entities: EntityContext[];
    relationships: RelationshipContext[];
    recentDecisions: string[];
    corrections: string[];
    conversationHistory: ConversationSnippet[];
    temporalContext: TemporalContext;
}

interface EntityContext {
    name: string;
    type: string;
    description: string;
    properties: Record<string, any>;
    aliases: string[];
    mentionCount: number;
    lastMentioned: string;
    depth: number; // 0 = direct match, 1 = connected, 2 = second-degree
}

interface RelationshipContext {
    source: string;
    target: string;
    type: string;
    context: string;
    strength: number;
}

interface ConversationSnippet {
    date: string;
    title: string;
    summary: string;
    relevantEntities: string[];
}

interface TemporalContext {
    recentTopics: string[];
    activeProjects: string[];
    frequentContacts: string[];
    pendingActions: string[];
}

/**
 * Build a context package for an action by searching the Knowledge Graph
 * with 2-level graph traversal, temporal awareness, and conversation history.
 */
export async function buildContextPackage(
    userId: string,
    actionText: string,
    assignee?: string
): Promise<ContextPackage> {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    const result: ContextPackage = {
        entities: [],
        relationships: [],
        recentDecisions: [],
        corrections: [],
        conversationHistory: [],
        temporalContext: {
            recentTopics: [],
            activeProjects: [],
            frequentContacts: [],
            pendingActions: [],
        },
    };

    try {
        // 1. Load all entities for this user
        const entitiesSnapshot = await userRef.collection('entities')
            .orderBy('mentionCount', 'desc')
            .limit(200)
            .get();

        if (entitiesSnapshot.empty) return result;

        const allEntities = entitiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // 2. Find directly mentioned entities (depth 0)
        const actionLower = actionText.toLowerCase();
        const assigneeLower = assignee?.toLowerCase() || '';
        const textToSearch = actionLower + ' ' + assigneeLower;

        const matchedEntityIds = new Set<string>();
        const entityIdMap = new Map<string, any>(); // id -> entity data

        for (const entity of allEntities) {
            entityIdMap.set(entity.id, entity);
        }

        // Direct name/alias matching
        for (const entity of allEntities) {
            const entityData = entity as any;
            const nameLower = entityData.name?.toLowerCase() || '';
            const aliases = (entityData.aliases || []).map((a: string) => a.toLowerCase());

            if (textToSearch.includes(nameLower) ||
                aliases.some((a: string) => textToSearch.includes(a))) {
                matchedEntityIds.add(entity.id);
                addEntityToResult(result, entityData, 0);
            }
        }

        // 3. Load ALL relationships for graph traversal
        const relsSnapshot = await userRef.collection('relationships').get();
        const allRelationships = relsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as any[];

        // Build adjacency map for graph traversal
        const adjacency = new Map<string, Array<{ entityId: string; rel: any }>>();
        for (const rel of allRelationships) {
            const sourceId = rel.sourceId || rel.sourceEntityId || '';
            const targetId = rel.targetId || rel.targetEntityId || '';

            if (!adjacency.has(sourceId)) adjacency.set(sourceId, []);
            if (!adjacency.has(targetId)) adjacency.set(targetId, []);

            adjacency.get(sourceId)!.push({ entityId: targetId, rel });
            adjacency.get(targetId)!.push({ entityId: sourceId, rel });
        }

        // 4. First-degree connections (depth 1)
        const firstDegreeIds = new Set<string>();
        for (const entityId of matchedEntityIds) {
            const neighbors = adjacency.get(entityId) || [];
            for (const { entityId: neighborId, rel } of neighbors) {
                if (!matchedEntityIds.has(neighborId)) {
                    firstDegreeIds.add(neighborId);
                    const neighborData = entityIdMap.get(neighborId);
                    if (neighborData) {
                        addEntityToResult(result, neighborData, 1);
                    }
                }
                // Add relationship to context
                addRelationshipToResult(result, rel);
            }
        }

        // 5. Second-degree connections (depth 2) - only for high-value nodes
        const secondDegreeIds = new Set<string>();
        for (const entityId of firstDegreeIds) {
            const neighbors = adjacency.get(entityId) || [];
            for (const { entityId: neighborId, rel } of neighbors) {
                if (!matchedEntityIds.has(neighborId) &&
                    !firstDegreeIds.has(neighborId) &&
                    !secondDegreeIds.has(neighborId)) {
                    const neighborData = entityIdMap.get(neighborId) as any;
                    // Only include high-value second-degree nodes
                    if (neighborData && (neighborData.mentionCount || 0) >= 3) {
                        secondDegreeIds.add(neighborId);
                        addEntityToResult(result, neighborData, 2);
                    }
                }
                // Add relationship between first and second degree
                if (firstDegreeIds.has(entityId)) {
                    addRelationshipToResult(result, rel);
                }
            }
        }

        // 6. Add relationships between all matched entities (internal connections)
        const allMatchedIds = new Set([...matchedEntityIds, ...firstDegreeIds]);
        for (const rel of allRelationships) {
            const sourceId = rel.sourceId || rel.sourceEntityId || '';
            const targetId = rel.targetId || rel.targetEntityId || '';
            if (allMatchedIds.has(sourceId) && allMatchedIds.has(targetId)) {
                addRelationshipToResult(result, rel);
            }
        }

        // 7. Recent conversation history (temporal context)
        await addConversationHistory(userRef, result, allMatchedIds, entityIdMap);

        // 8. Temporal context: recent topics, active projects, frequent contacts
        await addTemporalContext(userRef, result, allEntities);

        // 9. Recent decisions
        const decisions = allEntities.filter((e: any) => e.type === 'decision');
        for (const decision of decisions.slice(0, 8)) {
            const d = decision as any;
            const what = d.properties?.what || d.properties?.description || d.name;
            const when = d.lastMentioned?.toDate?.()?.toISOString()?.split('T')[0] || '';
            result.recentDecisions.push(when ? `[${when}] ${what}` : what);
        }

        // 10. Load user corrections
        const correctionsSnapshot = await userRef.collection('corrections')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        for (const corrDoc of correctionsSnapshot.docs) {
            const corr = corrDoc.data();
            if (corr.oldValue && corr.newValue) {
                result.corrections.push(`"${corr.oldValue}" should be "${corr.newValue}"`);
            } else if (corr.original && corr.corrected) {
                result.corrections.push(`"${corr.original}" should be "${corr.corrected}"`);
            }
        }

        // 11. Pending actions for temporal awareness
        await addPendingActions(userRef, result);

    } catch (error) {
        console.error('[ContextBuilder] Error building context package:', error);
    }

    return result;
}

// ===== HELPER FUNCTIONS =====

function addEntityToResult(result: ContextPackage, entityData: any, depth: number) {
    // Avoid duplicates
    if (result.entities.some(e => e.name === entityData.name)) return;

    const lastMentioned = entityData.lastMentioned?.toDate?.() ||
        entityData.updatedAt?.toDate?.();

    result.entities.push({
        name: entityData.name,
        type: entityData.type,
        description: entityData.properties?.description || '',
        properties: entityData.properties || {},
        aliases: entityData.aliases || [],
        mentionCount: entityData.mentionCount || 0,
        lastMentioned: lastMentioned
            ? lastMentioned.toISOString().split('T')[0]
            : 'unknown',
        depth,
    });
}

function addRelationshipToResult(result: ContextPackage, rel: any) {
    const source = rel.sourceName || 'Unknown';
    const target = rel.targetName || 'Unknown';
    const type = rel.type || 'RELATED_TO';

    // Avoid duplicates
    const exists = result.relationships.some(
        r => r.source === source && r.target === target && r.type === type
    );
    if (exists) return;

    result.relationships.push({
        source,
        target,
        type,
        context: rel.context || '',
        strength: rel.strength || 1,
    });
}

/**
 * Add recent conversation snippets involving the matched entities.
 * This gives Manus temporal awareness of what was discussed recently.
 */
async function addConversationHistory(
    userRef: admin.firestore.DocumentReference,
    result: ContextPackage,
    matchedEntityIds: Set<string>,
    entityIdMap: Map<string, any>
) {
    if (matchedEntityIds.size === 0) return;

    try {
        // Get recent recordings that mention these entities via entity_mentions
        const entityIds = Array.from(matchedEntityIds).slice(0, 10);
        const recentRecordingIds = new Set<string>();

        for (const entityId of entityIds) {
            const mentionsSnapshot = await userRef.collection('entity_mentions')
                .where('entityId', '==', entityId)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            for (const doc of mentionsSnapshot.docs) {
                recentRecordingIds.add(doc.data().recordingId);
            }
        }

        // Fetch recording summaries
        const recordingIds = Array.from(recentRecordingIds).slice(0, 10);
        for (const recId of recordingIds) {
            try {
                const recDoc = await userRef.collection('recordings').doc(recId).get();
                if (!recDoc.exists) continue;
                const recData = recDoc.data()!;

                const summary = recData.analysis?.summary || recData.summary || '';
                const title = recData.title || 'Untitled';
                const createdAt = recData.createdAt?.toDate?.();
                const date = createdAt
                    ? createdAt.toISOString().split('T')[0]
                    : 'unknown';

                // Find which of our matched entities appear in this recording
                const relevantEntities: string[] = [];
                const participants = recData.analysis?.participants || [];
                const topics = recData.analysis?.topics || [];

                for (const entityId of matchedEntityIds) {
                    const entity = entityIdMap.get(entityId) as any;
                    if (!entity) continue;
                    const name = entity.name?.toLowerCase() || '';
                    if (participants.some((p: string) => p.toLowerCase().includes(name)) ||
                        topics.some((t: string) => t.toLowerCase().includes(name)) ||
                        summary.toLowerCase().includes(name)) {
                        relevantEntities.push(entity.name);
                    }
                }

                if (summary) {
                    result.conversationHistory.push({
                        date,
                        title,
                        summary: summary.substring(0, 200),
                        relevantEntities,
                    });
                }
            } catch {
                // Skip individual recording errors
            }
        }

        // Sort by date descending
        result.conversationHistory.sort((a, b) => b.date.localeCompare(a.date));
        // Keep only the most recent 8
        result.conversationHistory = result.conversationHistory.slice(0, 8);

    } catch (error) {
        console.warn('[ContextBuilder] Error fetching conversation history:', error);
    }
}

/**
 * Add temporal context: what's been active recently, who's been mentioned most,
 * what projects are in progress.
 */
async function addTemporalContext(
    userRef: admin.firestore.DocumentReference,
    result: ContextPackage,
    allEntities: any[]
) {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Recent topics: entities with type topic/decision mentioned in last 30 days
        const recentTopicEntities = allEntities
            .filter((e: any) => {
                const lastMentioned = e.lastMentioned?.toDate?.();
                return (e.type === 'topic' || e.type === 'decision') &&
                    lastMentioned && lastMentioned > thirtyDaysAgo;
            })
            .sort((a: any, b: any) => (b.mentionCount || 0) - (a.mentionCount || 0))
            .slice(0, 8);

        result.temporalContext.recentTopics = recentTopicEntities.map(
            (e: any) => e.name
        );

        // Active projects: entities with type project mentioned recently
        const activeProjects = allEntities
            .filter((e: any) => {
                const lastMentioned = e.lastMentioned?.toDate?.();
                return (e.type === 'project' || e.type === 'product') &&
                    lastMentioned && lastMentioned > thirtyDaysAgo;
            })
            .sort((a: any, b: any) => (b.mentionCount || 0) - (a.mentionCount || 0))
            .slice(0, 5);

        result.temporalContext.activeProjects = activeProjects.map(
            (e: any) => {
                const status = e.properties?.status;
                return status ? `${e.name} (${status})` : e.name;
            }
        );

        // Frequent contacts: people mentioned most in last 30 days
        const frequentPeople = allEntities
            .filter((e: any) => {
                const lastMentioned = e.lastMentioned?.toDate?.();
                return e.type === 'person' &&
                    lastMentioned && lastMentioned > thirtyDaysAgo;
            })
            .sort((a: any, b: any) => (b.mentionCount || 0) - (a.mentionCount || 0))
            .slice(0, 8);

        result.temporalContext.frequentContacts = frequentPeople.map(
            (e: any) => {
                const role = e.properties?.role;
                const company = e.properties?.company;
                let label = e.name;
                if (role) label += ` (${role})`;
                if (company) label += ` @ ${company}`;
                return label;
            }
        );

    } catch (error) {
        console.warn('[ContextBuilder] Error building temporal context:', error);
    }
}

/**
 * Add pending actions that haven't been completed yet.
 * This gives Manus awareness of what's still on the user's plate.
 */
async function addPendingActions(
    userRef: admin.firestore.DocumentReference,
    result: ContextPackage
) {
    try {
        const actionsSnapshot = await userRef.collection('actions')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        for (const doc of actionsSnapshot.docs) {
            const action = doc.data();
            const task = action.task || '';
            const assignee = action.assignee || '';
            const deadline = action.deadline || '';

            let label = task;
            if (assignee) label += ` [assignee: ${assignee}]`;
            if (deadline) label += ` [deadline: ${deadline}]`;

            result.temporalContext.pendingActions.push(label);
        }
    } catch (error) {
        console.warn('[ContextBuilder] Error fetching pending actions:', error);
    }
}

/**
 * Format a context package into a structured string for inclusion in a Manus prompt.
 * Organized by relevance: direct entities first, then connections, then history.
 */
export function formatContextForPrompt(ctx: ContextPackage): string {
    if (ctx.entities.length === 0 && ctx.conversationHistory.length === 0 &&
        ctx.temporalContext.pendingActions.length === 0) {
        return '';
    }

    let s = '\n\n--- KNOWLEDGE GRAPH CONTEXT ---\n';

    // === Direct entities (depth 0) ===
    const directEntities = ctx.entities.filter(e => e.depth === 0);
    if (directEntities.length > 0) {
        s += '\nDirectly relevant entities:\n';
        for (const entity of directEntities) {
            s += formatEntity(entity);
        }
    }

    // === Relationships ===
    if (ctx.relationships.length > 0) {
        s += '\nRelationships:\n';
        // Sort by strength descending
        const sorted = [...ctx.relationships].sort((a, b) => (b.strength || 1) - (a.strength || 1));
        for (const rel of sorted) {
            s += `- ${rel.source} --[${rel.type}]--> ${rel.target}`;
            if (rel.context) s += ` (${rel.context})`;
            if (rel.strength > 1) s += ` [strength: ${rel.strength}]`;
            s += '\n';
        }
    }

    // === Connected entities (depth 1) ===
    const connectedEntities = ctx.entities.filter(e => e.depth === 1);
    if (connectedEntities.length > 0) {
        s += '\nConnected entities (1 degree):\n';
        for (const entity of connectedEntities) {
            s += formatEntity(entity);
        }
    }

    // === Second-degree entities (depth 2) - brief ===
    const secondDegree = ctx.entities.filter(e => e.depth === 2);
    if (secondDegree.length > 0) {
        s += '\nBroader context (2 degrees):\n';
        for (const entity of secondDegree) {
            s += `- ${entity.name} (${entity.type}, ${entity.mentionCount} mentions)\n`;
        }
    }

    // === Recent conversation history ===
    if (ctx.conversationHistory.length > 0) {
        s += '\nRecent relevant conversations:\n';
        for (const conv of ctx.conversationHistory) {
            s += `- [${conv.date}] "${conv.title}": ${conv.summary}`;
            if (conv.relevantEntities.length > 0) {
                s += ` (involving: ${conv.relevantEntities.join(', ')})`;
            }
            s += '\n';
        }
    }

    // === Temporal context ===
    const tc = ctx.temporalContext;
    if (tc.activeProjects.length > 0) {
        s += `\nActive projects: ${tc.activeProjects.join(', ')}\n`;
    }
    if (tc.frequentContacts.length > 0) {
        s += `\nFrequent contacts: ${tc.frequentContacts.join(', ')}\n`;
    }
    if (tc.recentTopics.length > 0) {
        s += `\nRecent discussion topics: ${tc.recentTopics.join(', ')}\n`;
    }

    // === Pending actions ===
    if (tc.pendingActions.length > 0) {
        s += '\nPending actions (not yet completed):\n';
        for (const action of tc.pendingActions) {
            s += `- ${action}\n`;
        }
    }

    // === Recent decisions ===
    if (ctx.recentDecisions.length > 0) {
        s += '\nRecent decisions:\n';
        for (const decision of ctx.recentDecisions) {
            s += `- ${decision}\n`;
        }
    }

    // === Corrections ===
    if (ctx.corrections.length > 0) {
        s += '\nIMPORTANT - Terminology corrections (always apply):\n';
        for (const correction of ctx.corrections) {
            s += `- ${correction}\n`;
        }
    }

    s += '\n--- END CONTEXT ---\n';
    return s;
}

/**
 * Format a single entity with its properties for the prompt.
 */
function formatEntity(entity: EntityContext): string {
    let s = `\n- ${entity.name} (${entity.type})`;
    if (entity.description) s += `: ${entity.description}`;

    const props = entity.properties;
    if (props.role) s += ` | Role: ${props.role}`;
    if (props.company) s += ` | Company: ${props.company}`;
    if (props.industry) s += ` | Industry: ${props.industry}`;
    if (props.email) s += ` | Email: ${props.email}`;
    if (props.budget) s += ` | Budget: ${props.budget}`;
    if (props.deadline) s += ` | Deadline: ${props.deadline}`;
    if (props.status) s += ` | Status: ${props.status}`;
    if (props.what) s += ` | Decision: ${props.what}`;
    if (props.sentiment) s += ` | Sentiment: ${props.sentiment}`;

    if (entity.aliases.length > 0) {
        s += ` | Also known as: ${entity.aliases.join(', ')}`;
    }
    s += ` | Mentioned ${entity.mentionCount} times, last: ${entity.lastMentioned}`;
    s += '\n';
    return s;
}
