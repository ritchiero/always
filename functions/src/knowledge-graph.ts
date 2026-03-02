/**
 * Knowledge Graph - Entity Extraction & Graph Management
 * 
 * This module extracts entities (people, companies, projects, topics, decisions)
 * from processed recordings and builds an interconnected knowledge graph,
 * inspired by Obsidian's linking system.
 * 
 * Triggered after a recording is processed (status: 'processed').
 */

import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Lazy OpenAI init
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!openaiClient) {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
          openaiClient = new OpenAI({ apiKey: apiKey.trim() });
    }
    return openaiClient;
}

function getDb() {
    return admin.firestore();
}

// ===== TYPES =====

interface ExtractedEntity {
    type: 'person' | 'company' | 'project' | 'topic' | 'decision';
    name: string;
    aliases: string[];
    properties: Record<string, any>;
    confidence: number;
}

interface ExtractedRelationship {
    sourceEntity: string; // name
  targetEntity: string; // name
  type: string;
    context: string;
}

interface ExtractionResult {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
    corrections: { original: string; corrected: string; type: string }[];
}

// ===== ENTITY EXTRACTION =====

/**
 * Extract entities from a transcript using OpenAI
 */
async function extractEntities(
    transcript: string,
    existingEntities: any[],
    userCorrections: any[]
  ): Promise<ExtractionResult> {
    const existingContext = existingEntities.length > 0
      ? `\n\nENTIDADES YA CONOCIDAS del usuario (usa estos nombres exactos si coinciden):\n${existingEntities.map(e => `- ${e.type}: "${e.name}" (aliases: ${(e.aliases || []).join(', ')})`).join('\n')}`
          : '';

  const correctionsContext = userCorrections.length > 0
      ? `\n\nCORRECCIONES PREVIAS del usuario (aplica siempre):\n${userCorrections.map(c => `- "${c.oldValue}" debe ser "${c.newValue}"`).join('\n')}`
        : '';

  const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
                    role: 'system',
                    content: `Eres un extractor de entidades de conversaciones. Analiza transcripciones y extrae personas, empresas, proyectos, temas y decisiones mencionados. 

                    REGLAS:
                    - Extrae SOLO entidades que realmente se mencionan en la conversacion
                    - Si una persona se menciona solo por nombre ("Maria"), registrala asi
                    - Si detectas que un nombre podria ser una variante de una entidad existente, usa el nombre existente
                    - Las decisiones son acuerdos concretos tomados durante la conversacion
                    - Los temas son conceptos recurrentes o areas de discusion
                    - Confidence de 0 a 1 segun que tan claro es que la entidad existe
                    - Aplica SIEMPRE las correcciones previas del usuario

                    Responde SOLO con JSON valido.`
          },
          {
                    role: 'user',
                    content: `Analiza esta transcripcion y extrae entidades:${existingContext}${correctionsContext}

                    TRANSCRIPCION:
                    "${transcript}"

                    Responde con este JSON:
                    {
                      "entities": [
                          {
                                "type": "person|company|project|topic|decision",
                                      "name": "nombre exacto",
                                            "aliases": ["variantes del nombre mencionadas"],
                                                  "properties": {
                                                          "role": "si es persona, su rol detectado",
                                                                  "company": "si es persona, empresa a la que pertenece",
                                                                          "industry": "si es empresa, industria",
                                                                                  "status": "si es proyecto, estado detectado",
                                                                                          "budget": "si se menciona monto",
                                                                                                  "deadline": "si se menciona fecha",
                                                                                                          "description": "descripcion breve",
                                                                                                                  "what": "si es decision, que se decidio",
                                                                                                                          "sentiment": "positive|neutral|negative"
                                                                                                                                },
                                                                                                                                      "confidence": 0.9
                                                                                                                                          }
                                                                                                                                            ],
                                                                                                                                              "relationships": [
                                                                                                                                                  {
                                                                                                                                                        "sourceEntity": "nombre entidad origen",
                                                                                                                                                              "targetEntity": "nombre entidad destino",
                                                                                                                                                                    "type": "WORKS_AT|MANAGES|PARTICIPATES_IN|DECIDED|RELATED_TO|REPORTS_TO",
                                                                                                                                                                          "context": "por que estan relacionados"
                                                                                                                                                                              }
                                                                                                                                                                                ],
                                                                                                                                                                                  "corrections": [
                                                                                                                                                                                      {
                                                                                                                                                                                            "original": "como se dijo en la transcripcion",
                                                                                                                                                                                                  "corrected": "como deberia escribirse",
                                                                                                                                                                                                        "type": "spelling|name|company"
                                                                                                                                                                                                            }
                                                                                                                                                                                                              ]
                                                                                                                                                                                                              }`
          }
              ],
        temperature: 0.2,
        max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();

  try {
        return JSON.parse(cleanJson);
  } catch {
        console.error('[KnowledgeGraph] Failed to parse extraction result:', cleanJson.substring(0, 200));
        return { entities: [], relationships: [], corrections: [] };
  }
}

// ===== ENTITY RESOLUTION =====

/**
 * Match extracted entities with existing ones in the database
 */
async function resolveEntities(
    userId: string,
    extracted: ExtractedEntity[],
    existingEntities: any[]
  ): Promise<{ matched: Map<string, string>; newEntities: ExtractedEntity[] }> {
    const matched = new Map<string, string>(); // extractedName -> existingEntityId
  const newEntities: ExtractedEntity[] = [];

  for (const entity of extracted) {
        let found = false;
        const nameLower = entity.name.toLowerCase();
        const aliasesLower =(entity.aliases || []).map(a => a.toLowerCase());

      for (const existing of existingEntities) {
              const existingNameLower = existing.name.toLowerCase();
              const existingAliasesLower = (existing.aliases || []).map((a: string) => a.toLowerCase());

          // Check exact name match
          if (nameLower === existingNameLower) {
                    matched.set(entity.name, existing.id);
                    found = true;
                    break;
          }

          // Check if extracted name matches any existing alias
          if (existingAliasesLower.includes(nameLower)) {
                    matched.set(entity.name, existing.id);
                    found = true;
                    break;
          }

          // Check if any extracted alias matches existing name or aliases
          for (const alias of aliasesLower) {
                    if (alias === existingNameLower || existingAliasesLower.includes(alias)) {
                                matched.set(entity.name, existing.id);
                                found = true;
                                break;
                    }
          }
              if (found) break;

          // Fuzzy match: check if one name contains the other (for partial names)
          if (entity.type === existing.type) {
                    if (existingNameLower.includes(nameLower) || nameLower.includes(existingNameLower)) {
                                if (nameLower.length > 2 && existingNameLower.length > 2) { // Avoid matching very short strings
                                  matched.set(entity.name, existing.id);
                                              found = true;
                                              break;
                                }
                    }
          }
      }

      if (!found) {
              newEntities.push(entity);
      }
  }

  return { matched, newEntities };
}

// ===== GRAPH UPDATE =====

/**
 * Update the knowledge graph in Firestore
 */
async function updateGraph(
    userId: string,
    recordingId: string,
    extraction: ExtractionResult,
    matched: Map<string, string>,
    newEntities: ExtractedEntity[]
  ): Promise<{ entitiesCreated: number; entitiesUpdated: number; relationshipsCreated: number }> {
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const entitiesRef = userRef.collection('entities');
    const relationshipsRef = userRef.collection('relationships');
    const mentionsRef = userRef.collection('entity_mentions');
    const now = admin.firestore.FieldValue.serverTimestamp();

  let entitiesCreated = 0;
    let entitiesUpdated = 0;
    let relationshipsCreated = 0;

  // Map of entity name -> entity ID (for relationship creation)
  const entityIdMap = new Map<string, string>(matched);

  // 1. Create new entities
  for (const entity of newEntities) {
        const docRef = await entitiesRef.add({
                type: entity.type,
                name: entity.name,
                aliases: entity.aliases,
                properties: entity.properties || {},
                tags: [],
                createdAt: now,
                updatedAt: now,
                lastMentioned: now,
                mentionCount: 1,
                sourceRecordings: [recordingId],
                confidence: entity.confidence,
                mergedFrom: [],
        });
        entityIdMap.set(entity.name, docRef.id);
        entitiesCreated++;
  }

  // 2. Update existing matched entities
  for (const [entityName, entityId] of matched) {
        const entityRef = entitiesRef.doc(entityId);
        const extracted = extraction.entities.find(e => e.name === entityName);

      const updateData: any = {
              updatedAt: now,
              lastMentioned: now,
              mentionCount: admin.firestore.FieldValue.increment(1),
              sourceRecordings: admin.firestore.FieldValue.arrayUnion(recordingId),
      };

      // Merge new aliases
      if (extracted?.aliases && extracted.aliases.length > 0) {
              updateData.aliases = admin.firestore.FieldValue.arrayUnion(...extracted.aliases);
      }

      // Merge new properties (don't overwrite existing ones)
      if (extracted?.properties) {
              const entityDoc = await entityRef.get();
              const existingProps = entityDoc.data()?.properties || {};
              const mergedProps = { ...existingProps };
              for (const [key, value] of Object.entries(extracted.properties)) {
                        if (value && !existingProps[key]) {
                                    mergedProps[key] = value;
                        }
              }
              updateData.properties = mergedProps;
      }

      await entityRef.update(updateData);
        entitiesUpdated++;
  }

  // 3. Create entity mentions (backlinks)
  for (const entity of extraction.entities) {
        const entityId = entityIdMap.get(entity.name);
        if (entityId) {
                await mentionsRef.add({
                          entityId,
                          recordingId,
                          timestamp: now,
                          entityName: entity.name,
                          entityType: entity.type,
                          confidence: entity.confidence,
                });
        }
  }

  // 4. Create/update relationships
  for (const rel of extraction.relationships) {
        const sourceId = entityIdMap.get(rel.sourceEntity);
        const targetId = entityIdMap.get(rel.targetEntity);

      if (sourceId && targetId) {
              // Check if relationship already exists
          const existingRel = await relationshipsRef
                .where('sourceId', '==', sourceId)
                .where('targetId', '==', targetId)
                .where('type', '==', rel.type)
                .limit(1)
                .get();

          if (existingRel.empty) {
                    // Also check reverse direction
                const reverseRel = await relationshipsRef
                      .where('sourceId', '==', targetId)
                      .where('targetId', '==', sourceId)
                      .where('type', '==', rel.type)
                      .limit(1)
                      .get();

                if (reverseRel.empty) {
                            await relationshipsRef.add({
                                          sourceId,
                                          targetId,
                                          sourceName: rel.sourceEntity,
                                          targetName: rel.targetEntity,
                                          type: rel.type,
                                          context: rel.context,
                                          strength: 1,
                                          firstMentioned: now,
                                          lastMentioned: now,
                                          recordings: [recordingId],
                                          bidirectional: true,
                            });
                            relationshipsCreated++;
                } else {
                            // Update existing reverse relationship
                      const reverseDoc = reverseRel.docs[0];
                            await reverseDoc.ref.update({
                                          strength: admin.firestore.FieldValue.increment(1),
                                          lastMentioned: now,
                                          recordings: admin.firestore.FieldValue.arrayUnion(recordingId),
                            });
                }
          } else {
                    // Update existing relationship
                const existingDoc = existingRel.docs[0];
                    await existingDoc.ref.update({
                                strength: admin.firestore.FieldValue.increment(1),
                                lastMentioned: now,
                                recordings: admin.firestore.FieldValue.arrayUnion(recordingId),
                    });
          }
      }
  }

  // 5. Update daily note
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailyNoteRef = userRef.collection('daily_notes').doc(today);
    const dailyNote = await dailyNoteRef.get();

  const entityIds = Array.from(entityIdMap.values());

  if (dailyNote.exists) {
        await dailyNoteRef.update({
                entities: admin.firestore.FieldValue.arrayUnion(...entityIds),
                recordings: admin.firestore.FieldValue.arrayUnion(recordingId),
                recordingCount: admin.firestore.FieldValue.increment(1),
                updatedAt: now,
        });
  } else {
        await dailyNoteRef.set({
                date: today,
                entities: entityIds,
                recordings: [recordingId],
                recordingCount: 1,
                summary: '',
                sentiment: '',
                highlights: [],
                createdAt: now,
                updatedAt: now,
        });
  }

  return { entitiesCreated, entitiesUpdated, relationshipsCreated };
}

// ===== MAIN EXPORT =====

/**
 * Process a recording through the knowledge graph pipeline.
 * Called from index.ts after a recording is processed.
 */
export async function processKnowledgeGraph(
    userId: string,
    recordingId: string,
    transcript: string
  ): Promise<{ success: boolean; stats?: any; error?: string }> {
    console.log(`[KnowledgeGraph] Processing recording ${recordingId} for user ${userId}`);

  try {
        const db = getDb();
        const userRef = db.collection('users').doc(userId);

      // 1. Load existing entities for this user
      const entitiesSnapshot = await userRef.collection('entities')
          .orderBy('mentionCount', 'desc')
          .limit(200) // Top 200 most mentioned entities
        .get();

      const existingEntities = entitiesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
      }));

      // 2. Load user corrections
      const correctionsSnapshot = await userRef.collection('corrections')
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get();

      const userCorrections = correctionsSnapshot.docs.map(doc => doc.data());

      // 3. Extract entities from transcript
      const extraction = await extractEntities(transcript, existingEntities, userCorrections);

      if (extraction.entities.length === 0) {
              console.log(`[KnowledgeGraph] No entities found in recording ${recordingId}`);

          // Still update the recording to mark it as knowledge-processed
          await userRef.collection('recordings').doc(recordingId).update({
                    knowledgeGraphProcessed: true,
                    knowledgeGraphStats: { entities: 0, relationships: 0 },
          });

          return { success: true, stats: { entities: 0, relationships: 0 } };
      }

      console.log(`[KnowledgeGraph] Extracted ${extraction.entities.length} entities, ${extraction.relationships.length} relationships`);

      // 4. Resolve entities (match with existing)
      const { matched, newEntities } = await resolveEntities(userId, extraction.entities, existingEntities);

      console.log(`[KnowledgeGraph] Matched ${matched.size} existing, ${newEntities.length} new entities`);

      // 5. Update the graph
      const stats = await updateGraph(userId, recordingId, extraction, matched, newEntities);

      console.log(`[KnowledgeGraph] Graph updated: ${stats.entitiesCreated} created, ${stats.entitiesUpdated} updated, ${stats.relationshipsCreated} relationships`);

      // 6. Store auto-corrections for future use
      if (extraction.corrections && extraction.corrections.length > 0) {
              const correctionsRef = userRef.collection('corrections');
              for (const correction of extraction.corrections) {
                        await correctionsRef.add({
                                    ...correction,
                                    source: 'auto',
                                    recordingId,
                                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        });
              }
      }

      // 7. Mark recording as knowledge-processed
      await userRef.collection('recordings').doc(recordingId).update({
              knowledgeGraphProcessed: true,
              knowledgeGraphStats: {
                        entitiesExtracted: extraction.entities.length,
                        entitiesCreated: stats.entitiesCreated,
                        entitiesUpdated: stats.entitiesUpdated,
                        relationshipsCreated: stats.relationshipsCreated,
              },
      });

      return {
              success: true,
              stats: {
                        entitiesExtracted: extraction.entities.length,
                        ...stats,
              },
      };

  } catch (error) {
        console.error(`[KnowledgeGraph] Error processing ${recordingId}:`, error);

      // Mark as failed but don't block the recording
      try {
              await getDb()
                .collection('users').doc(userId)
                .collection('recordings').doc(recordingId)
                .update({
                            knowledgeGraphProcessed: false,
                            knowledgeGraphError: error instanceof Error ? error.message : String(error),
                });
      } catch (updateError) {
              console.error('[KnowledgeGraph] Failed to update error status:', updateError);
      }

      return { success: false, error: String(error) };
  }
}
