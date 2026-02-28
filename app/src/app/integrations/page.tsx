'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [manusConnected, setManusConnected] = useState(false);
  const [manusApiKey, setManusApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      try {
        const getManusStatus = httpsCallable(functions, 'getManusStatus');
        const result = await getManusStatus({});
        const data = result.data as { isConnected: boolean };
        setManusConnected(data.isConnected);
      } catch {
        setManusConnected(false);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, [user]);

  const handleSaveApiKey = async () => {
    if (!manusApiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const saveKey = httpsCallable(functions, 'saveManusApiKey');
      await saveKey({ apiKey: manusApiKey.trim() });
      setManusConnected(true);
      setManusApiKey('');
      setMessage({ type: 'success', text: 'Manus conectado exitosamente. Ahora puedes ejecutar acciones con Manus.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Error al guardar API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saveKey = httpsCallable(functions, 'saveManusApiKey');
      await saveKey({ remove: true });
      setManusConnected(false);
      setMessage({ type: 'success', text: 'Manus desconectado.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Error al desconectar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Integraciones</h1>
              <p className="text-gray-500 text-sm mt-1">Conecta servicios externos para potenciar Always</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Cargando integraciones...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Manus Integration Card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-2xl">
                      🤖
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Manus AI</h3>
                      <p className="text-gray-400 text-sm">Ejecuta acciones automáticamente con inteligencia artificial</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    manusConnected
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {manusConnected ? 'Conectado' : 'No conectado'}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-400">
                  <p>Manus es un agente de IA que puede ejecutar tareas por ti: enviar emails, agendar reuniones, buscar información, crear documentos y más.</p>
                  <p className="mt-2">Cuando conectas Manus, las acciones detectadas en tus conversaciones mostrarán un botón para ejecutarlas automáticamente.</p>
                </div>

                {message && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    message.type === 'success'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    {message.text}
                  </div>
                )}

                {manusConnected ? (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">Tu API key está guardada de forma segura (encriptada)</span>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={saving}
                      className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-sm disabled:opacity-50"
                    >
                      {saving ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-6">
                    <label className="block text-sm text-gray-300 mb-2">API Key de Manus</label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        value={manusApiKey}
                        onChange={(e) => setManusApiKey(e.target.value)}
                        placeholder="Pega tu API key de Manus aquí..."
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        onClick={handleSaveApiKey}
                        disabled={saving || !manusApiKey.trim()}
                        className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {saving ? 'Guardando...' : 'Conectar'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Obtén tu API key en{' '}
                      <a href="https://manus.im/settings" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                        manus.im/settings
                      </a>
                      {' '}→ API → Create new
                    </p>
                  </div>
                )}
              </div>

              {/* Google Calendar (existing) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 opacity-60">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl">
                    📅
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Google Calendar</h3>
                    <p className="text-gray-400 text-sm">Sincroniza eventos con tus grabaciones</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-500">Configuración disponible en Perfil → Google Calendar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
