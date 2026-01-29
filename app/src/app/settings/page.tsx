'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { db, functions } from '@/lib/firebase';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = typeof window !== 'undefined' 
  ? `${window.location.origin}/auth/google/callback`
  : 'https://app-pi-one-84.vercel.app/auth/google/callback';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
  'profile'
].join(' ');

function SettingsContent() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Check URL params for success/error messages
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');
    
    if (errorParam) {
      setError(
        errorParam === 'calendar_connection_failed' 
          ? 'Error al conectar calendario. Por favor intenta nuevamente.' 
          : 'Ocurrió un error. Por favor intenta nuevamente.'
      );
    }
    
    if (successParam === 'calendar_connected') {
      setSuccess('✓ Calendario conectado exitosamente');
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [searchParams, mounted]);

  useEffect(() => {
    checkCalendarConnection();
  }, [currentUser]);

  const checkCalendarConnection = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const authDoc = await getDoc(
        doc(db, 'users', currentUser.uid, 'calendarAuth', 'google')
      );

      if (authDoc.exists()) {
        const data = authDoc.data();
        setIsCalendarConnected(data.isActive === true);
        setCalendarEmail(data.userEmail || '');
        setLastSync(data.lastSync?.toDate() || null);
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectCalendar = () => {
    const authUrl = 
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(CALENDAR_SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    window.location.href = authUrl;
  };

  const handleDisconnectCalendar = async () => {
    if (!currentUser) return;
    
    if (!confirm('¿Estás seguro de desconectar tu calendario?')) {
      return;
    }

    try {
      setLoading(true);
      const disconnectFn = httpsCallable(functions, 'disconnectGoogleCalendar');
      await disconnectFn();
      
      setIsCalendarConnected(false);
      setCalendarEmail('');
      setLastSync(null);
      setSuccess('Calendario desconectado');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error);
      setError('Error al desconectar calendario');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!currentUser) return;

    try {
      setIsSyncing(true);
      setError('');
      setSuccess('');
      
      const syncFn = httpsCallable(functions, 'syncCalendar');
      await syncFn();
      
      setSuccess('✓ Calendario sincronizado');
      setTimeout(() => setSuccess(''), 3000);
      
      // Refresh connection status
      await checkCalendarConnection();
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      setError('Error al sincronizar calendario');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Cargando configuración...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white p-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold">Configuración</h1>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Google Calendar Integration */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">📅</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Google Calendar</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Conecta tu calendario para agregar automáticamente participantes de reuniones 
                  a tus grabaciones. Mejora la precisión de los action items con emails correctos.
                </p>

                {isCalendarConnected ? (
                  <div className="space-y-4">
                    {/* Connected Status */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-green-400 font-medium mb-1 flex items-center gap-2">
                            <span className="text-lg">✓</span> Conectado
                          </p>
                          <p className="text-sm text-gray-300">{calendarEmail}</p>
                          {lastSync && (
                            <p className="text-xs text-gray-500 mt-2">
                              Última sincronización: {lastSync.toLocaleString('es-MX', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleSyncNow}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Sincronizar Ahora
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDisconnectCalendar}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
                      >
                        Desconectar
                      </button>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-xs text-blue-300">
                        <span className="font-medium">ℹ️ Sincronización automática:</span> Tu calendario se sincroniza 
                        cada hora automáticamente. Las grabaciones se correlacionan con eventos por timestamp.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Benefits */}
                    <div className="bg-white/5 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Detecta automáticamente participantes de reuniones</span>
                      </p>
                      <p className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Agrega emails correctos a action items</span>
                      </p>
                      <p className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Correlaciona grabaciones con eventos del calendario</span>
                      </p>
                      <p className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Ahorra tiempo al redactar emails (contexto completo)</span>
                      </p>
                    </div>

                    {/* Connect Button */}
                    <button
                      onClick={handleConnectCalendar}
                      className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/>
                      </svg>
                      Conectar Google Calendar
                    </button>

                    {/* Security Note */}
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                      <p className="text-xs text-orange-300">
                        <span className="font-medium">🔒 Seguridad:</span> Solo accedemos a la información 
                        de tus eventos (título, participantes, horario). Nunca modificamos o eliminamos 
                        eventos. Puedes desconectar en cualquier momento.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Future Settings Sections */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6 opacity-50">
            <h2 className="text-xl font-bold mb-2">Gmail Integration</h2>
            <p className="text-gray-400 text-sm">
              Próximamente: Envía emails directamente desde Always
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 opacity-50">
            <h2 className="text-xl font-bold mb-2">Notifications</h2>
            <p className="text-gray-400 text-sm">
              Próximamente: Configura notificaciones para action items
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
