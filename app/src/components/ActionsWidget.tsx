'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import Link from 'next/link';

interface ActionItem {
  id: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  category: string;
  suggestedAction: string;
  targetService: string;
  deadline: string;
  createdAt: any;
}

export function ActionsWidget() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewActions, setHasNewActions] = useState(false);

  useEffect(() => {
    if (!user) return;
    const actionsRef = collection(db, 'users', user.uid, 'actions');
    const q = query(
      actionsRef,
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ActionItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ActionItem[];
      if (items.length > actions.length && actions.length > 0) {
        setHasNewActions(true);
      }
      setActions(items);
    });
    return () => unsubscribe();
  }, [user]);

  if (actions.length === 0) return null;

  const categoryIcons: Record<string, string> = {
    followup: '\u{1F4DE}',
    task: '\u{2705}',
    decision: '\u{1F3AF}',
    reminder: '\u{23F0}',
    research: '\u{1F50D}',
  };

  const priorityColors: Record<string, string> = {
    high: 'border-red-500/40 bg-red-500/5',
    medium: 'border-amber-500/30 bg-amber-500/5',
    low: 'border-emerald-500/20 bg-emerald-500/5',
  };

  return (
    <>
      {/* Floating action button */}
      <div className="fixed bottom-24 right-6 z-50">
        <button
          onClick={() => { setIsOpen(!isOpen); setHasNewActions(false); }}
          className={`relative group flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 transition-all duration-300`}
        >
          <span className="text-lg">\u{26A1}</span>
          <span>{actions.length} accion{actions.length !== 1 ? 'es' : ''} pendiente{actions.length !== 1 ? 's' : ''}</span>
          {hasNewActions && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
          {hasNewActions && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Popup panel */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-50 w-96 max-h-[60vh] overflow-hidden rounded-2xl bg-gray-950 border border-white/10 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="p-4 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm">Acciones Pendientes</h3>
                <p className="text-xs text-gray-500 mt-0.5">Detectadas de tus conversaciones</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Actions list */}
          <div className="overflow-y-auto max-h-[45vh] p-2 space-y-1.5">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`p-3 rounded-xl border transition-all hover:bg-white/[0.03] ${
                  priorityColors[action.priority] || priorityColors.medium
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {categoryIcons[action.category] || '\u{1F4CB}'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                      {action.task}
                    </p>
                    {action.suggestedAction && (
                      <p className="text-xs text-orange-400/70 mt-1 line-clamp-1">
                        {action.suggestedAction}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {action.deadline && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          action.deadline.toLowerCase().includes('hoy')
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/5 text-gray-500'
                        }`}>
                          \u{1F4C5} {action.deadline}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        action.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        action.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {action.priority === 'high' ? 'Urgente' : action.priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/5">
            <Link
              href="/actions"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
            >
              Ver todas las acciones
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
