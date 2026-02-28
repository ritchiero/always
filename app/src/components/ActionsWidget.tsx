'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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

const CAT_ICONS: Record<string, string> = {
  followup: '📞',
  task: '✅',
  decision: '🎯',
  reminder: '⏰',
  research: '🔍',
};

const PRIO_COLORS: Record<string, string> = {
  high: 'border-red-500/40 bg-red-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-emerald-500/20 bg-emerald-500/5',
};

const PRIO_BADGE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-emerald-500/20 text-emerald-400',
};

const PRIO_LABEL: Record<string, string> = {
  high: 'Urgente',
  medium: 'Media',
  low: 'Baja',
};

export function ActionsWidget() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewActions, setHasNewActions] = useState(false);

  useEffect(() => {
    if (!user) return;
    const actionsRef = collection(db, 'users', user.uid, 'actions');
    const q = query(actionsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ActionItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ActionItem[];
      const pending = items.filter((a: any) => a.status === 'pending').slice(0, 5);
      if (pending.length > actions.length && actions.length > 0) {
        setHasNewActions(true);
      }
      setActions(pending);
    });
    return () => unsubscribe();
  }, [user]);

  if (actions.length === 0) return null;

  const count = actions.length;
  const label = count === 1 ? '1 acción pendiente' : count + ' acciones pendientes';

  return (
    <>
      <div className="fixed bottom-24 right-6 z-50">
        <button
          onClick={() => { setIsOpen(!isOpen); setHasNewActions(false); }}
          className="relative group flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 transition-all duration-300"
        >
          <span className="text-lg">{'⚡'}</span>
          <span>{label}</span>
          {hasNewActions && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
          {hasNewActions && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-40 right-6 z-50 w-96 max-h-[60vh] overflow-hidden rounded-2xl bg-gray-950 border border-white/10 shadow-2xl shadow-black/50">
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

          <div className="overflow-y-auto max-h-[45vh] p-2 space-y-1.5">
            {actions.map((action) => (
              <div
                key={action.id}
                className={'p-3 rounded-xl border transition-all hover:bg-white/[0.03] ' + (PRIO_COLORS[action.priority] || PRIO_COLORS.medium)}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {CAT_ICONS[action.category] || '📋'}
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
                        <span className={'text-[10px] px-1.5 py-0.5 rounded ' + (
                          action.deadline.toLowerCase().includes('hoy')
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/5 text-gray-500'
                        )}>
                          {'📅'} {action.deadline}
                        </span>
                      )}
                      <span className={'text-[10px] px-1.5 py-0.5 rounded ' + (PRIO_BADGE[action.priority] || PRIO_BADGE.medium)}>
                        {PRIO_LABEL[action.priority] || 'Media'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
