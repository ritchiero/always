/**
 * Context Builder - Knowledge Graph Context for Manus Actions
 * 
 * Builds a "Context Package" from the Knowledge Graph to enrich
 * Manus action prompts with entity details, relationships, and history.
 */
import * as admin from 'firebase-admin';

export interface ContextPackage {
    entities: EntityContext[];
    relationships: RelationshipContext[];
    recentDecisions: string[];
    corrections: string[];
}

interface EntityContext {
    name: string;
    type: string;
    description: string;
    properties: Record<string, any>;
    aliases: string[];
    mentionCount: number;
    lastMentioned: string;
}

interface RelationshipContext {
    source: string;
    target: string;
    type: string;
    context: string;
}

/**
 * Build a context package for an action by searching the Knowledge Graph
 * for entities mentioned in the action text.
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

      // 2. Find entities mentioned in the action text
      const actionLower = actionText.toLowerCase();
        const assigneeLower = assignee?.toLowerCase() || '';
        const matchedEntityIds: string[] = [];

      for (const entity of allEntities) {
              const entityData = entity as any;
              const nameLower = entityData.name?.toLowerCase() || '';
              const aliases = (entityData.aliases || []).map((a: string) => a.toLowerCase());

          // Check if entity name or aliases appear in the action text or assignee
          const textToSearch = actionLower + ' ' + assigneeLower;
              if (textToSearch.includes(nameLower) || aliases.some((a: string) => textToSearch.includes(a))) {
                        matchedEntityIds.push(entity.id);
                        const lastMentioned = entityData.lastMentioned?.toDate?.() || entityData.updatedAt?.toDate?.();
                        result.entities.push({
                                    name: entityData.name,
                                    type: entityData.type,
                                    description: entityData.properties?.description || '',
                                    properties: entityData.properties || {},
                                    aliases: entityData.aliases || [],
                                    mentionCount: entityData.mentionCount || 0,
                                    lastMentioned: lastMentioned ? lastMentioned.toISOString().split('T')[0] : 'unknown',
                        });
              }
      }

      if (matchedEntityIds.length === 0) return result;

      // 3. Fetch relationships between matched entities
      for (const entityId of matchedEntityIds) {
              const relsSnapshot = await userRef.collection('relationships')
                .where('sourceId', '==', entityId)
                .limit(20)
                .get();

          for (const relDoc of relsSnapshot.docs) {
                    const rel = relDoc.data();
                    result.relationships.push({
                                source: rel.sourceName || 'Unknown',
                                target: rel.targetName || 'Unknown',
                                type: rel.type || 'RELATED_TO',
                                context: rel.context || '',
                    });
          }

          const reverseRelsSnapshot = await userRef.collection('relationships')
                .where('targetId', '==', entityId)
                .limit(20)
                .get();

          for (const relDoc of reverseRelsSnapshot.docs) {
                    const rel = relDoc.data();
                    // Avoid duplicates
                const exists = result.relationships.some(
                            r => r.source === rel.sourceName && r.target === rel.targetName && r.type === rel.type
                          );
                    if (!exists) {
                                result.relationships.push({
                                              source: rel.sourceName || 'Unknown',
                                              target: rel.targetName || 'Unknown',
                                              type: rel.type || 'RELATED_TO',
                                              context: rel.context || '',
                                });
                    }
          }
      }

      // 4. Fetch recent decisions (entities of type 'decision')
      const decisions = allEntities.filter((e: any) => e.type === 'decision');
        for (const decision of decisions.slice(0, 5)) {
                const d = decision as any;
                const what = d.properties?.what || d.properties?.description || d.name;
                result.recentDecisions.push(what);
        }

      // 5. Load user corrections
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

  } catch (error) {
        console.error('[ContextBuilder] Error building context package:', error);
        // Return whatever we have so far - don't block the action
  }

  return result;
}

/**
 * Format a context package into a string for inclusion in a Manus prompt
 */
export function formatContextForPrompt(ctx: ContextPackage): string {
    if (ctx.entities.length === 0) return '';

  let contextStr = '\n\n--- KNOWLEDGE GRAPH CONTEXT ---\n';

  // Entities
  contextStr += '\nRelevant entities from previous conversations:\n';
    for (const entity of ctx.entities) {
          contextStr += `\n- ${entity.name} (${entity.type})`;
          if (entity.description) contextStr += `: ${entity.description}`;
          if (entity.properties.role) contextStr += ` | Role: ${entity.properties.role}`;
          if (entity.properties.company) contextStr += ` | Company: ${entity.properties.company}`;
          if (entity.properties.email) contextStr += ` | Email: ${entity.properties.email}`;
          if (entity.properties.budget) contextStr += ` | Budget: ${entity.properties.budget}`;
          if (entity.properties.deadline) contextStr += ` | Deadline: ${entity.properties.deadline}`;
          if (entity.properties.status) contextStr += ` | Status: ${entity.properties.status}`;
          if (entity.aliases.length > 0) contextStr += ` | Also known as: ${entity.aliases.join(', ')}`;
          contextStr += ` | Mentioned ${entity.mentionCount} times, last: ${entity.lastMentioned}`;
    }

  // Relationships
  if (ctx.relationships.length > 0) {
        contextStr += '\n\nRelationships:\n';
        for (const rel of ctx.relationships) {
                contextStr += `- ${rel.source} --[${rel.type}]--> ${rel.target}`;
                if (rel.context) contextStr += ` (${rel.context})`;
                contextStr += '\n';
        }
  }

  // Recent decisions
  if (ctx.recentDecisions.length > 0) {
        contextStr += '\nRecent decisions:\n';
        for (const decision of ctx.recentDecisions) {
                contextStr += `- ${decision}\n`;
        }
  }

  // Corrections
  if (ctx.corrections.length > 0) {
        contextStr += '\nIMPORTANT - Terminology corrections:\n';
        for (const correction of ctx.corrections) {
                contextStr += `- ${correction}\n`;
        }
  }

  contextStr += '\n--- END CONTEXT ---\n';
    return contextStr;
}
