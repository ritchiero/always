'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, limit, where, doc, getDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const GraphView = dynamic(() => import('@/components/GraphView'), { ssr: false });

interface Entity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  description: string;
  mentionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  metadata: Record<string, any>;
}

interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description: string;
  strength: number;
}

interface RecordingMention {
  id: string;
  transcript: string;
  createdAt: Date;
  title?: string;
}

const TYPE_COLORS: Record<string, string> = {
  person: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  company: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  project: 'bg-green-500/20 text-green-300 border-green-500/30',
  product: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  place: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  concept: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  event: 'bg-red-500/20 text-red-300 border-red-500/30',
  tool: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  topic: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  decision: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  default: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const TYPE_ICONS: Record<string, string> = {
  person: '👤',
  company: '🏢',
  project: '📁',
  product: '📦',
  place: '📍',
  concept: '💡',
  event: '📅',
  tool: '🔧',
  topic: '💬',
  decision: '✅',
  default: '🔹',
};

function getExcerpt(transcript: string, entityName: string, contextChars: number = 120): string {
  const lower = transcript.toLowerCase();
  const nameLower = entityName.toLowerCase();
  const idx = lower.indexOf(nameLower);
  if (idx === -1) return transcript.substring(0, contextChars * 2) + '...';
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(transcript.length, idx + entityName.length + contextChars);
  let excerpt = '';
  if (start > 0) excerpt += '...';
  excerpt += transcript.substring(start, end);
  if (end < transcript.length) excerpt += '...';
  return excerpt;
}

export default function ConocimientoPage() {
  const { user, loading: authLoading } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [allRelationships, setAllRelationships] = useState<Relationship[]>([]);
  const [recordingMentions, setRecordingMentions] = useState<RecordingMention[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  // Fetch all entities
  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }
    const fetchEntities = async () => {
      try {
        const entitiesRef = collection(db, 'users', user.uid, 'entities');
        const q = query(entitiesRef, orderBy('mentionCount', 'desc'), limit(200));
        const snapshot = await getDocs(q);
        const ents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          firstSeen: doc.data().firstSeen?.toDate() || new Date(),
          lastSeen: doc.data().lastSeen?.toDate() || new Date(),
        })) as Entity[];
        setEntities(ents);
        const names: Record<string, string> = {};
        ents.forEach(e => { names[e.id] = e.name; });
        setEntityNames(names);
      } catch (err) {
        console.error('Error fetching entities:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntities();
  }, [user, authLoading]);

  // Fetch ALL relationships for the graph view
  useEffect(() => {
    if (authLoading || !user || !entities.length) return;
    const fetchAllRelationships = async () => {
      try {
        const relsRef = collection(db, 'users', user.uid, 'relationships');
        const snapshot = await getDocs(relsRef);
        const rels = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sourceEntityId: data.sourceEntityId || data.sourceId || '',
            targetEntityId: data.targetEntityId || data.targetId || '',
            type: data.type || 'related_to',
            description: data.description || '',
            strength: data.strength || 1,
          } as Relationship;
        });
        setAllRelationships(rels);
        console.log('Loaded ' + rels.length + ' relationships for graph');
      } catch (err) {
        console.error('Error fetching relationships:', err);
      }
    };
    fetchAllRelationships();
  }, [user, authLoading, entities]);

  // Fetch entity details when selected
  const selectEntity = async (entity: Entity) => {
    setSelectedEntity(entity);
    setDetailLoading(true);
    try {
      // Fetch relationships
      const relsRef = collection(db, 'users', user!.uid, 'relationships');
      const allRels: Relationship[] = [];

      // Try sourceEntityId
      try {
        const q1 = query(relsRef, where('sourceEntityId', '==', entity.id));
        const s1 = await getDocs(q1);
        s1.docs.forEach(d => allRels.push({ id: d.id, ...d.data() } as Relationship));
      } catch (e) { /* ignore */ }

      // Try targetEntityId
      try {
        const q2 = query(relsRef, where('targetEntityId', '==', entity.id));
        const s2 = await getDocs(q2);
        s2.docs.forEach(d => allRels.push({ id: d.id, ...d.data() } as Relationship));
      } catch (e) { /* ignore */ }

      // Try sourceId (co-occurrence format)
      try {
        const q3 = query(relsRef, where('sourceId', '==', entity.id));
        const s3 = await getDocs(q3);
        s3.docs.forEach(d => {
          const data = d.data();
          allRels.push({
            id: d.id,
            sourceEntityId: data.sourceId || data.sourceEntityId,
            targetEntityId: data.targetId || data.targetEntityId,
            type: data.type || 'related_to',
            description: data.description || '',
            strength: data.strength || 1,
          } as Relationship);
        });
      } catch (e) { /* ignore */ }

      // Try targetId
      try {
        const q4 = query(relsRef, where('targetId', '==', entity.id));
        const s4 = await getDocs(q4);
        s4.docs.forEach(d => {
          const data = d.data();
          allRels.push({
            id: d.id,
            sourceEntityId: data.sourceId || data.sourceEntityId,
            targetEntityId: data.targetId || data.targetEntityId,
            type: data.type || 'related_to',
            description: data.description || '',
            strength: data.strength || 1,
          } as Relationship);
        });
      } catch (e) { /* ignore */ }

      // Deduplicate
      const uniqueRels = allRels.filter((rel, idx, arr) => arr.findIndex(r => r.id === rel.id) === idx);
      setRelationships(uniqueRels);

      // Search recordings that mention this entity by name
      const recordingsRef = collection(db, 'users', user!.uid, 'recordings');
      const recQuery = query(recordingsRef, orderBy('createdAt', 'desc'), limit(50));
      const recSnap = await getDocs(recQuery);
      const matchingRecordings: RecordingMention[] = [];
      const searchTerms = [entity.name.toLowerCase(), ...(entity.aliases || []).map(a => a.toLowerCase())];

      recSnap.docs.forEach(d => {
        const data = d.data();
        const transcript = (data.transcript || data.text || '').toLowerCase();
        const matches = searchTerms.some(term => transcript.includes(term));
        if (matches) {
          matchingRecordings.push({
            id: d.id,
            transcript: data.transcript || data.text || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            title: data.title || undefined,
          });
        }
      });

      setRecordingMentions(matchingRecordings.slice(0, 10));
    } catch (err) {
      console.error('Error fetching entity details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filter entities
  const filteredEntities = entities.filter(e => {
    const matchesType = filterType === 'all' || e.type === filterType;
    const matchesSearch = searchTerm === '' ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.aliases || []).some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const entityTypes = [...new Set(entities.map(e => e.type))].sort();
  const totalEntities = entities.length;
  const totalPeople = entities.filter(e => e.type === 'person').length;
  const totalCompanies = entities.filter(e => e.type === 'company').length;
  const totalProjects = entities.filter(e => e.type === 'project').length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando Knowledge Graph...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Debes iniciar sesion para ver tu Knowledge Graph</p>
      </div>
    );
  }

  // Detail panel component (shared between list and graph views)
  const DetailPanel = () => {
    if (!selectedEntity) return null;
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-5 relative">
        <button
          onClick={() => setSelectedEntity(null)}
          className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg"
        >✕</button>

        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">{TYPE_ICONS[selectedEntity.type] || TYPE_ICONS.default}</span>
          <div>
            <h2 className="text-xl font-bold">{selectedEntity.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[selectedEntity.type] || TYPE_COLORS.default}`}>
              {selectedEntity.type}
            </span>
          </div>
        </div>

        {selectedEntity.description && (
          <p className="text-gray-300 text-sm mb-4">{selectedEntity.description}</p>
        )}

        {selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Aliases</h3>
            <div className="flex flex-wrap gap-1">
              {selectedEntity.aliases.map((alias, i) => (
                <span key={i} className="text-xs bg-gray-700/50 px-2 py-1 rounded">{alias}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-900/50 rounded p-2 text-center">
            <div className="text-lg font-bold text-orange-400">{selectedEntity.mentionCount}</div>
            <div className="text-xs text-gray-500">Menciones</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2 text-center">
            <div className="text-lg font-bold text-blue-400">{relationships.length}</div>
            <div className="text-xs text-gray-500">Relaciones</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2 text-center">
            <div className="text-xs font-medium text-gray-300">
              {selectedEntity.lastSeen.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-xs text-gray-500">Ultima vez</div>
          </div>
        </div>

        {detailLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
          </div>
        ) : (
          <>
            {relationships.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Relaciones</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {relationships.map((rel) => {
                    const isSource = rel.sourceEntityId === selectedEntity.id;
                    const otherEntityId = isSource ? rel.targetEntityId : rel.sourceEntityId;
                    const otherName = entityNames[otherEntityId] || 'Desconocido';
                    return (
                      <div key={rel.id} className="flex items-center gap-2 text-sm bg-gray-900/30 rounded px-3 py-2">
                        <span className="text-gray-400">{isSource ? '→' : '←'}</span>
                        <span className="text-orange-300 text-xs">{rel.type}</span>
                        <span className="text-gray-400">→</span>
                        <button
                          onClick={() => {
                            const otherEntity = entities.find(e => e.id === otherEntityId);
                            if (otherEntity) selectEntity(otherEntity);
                          }}
                          className="text-blue-400 hover:text-blue-300 hover:underline text-sm"
                        >
                          {otherName}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recordingMentions.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Conversaciones donde se menciona ({recordingMentions.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recordingMentions.map((rec) => (
                    <Link
                      key={rec.id}
                      href={`/conversations/${rec.id}`}
                      className="block bg-gray-900/30 rounded px-3 py-2 hover:bg-gray-900/50 transition-colors"
                    >
                      {rec.title && (
                        <p className="text-sm font-medium text-white mb-1">{rec.title}</p>
                      )}
                      <p className="text-sm text-gray-300 line-clamp-3">
                        {getExcerpt(rec.transcript, selectedEntity.name)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {rec.createdAt.toLocaleDateString('es-MX', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {recordingMentions.length === 0 && relationships.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No se encontraron conversaciones con esta entidad
              </p>
            )}

            {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Detalles</h3>
                <div className="space-y-1">
                  {Object.entries(selectedEntity.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-gray-300">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Home button */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800/50"
              title="Volver al inicio"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">🧠 Knowledge Graph</h1>
          </div>
          <p className="text-gray-400 text-sm ml-9">
            Tu red de conocimiento construida automaticamente desde tus conversaciones
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-orange-400">{totalEntities}</div>
            <div className="text-xs text-gray-400">Entidades</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-blue-400">{totalPeople}</div>
            <div className="text-xs text-gray-400">Personas</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-purple-400">{totalCompanies}</div>
            <div className="text-xs text-gray-400">Empresas</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-green-400">{totalProjects}</div>
            <div className="text-xs text-gray-400">Proyectos</div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "list"
                ? "bg-orange-500 text-white"
                : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50"
            }`}
          >Lista</button>
          <button
            onClick={() => setViewMode("graph")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === "graph"
                ? "bg-orange-500 text-white"
                : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50"
            }`}
          >Grafo</button>
        </div>

        {viewMode === "graph" ? (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className={`${selectedEntity ? 'lg:w-3/5' : 'w-full'} transition-all`}>
              <GraphView
                entities={entities}
                relationships={allRelationships}
                onSelectEntity={selectEntity}
              />
            </div>
            {selectedEntity && (
              <div className="lg:w-2/5">
                <DetailPanel />
              </div>
            )}
          </div>
        ) : (<>
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="Buscar entidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="all">Todos los tipos</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>
                  {TYPE_ICONS[type] || TYPE_ICONS.default} {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className={`${selectedEntity ? 'lg:w-1/2' : 'w-full'} space-y-2`}>
              {filteredEntities.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700/50">
                  <p className="text-4xl mb-3">🧠</p>
                  <p className="text-gray-400 mb-2">
                    {entities.length === 0
                      ? 'Tu Knowledge Graph esta vacio'
                      : 'No se encontraron entidades'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {entities.length === 0
                      ? 'Las entidades se extraen automaticamente de tus grabaciones'
                      : 'Intenta con otro termino de busqueda'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => selectEntity(entity)}
                      className={`text-left p-3 rounded-lg border transition-all hover:scale-[1.01] ${
                        selectedEntity?.id === entity.id
                          ? 'bg-orange-500/10 border-orange-500/50'
                          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{TYPE_ICONS[entity.type] || TYPE_ICONS.default}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{entity.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[entity.type] || TYPE_COLORS.default}`}>
                              {entity.type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {entity.mentionCount} menciones
                            </span>
                          </div>
                          {entity.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{entity.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEntity && (
              <div className="lg:w-1/2 sticky top-4">
                <DetailPanel />
              </div>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
