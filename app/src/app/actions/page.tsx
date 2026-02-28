'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  suggestedAction: string;
  targetService: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
  sourceRecordingId: string;
  sourceSessionId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  completedAt: any;
  manusTaskId: string | null;
  manusStatus: string | null;
  manusTaskUrl?: string;
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'dismissed';
type FilterPriority = 'all' | 'high' | 'medium' | 'low';
type FilterCategory = 'all' | 'followup' | 'task' | 'decision' | 'reminder' | 'research';

export default function ActionsPage() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [manusConnected, setManusConnected] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const actionsRef = collection(db, 'users', user.uid, 'actions');
    const q = query(actionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ActionItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ActionItem[];
      setActions(items);
      setLoading(false);
    }, (error) => {
      console.error('Error loading actions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Check Manus connection status
  useEffect(() => {
    if (!user) return;
    const checkManus = async () => {
      try {
        const getManusStatus = httpsCallable(functions, 'getManusStatus');
        const result = await getManusStatus({});
        const data = result.data as { isConnected: boolean };
        setManusConnected(data.isConnected);
      } catch {
        setManusConnected(false);
      }
    };
    checkManus();
  }, [user]);

  const updateActionStatus = useCallback(async (actionId: string, newStatus: ActionItem['status']) => {
    if (!user) return;
    try {
      const actionRef = doc(db, 'users', user.uid, 'actions', actionId);
      await updateDoc(actionRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
        ...(newStatus === 'completed' ? { completedAt: Timestamp.now() } : {}),
      });
    } catch (error) {
      console.error('Error updating action:', error);
    }
  }, [user]);

  const handleExecuteWithManus = useCallback(async (actionId: string) => {
    if (!user) return;
    setExecutingActions((prev) => new Set(prev).add(actionId));
    try {
      const executeFn = httpsCallable(functions, 'executeWithManus');
      const result = await executeFn({ actionId });
      const data = result.data as { success: boolean; taskUrl: string; message: string };
      if (data.taskUrl) {
        window.open(data.taskUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Error executing with Manus:', error);
      alert(error?.message || 'Error al ejecutar con Manus');
    } finally {
      setExecutingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  }, [user]);

  const filteredActions = actions
    .filter((a) => filterStatus === 'all' || a.status === filterStatus)
    .filter((a) => filterPriority === 'all' || a.priority === filterPriority)
    .filter((a) => filterCategory === 'all' || a.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority] || 1) - (order[b.priority] || 1);
      }
      return 0;
    });

  const stats = {
    total: actions.length,
    pending: actions.filter((a) => a.status === 'pending').length,
    inProgress: actions.filter((a) => a.status === 'in_progress').length,
    completed: actions.filter((a) => a.status === 'completed').length,
  };

  const priorityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10 border-red-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-green-400 bg-green-500/10 border-green-500/30',
  };

  const priorityLabels: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

  const categoryIcons: Record<string, string> = {
    followup: '📞',
    task: '✅',
    decision: '🎯',
    reminder: '⏰',
    research: '🔍',
  };

  const serviceIcons: Record<string, string> = {
    email: '📧',
    calendar: '📅',
    document: '📄',
    task: '✏️',
    browser: '🌐',
    other: '📋',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    dismissed: 'Descartada',
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Acciones</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Tareas y acciones detectadas de tus conversaciones
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-500">{stats.total}</div>
              <div className="text-sm text-gray-400 mt-1">Total</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-sm text-gray-400 mt-1">Pendientes</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-500">{stats.inProgress}</div>
              <div className="text-sm text-gray-400 mt-1">En Progreso</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-500">{stats.completed}</div>
              <div className="text-sm text-gray-400 mt-1">Completadas</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="in_progress">En Progreso</option>
              <option value="completed">Completadas</option>
              <option value="dismissed">Descartadas</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
              className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
              className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="all">Todas las categorías</option>
              <option value="followup">Seguimiento</option>
              <option value="task">Tarea</option>
              <option value="decision">Decisión</option>
              <option value="reminder">Recordatorio</option>
              <option value="research">Investigación</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
              className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="date">Ordenar por fecha</option>
              <option value="priority">Ordenar por prioridad</option>
            </select>
          </div>

          {/* Actions List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Cargando acciones...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold mb-4">
                {actions.length === 0
                  ? 'No hay acciones aún'
                  : 'No hay acciones con estos filtros'}
              </h2>
              <p className="text-gray-400">
                {actions.length === 0
                  ? 'Las acciones se crearán automáticamente al procesar tus grabaciones.'
                  : 'Intenta cambiar los filtros para ver más resultados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActions.map((action) => (
                <div
                  key={action.id}
                  className={`bg-white/5 border border-white/10 rounded-lg p-5 hover:bg-white/[0.07] transition-colors ${
                    action.status === 'completed' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {categoryIcons[action.category] || '📋'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-white font-medium ${
                            action.status === 'completed' ? 'line-through text-gray-500' : ''
                          }`}>
                            {action.task}
                          </p>

                          {action.suggestedAction && (
                            <p className="text-sm text-orange-400 mt-1 flex items-center gap-1">
                              <span>{serviceIcons[action.targetService] || '📋'}</span>
                              {action.suggestedAction}
                            </p>
                          )}

                          {action.context && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              {action.context}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {action.assignee && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                                👤 {action.assignee}
                              </span>
                            )}
                            {action.deadline && (
                              <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full">
                                📅 {action.deadline}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[action.priority] || priorityColors.medium}`}>
                              {priorityLabels[action.priority] || 'Media'}
                            </span>
                            <span className="text-xs text-gray-600">
                              {action.createdAt?.toDate
                                ? action.createdAt.toDate().toLocaleDateString('es-MX', {
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {action.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateActionStatus(action.id, 'in_progress')}
                            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-blue-400"
                            title="Marcar en progreso"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => updateActionStatus(action.id, 'completed')}
                            className="p-2 hover:bg-green-500/20 rounded-lg transition-colors text-green-400"
                            title="Marcar completada"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => updateActionStatus(action.id, 'dismissed')}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-500"
                            title="Descartar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      {action.status === 'in_progress' && (
                        <button
                          onClick={() => updateActionStatus(action.id, 'completed')}
                          className="p-2 hover:bg-green-500/20 rounded-lg transition-colors text-green-400"
                          title="Marcar completada"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      {(action.status === 'completed' || action.status === 'dismissed') && (
                        <button
                          onClick={() => updateActionStatus(action.id, 'pending')}
                          className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors text-yellow-400"
                          title="Reactivar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      {manusConnected && action.status === 'pending' && !action.manusTaskId && (
                        <button
                          onClick={() => handleExecuteWithManus(action.id)}
                          disabled={executingActions.has(action.id)}
                          className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-purple-400 disabled:opacity-50"
                          title="Ejecutar con Manus"
                        >
                          {executingActions.has(action.id) ? (
                            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                      {action.manusTaskId && (
                        <a
                          href={action.manusTaskUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full ml-2 hover:bg-purple-500/30 transition-colors"
                        >
                          🤖 Manus {action.manusStatus === 'completed' ? '✅' : '🔄'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
