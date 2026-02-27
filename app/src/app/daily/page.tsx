'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { db, functions } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';

interface DailySummary {
  date: string;
  greeting: string;
  overview: string;
  stats: {
    totalRecordings: number;
    totalMinutes: number;
    meetingsCount: number;
    workSessionsCount: number;
  };
  topics: Array<{
    name: string;
    percentage: number;
  }>;
  achievements: string[];
  pending: string[];
  vibe: 'productive' | 'stressed' | 'creative' | 'routine';
  insight: string;
}

export default function DailyPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    checkProfile();
    loadSummary();
  }, [user, selectedDate]);

  const checkProfile = async () => {
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'profile', 'main');
      const docSnap = await getDoc(docRef);
      setHasProfile(docSnap.exists() && !!docSnap.data()?.name);
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  };

  const loadSummary = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const docRef = doc(db, 'users', user.uid, 'dailySummaries', selectedDate);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setSummary(docSnap.data() as DailySummary);
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!user) return;

    setGenerating(true);

    try {
      // Note: This function needs to be implemented in backend
      const generateFn = httpsCallable(functions, 'generateDailySummary');
      const result = await generateFn({ date: selectedDate });

      setSummary(result.data as DailySummary);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Error al generar resumen. La función aún no está implementada en el backend.');
    } finally {
      setGenerating(false);
    }
  };

  const vibeEmoji = {
    productive: '😊',
    stressed: '😓',
    creative: '🎨',
    routine: '📋'
  };

  const vibeText = {
    productive: 'Productivo',
    stressed: 'Intenso',
    creative: 'Creativo',
    routine: 'Rutinario'
  };

  if (!hasProfile) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="text-6xl mb-4">👤</div>
            <h1 className="text-2xl font-bold mb-4">Configura tu perfil primero</h1>
            <p className="text-gray-400 mb-6">
              Para generar resúmenes personalizados, necesitamos conocerte un poco.
              Toma solo 2 minutos.
            </p>
            <Link
              href="/profile"
              className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Configurar Perfil
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Tu Día en Always</h1>
                <p className="text-gray-500 text-sm mt-1">Resumen personalizado de tu actividad</p>
              </div>
            </div>

            {/* Date Selector */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Cargando resumen...</p>
            </div>
          ) : summary ? (
            /* Summary View */
            <div className="space-y-6">
              {/* Greeting Card */}
              <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-2">{summary.greeting}</h2>
                <p className="text-gray-300 text-lg">{summary.overview}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-3xl">{vibeEmoji[summary.vibe]}</span>
                  <span className="text-gray-400">Vibe: {vibeText[summary.vibe]}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold text-orange-500">{summary.stats.totalRecordings}</div>
                  <div className="text-sm text-gray-400 mt-1">Grabaciones</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-500">
                    {Math.floor(summary.stats.totalMinutes / 60)}h {summary.stats.totalMinutes % 60}m
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Tiempo total</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-500">{summary.stats.meetingsCount}</div>
                  <div className="text-sm text-gray-400 mt-1">Reuniones</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-500">{summary.stats.workSessionsCount}</div>
                  <div className="text-sm text-gray-400 mt-1">Sesiones</div>
                </div>
              </div>

              {/* Activity Distribution */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span>📊</span> Distribución de Actividad
                </h3>
                <div className="space-y-3">
                  {summary.topics.map((topic, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{topic.name}</span>
                        <span className="text-sm font-medium text-orange-500">{topic.percentage}%</span>
                      </div>
                      <div className="h-2 bg-black rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all"
                          style={{ width: `${topic.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              {summary.achievements.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-300">
                    <span>✅</span> Logros del Día
                  </h3>
                  <ul className="space-y-2">
                    {summary.achievements.map((achievement, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pending */}
              {summary.pending.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-300">
                    <span>📋</span> Pendientes para Mañana
                  </h3>
                  <ul className="space-y-2">
                    {summary.pending.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-yellow-500 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insight */}
              {summary.insight && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-purple-300">
                    <span>💡</span> Insight
                  </h3>
                  <p className="text-gray-300 italic">"{summary.insight}"</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => {/* TODO: Share functionality */}}
                  className="px-6 py-3 bg-white/5 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Compartir
                </button>

                <button
                  onClick={() => {/* TODO: Export functionality */}}
                  className="px-6 py-3 bg-white/5 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </button>
              </div>
            </div>
          ) : (
            /* No Summary - Generate */
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-4">
                No hay resumen para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
              <p className="text-gray-400 mb-6">
                Genera un resumen personalizado de tu actividad del día
              </p>
              <button
                onClick={generateSummary}
                disabled={generating}
                className="px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 mx-auto"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generando resumen...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generar Resumen
                  </>
                )}
              </button>
              <p className="text-xs text-gray-600 mt-4">
                ⚡ Powered by GPT-4o-mini • Personalizado con tu perfil
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
