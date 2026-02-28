'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
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
  dismissedAt: any;
  manusTaskId: string | null;
  manusStatus: string | null;
  manusTaskUrl?: string;
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'archived';

const DEMO_ACTIONS = [
  {
    task: 'Enviar propuesta de presupuesto a María García',
    assignee: 'María García',
    deadline: 'Viernes 28 de febrero',
    status: 'pending',
    suggestedAction: 'Redactar y enviar email con la propuesta adjunta',
    targetService: 'email',
    category: 'task',
    priority: 'high',
    context: 'Discutido en la reunión de planificación del proyecto Alpha',
  },
  {
    task: 'Agendar reunión de seguimiento con el equipo de desarrollo',
    assignee: 'Equipo Dev',
    deadline: 'Próximo miércoles',
    status: 'pending',
    suggestedAction: 'Crear evento en calendario para 10 personas',
    targetService: 'calendar',
    category: 'followup',
    priority: 'medium',
    context: 'Se acordó revisar avances del sprint cada semana',
  },
  {
    task: 'Investigar opciones de hosting para migración a la nube',
    assignee: '',
    deadline: '',
    status: 'pending',
    suggestedAction: 'Buscar y comparar AWS, GCP y Azure para nuestro caso de uso',
    targetService: 'browser',
    category: 'research',
    priority: 'medium',
    context: 'El CTO mencionó que necesitamos migrar antes de Q2',
  },
  {
    task: 'Confirmar asistencia a la conferencia de tecnología',
    assignee: '',
    deadline: 'Hoy',
    status: 'pending',
    suggestedAction: 'Responder al email de invitación confirmando asistencia',
    targetService: 'email',
    category: 'reminder',
    priority: 'high',
    context: 'La invitación llegó la semana pasada, fecha límite hoy',
  },
  {
    task: 'Preparar presentación de resultados Q4',
    assignee: 'Carlos López',
    deadline: 'Lunes próximo',
    status: 'pending',
    suggestedAction: 'Crear documento con gráficas de métricas del trimestre',
    targetService: 'document',
    category: 'task',
    priority: 'low',
    context: 'El director pidió tener los resultados listos para la junta',
  },
];

export default function ActionsPage() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [manusConnected, setManusConnected] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

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
      const updates: any = {
        status: newStatus,
        updatedAt: Timestamp.now(),
      };
      if (newStatus === 'completed') updates.completedAt = Timestamp.now();
      if (newStatus === 'dismissed') updates.dismissedAt = Timestamp.now();
      await updateDoc(actionRef, updates);
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

  const createDemoActions = useCallback(async () => {
    if (!user) return;
    setCreatingDemo(true);
    try {
      const actionsRef = collection(db, 'users', user.uid, 'actions');
      for (const demo of DEMO_ACTIONS) {
        await addDoc(actionsRef, {
          ...demo,
          userId: user.uid,
          sourceRecordingId: 'demo',
          sourceSessionId: 'demo',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          completedAt: null,
          dismissedAt: null,
          manusTaskId: null,
          manusStatus: null,
        });
      }
    } catch (error) {
      console.error('Error creating demo actions:', error);
    } finally {
      setCreatingDemo(false);
    }
  }, [user]);

  // Active = not dismissed
  const activeActions = actions.filter((a) => a.status !== 'dismissed');
  const archivedActions = actions.filter((a) => a.status === 'dismissed');

  const filteredActions = filterStatus === 'archived'
    ? archivedActions
    : activeActions
        .filter((a) => filterStatus === 'all' || a.status === filterStatus)
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.priority] || 1) - (order[b.priority] || 1);
        });

  const stats = {
    total: activeActions.length,
    pending: activeActions.filter((a) => a.status === 'pending').length,
    inProgress: activeActions.filter((a) => a.status === 'in_progress').length,
    completed: activeActions.filter((a) => a.status === 'completed').length,
    archived: archivedActions.length,
  };

  const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
    high: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-500/20' },
    medium: { label: 'Media', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    low: { label: 'Baja', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  };

  const categoryConfig: Record<string, { icon: string; label: string }> = {
    followup: { icon: '📞', label: 'Seguimiento' },
    task: { icon: '✅', label: 'Tarea' },
    decision: { icon: '🎯', label: 'Decisión' },
    reminder: { icon: '⏰', label: 'Recordatorio' },
    research: { icon: '🔍', label: 'Investigación' },
  };

  const serviceConfig: Record<string, { icon: string }> = {
    email: { icon: '📧' },
    calendar: { icon: '📅' },
    document: { icon: '📄' },
    task: { icon: '✏️' },
    browser: { icon: '🌐' },
    other: { icon: '📋' },
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Centro de Acciones</h1>
                <p className="text-xs text-gray-500">Detectadas automáticamente de tus conversaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {manusConnected && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                  Manus conectado
                </span>
              )}
              <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/10">
                {([['all', 'Todas'], ['pending', 'Pendientes'], ['in_progress', 'En curso'], ['completed', 'Hechas'], ['archived', 'Archivadas']] as [FilterStatus, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilterStatus(value)}
                    className={"px-3 py-1.5 text-xs font-medium rounded-lg transition-all " + (
                      filterStatus === value
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {label}
                    {value === 'pending' && stats.pending > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded-full font-bold">
                        {stats.pending}
                      </span>
                    )}
                    {value === 'archived' && stats.archived > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-gray-600 text-gray-300 rounded-full font-bold">
                        {stats.archived}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Stats row - only show for non-archived view */}
          {filterStatus !== 'archived' && (
            <div className="grid grid-cols-4 gap-3 mb-8">
              {[
                { n: stats.total, label: 'Total', color: 'from-orange-500/20 to-orange-600/5', text: 'text-orange-400', border: 'border-orange-500/20' },
                { n: stats.pending, label: 'Pendientes', color: 'from-amber-500/20 to-amber-600/5', text: 'text-amber-400', border: 'border-amber-500/20' },
                { n: stats.inProgress, label: 'En curso', color: 'from-blue-500/20 to-blue-600/5', text: 'text-blue-400', border: 'border-blue-500/20' },
                { n: stats.completed, label: 'Completadas', color: 'from-emerald-500/20 to-emerald-600/5', text: 'text-emerald-400', border: 'border-emerald-500/20' },
              ].map((s) => (
                <div key={s.label} className={"bg-gradient-to-br " + s.color + " border " + s.border + " rounded-2xl p-4 text-center"}>
                  <div className={"text-3xl font-bold " + s.text}>{s.n}</div>
                  <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Archived header */}
          {filterStatus === 'archived' && (
            <div className="mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-xl">{'🗄️'}</div>
              <div>
                <h2 className="font-medium">Acciones Archivadas</h2>
                <p className="text-xs text-gray-500">{stats.archived} acci{stats.archived === 1 ? 'ón descartada' : 'ones descartadas'} — puedes reactivarlas en cualquier momento</p>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-orange-500/30 rounded-full" />
                <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-500 mt-6 text-sm">Cargando acciones...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              {actions.length === 0 ? (
                <>
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-3xl" />
                    <div className="relative w-24 h-24 bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center border border-white/10">
                      <span className="text-5xl">{'⚡'}</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Tus acciones aparecerán aquí</h2>
                  <p className="text-gray-500 text-center max-w-md mb-8">
                    Cuando grabes conversaciones, la IA detectará automáticamente tareas,
                    seguimientos y recordatorios. Con Manus, podrás ejecutarlas con un click.
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={createDemoActions}
                      disabled={creatingDemo}
                      className="group relative px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl font-medium text-sm text-black hover:shadow-lg hover:shadow-orange-500/25 transition-all hover:scale-105 disabled:opacity-50"
                    >
                      {creatingDemo ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          Creando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>{'🚀'}</span>
                          Probar con acciones de ejemplo
                        </span>
                      )}
                    </button>
                    <span className="text-xs text-gray-600">
                      Genera 5 acciones de demo para explorar la interfaz
                    </span>
                  </div>
                  <div className="mt-16 w-full max-w-2xl">
                    <h3 className="text-xs uppercase tracking-widest text-gray-600 text-center mb-6">Cómo funciona</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: '🎙️', title: 'Graba', desc: 'Habla naturalmente en tus reuniones' },
                        { icon: '🧠', title: 'Detecta', desc: 'La IA identifica acciones y tareas' },
                        { icon: '⚡', title: 'Ejecuta', desc: 'Manus las ejecuta por ti automáticamente' },
                      ].map((step) => (
                        <div key={step.title} className="text-center p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                          <div className="text-3xl mb-3">{step.icon}</div>
                          <div className="text-sm font-medium mb-1">{step.title}</div>
                          <div className="text-xs text-gray-500">{step.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : filterStatus === 'archived' ? (
                <>
                  <div className="text-4xl mb-4">{'✨'}</div>
                  <h2 className="text-xl font-bold mb-2">Sin acciones archivadas</h2>
                  <p className="text-gray-500">Las acciones que descartes aparecerán aquí para que puedas recuperarlas</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">{'🔍'}</div>
                  <h2 className="text-xl font-bold mb-2">Sin resultados</h2>
                  <p className="text-gray-500">No hay acciones con el filtro seleccionado</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActions.map((action, idx) => {
                const prio = priorityConfig[action.priority] || priorityConfig.medium;
                const cat = categoryConfig[action.category] || { icon: '📋', label: action.category };
                const svc = serviceConfig[action.targetService] || serviceConfig.other;
                const isExpanded = expandedAction === action.id;
                const isExecuting = executingActions.has(action.id);
                const isPending = action.status === 'pending';
                const isCompleted = action.status === 'completed';
                const isDismissed = action.status === 'dismissed';
                const isInProgress = action.status === 'in_progress';

                return (
                  <div
                    key={action.id}
                    onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                    className={"group relative rounded-2xl border transition-all duration-300 cursor-pointer " + (
                      isDismissed
                        ? 'bg-white/[0.01] border-white/5 opacity-60'
                        : isCompleted
                        ? 'bg-white/[0.02] border-white/5 opacity-50'
                        : action.priority === 'high'
                        ? 'bg-gradient-to-r from-red-500/[0.05] to-transparent border-red-500/20 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                    )}
                  >
                    {isPending && action.priority === 'high' && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-red-500 to-red-500/0 rounded-full" />
                    )}

                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={"flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl " + (
                          isDismissed ? 'bg-white/[0.02] grayscale' : isPending ? 'bg-white/5' : 'bg-white/[0.02]'
                        )}>
                          {cat.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className={"font-medium leading-snug " + (
                              isCompleted ? 'line-through text-gray-600' : isDismissed ? 'text-gray-500' : 'text-white'
                            )}>
                              {action.task}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isDismissed && (
                                <span className="text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wider text-gray-500 bg-gray-500/10">
                                  Archivada
                                </span>
                              )}
                              {!isDismissed && (
                                <span className={"text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wider " + prio.color + " " + prio.bg}>
                                  {prio.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {action.suggestedAction && !isDismissed && (
                            <p className="text-sm text-orange-400/80 mt-1.5 flex items-center gap-1.5">
                              <span className="text-xs">{svc.icon}</span>
                              {action.suggestedAction}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {action.assignee && (
                              <span className="text-[11px] px-2 py-0.5 bg-blue-500/10 text-blue-400/80 rounded-lg">
                                {'👤'} {action.assignee}
                              </span>
                            )}
                            {action.deadline && !isDismissed && (
                              <span className={"text-[11px] px-2 py-0.5 rounded-lg " + (
                                action.deadline.toLowerCase().includes('hoy')
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-purple-500/10 text-purple-400/80'
                              )}>
                                {'📅'} {action.deadline}
                              </span>
                            )}
                            <span className="text-[11px] px-2 py-0.5 bg-white/5 text-gray-500 rounded-lg">
                              {cat.label}
                            </span>
                            {isDismissed && action.dismissedAt?.toDate && (
                              <span className="text-[10px] text-gray-600">
                                Archivada {action.dismissedAt.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                            {!isDismissed && (
                              <span className="text-[10px] text-gray-600">
                                {action.createdAt?.toDate
                                  ? action.createdAt.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            )}
                          </div>

                          {isExpanded && action.context && (
                            <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                              <p className="text-xs text-gray-500 leading-relaxed">
                                <span className="text-gray-400 font-medium">Contexto: </span>
                                {action.context}
                              </p>
                            </div>
                          )}

                          {/* Action buttons */}
                          {isExpanded && (
                            <div className="flex items-center gap-2 mt-4">
                              {isPending && (
                                <>
                                  {manusConnected && !action.manusTaskId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleExecuteWithManus(action.id); }}
                                      disabled={isExecuting}
                                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                      {isExecuting ? (
                                        <>
                                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                          Enviando a Manus...
                                        </>
                                      ) : (
                                        <>
                                          <span>{'⚡'}</span>
                                          Ejecutar con Manus
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'completed'); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Hecha
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'dismissed'); }}
                                    className="flex items-center gap-1.5 px-3 py-2 text-gray-600 text-xs rounded-xl hover:bg-white/5 transition-all"
                                  >
                                    {'🗄️'} Archivar
                                  </button>
                                </>
                              )}
                              {isInProgress && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'completed'); }}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Completar
                                </button>
                              )}
                              {isDismissed && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'pending'); }}
                                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-xl hover:bg-amber-500/20 transition-all border border-amber-500/20"
                                >
                                  {'🔄'} Reactivar acción
                                </button>
                              )}
                              {isCompleted && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'pending'); }}
                                  className="flex items-center gap-1.5 px-3 py-2 text-amber-400 text-xs rounded-xl hover:bg-amber-500/10 transition-all"
                                >
                                  Reactivar
                                </button>
                              )}
                              {action.manusTaskId && (
                                <a
                                  href={action.manusTaskUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 text-purple-400 text-xs rounded-xl hover:bg-purple-500/20 transition-all border border-purple-500/20"
                                >
                                  {'🤖'} Ver en Manus {action.manusStatus === 'completed' ? '✅' : '🔄'}
                                </a>
                              )}
                            </div>
                          )}

                          {/* Show buttons on hover for pending items (not expanded) */}
                          {!isExpanded && isPending && (
                            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              {manusConnected && !action.manusTaskId && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleExecuteWithManus(action.id); }}
                                  disabled={isExecuting}
                                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all hover:scale-105 disabled:opacity-50"
                                >
                                  {isExecuting ? (
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <span>{'⚡'}</span>
                                  )}
                                  {isExecuting ? 'Enviando...' : 'Ejecutar con Manus'}
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'completed'); }}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Hecha
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateActionStatus(action.id, 'dismissed'); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 text-xs rounded-xl hover:bg-white/5 transition-all"
                              >
                                Archivar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
