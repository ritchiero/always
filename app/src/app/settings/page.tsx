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

// Integration cards data
const INTEGRATIONS = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Sync events and auto-detect meeting participants',
    status: 'active', // active | available | coming-soon
    category: 'productivity',
    benefits: [
      'Auto-detect meeting participants',
      'Add correct emails to action items',
      'Correlate recordings with calendar events',
      'Save time drafting follow-up emails'
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    description: 'Send recordings and action items to your Notion workspace',
    status: 'coming-soon',
    category: 'productivity',
    benefits: [
      'Auto-create pages for each recording',
      'Sync action items to your task database',
      'Build meeting minutes automatically',
      'Connect with your existing workflows'
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Share recordings and get notifications in Slack',
    status: 'coming-soon',
    category: 'communication',
    benefits: [
      'Share recording summaries to channels',
      'Get notified when action items are created',
      'Mention teammates directly',
      'Thread-based collaboration'
    ]
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: '⚡',
    description: 'Connect Always with 5,000+ apps',
    status: 'coming-soon',
    category: 'automation',
    benefits: [
      'Trigger zaps from new recordings',
      'Send action items anywhere',
      'Build custom workflows',
      'No-code automation'
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Send follow-up emails directly from Always',
    status: 'coming-soon',
    category: 'communication',
    benefits: [
      'Draft emails with AI from recordings',
      'Include relevant participants automatically',
      'Track email opens and responses',
      'Templates for common scenarios'
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: '🎯',
    description: 'Create issues from action items',
    status: 'coming-soon',
    category: 'productivity',
    benefits: [
      'Auto-create Linear issues',
      'Link recordings to issues',
      'Set priorities and assignees',
      'Keep product work organized'
    ]
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: '✅',
    description: 'Sync tasks with your Asana projects',
    status: 'coming-soon',
    category: 'productivity',
    benefits: [
      'Create Asana tasks from action items',
      'Add context from recordings',
      'Assign to team members',
      'Track completion'
    ]
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: '🔗',
    description: 'Build custom integrations with webhooks',
    status: 'coming-soon',
    category: 'automation',
    benefits: [
      'Receive real-time events',
      'Build custom integrations',
      'Connect to internal tools',
      'Full API access'
    ]
  }
];

function SettingsContent() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'all' | 'productivity' | 'communication' | 'automation'>('all');
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Migration states
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    migrated?: number;
    skipped?: number;
    message?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
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
      
      await checkCalendarConnection();
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      setError('Error al sincronizar calendario');
    } finally {
      setIsSyncing(false);
    }
  };

  // Migration handler
  const handleMigration = async () => {
    if (!currentUser) return;

    if (!confirm('¿Migrar grabaciones a la nueva estructura? Esto copiará tus grabaciones existentes a /users/{userId}/recordings.')) {
      return;
    }

    try {
      setIsMigrating(true);
      setMigrationResult(null);
      setError('');

      const migrateFn = httpsCallable(functions, 'migrateRecordingsToUser');
      const result = await migrateFn({});
      const data = result.data as {
        success: boolean;
        migrated?: number;
        skipped?: number;
        message?: string;
      };

      setMigrationResult(data);
      if (data.success) {
        setSuccess(`✓ ${data.message || 'Migración completada'}`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (error: any) {
      console.error('Error migrating:', error);
      setMigrationResult({
        success: false,
        error: error.message || 'Error en la migración',
      });
      setError('Error al migrar grabaciones');
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredIntegrations = INTEGRATIONS.filter(int => 
    activeTab === 'all' || int.category === activeTab
  );

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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Integraciones</h1>
              <p className="text-gray-500 text-sm mt-1">
                Conecta Always con tus herramientas favoritas
              </p>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 animate-pulse">
              <p className="text-green-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Category Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas', icon: '🔗' },
              { id: 'productivity', label: 'Productividad', icon: '⚡' },
              { id: 'communication', label: 'Comunicación', icon: '💬' },
              { id: 'automation', label: 'Automatización', icon: '🤖' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredIntegrations.map(integration => {
              const isGoogleCalendar = integration.id === 'google-calendar';
              const isConnected = isGoogleCalendar && isCalendarConnected;

              return (
                <div
                  key={integration.id}
                  className={`border rounded-lg p-6 transition-all ${
                    integration.status === 'active'
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/5 bg-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-4xl">{integration.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-bold">{integration.name}</h3>
                        {integration.status === 'coming-soon' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                            Próximamente
                          </span>
                        )}
                        {isConnected && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                            ✓ Conectado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{integration.description}</p>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-2 mb-4">
                    {integration.benefits.map((benefit, i) => (
                      <p key={i} className="text-xs text-gray-400 flex items-start gap-2">
                        <span className="text-green-400 flex-shrink-0">✓</span>
                        <span>{benefit}</span>
                      </p>
                    ))}
                  </div>

                  {/* Action Button */}
                  {isGoogleCalendar && integration.status === 'active' && (
                    <div>
                      {isConnected ? (
                        <div className="space-y-3">
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                            <p className="text-xs text-gray-300">{calendarEmail}</p>
                            {lastSync && (
                              <p className="text-xs text-gray-500 mt-1">
                                Última sincronización: {lastSync.toLocaleString('es-MX', {
                                  dateStyle: 'short',
                                  timeStyle: 'short'
                                })}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSyncNow}
                              disabled={isSyncing}
                              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                              {isSyncing ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
                            </button>
                            <button
                              onClick={handleDisconnectCalendar}
                              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Desconectar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleConnectCalendar}
                          className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                        >
                          Conectar
                        </button>
                      )}
                    </div>
                  )}

                  {integration.status === 'coming-soon' && (
                    <button
                      disabled
                      className="w-full px-4 py-2 bg-white/5 text-gray-500 rounded-lg cursor-not-allowed text-sm"
                    >
                      Próximamente
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Request Integration */}
          <div className="mt-8 bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span>💡</span> ¿Necesitas otra integración?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Estamos construyendo más integraciones. Dinos cuál necesitas y la priorizaremos.
            </p>
            <a
              href="mailto:ricardo.rodriguez@getlawgic.com?subject=Solicitud de integración Always"
              className="inline-block px-6 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm font-medium"
            >
              Solicitar integración
            </a>
          </div>

          {/* Developer Tools Section */}
          <div className="mt-8 bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span>🛠️</span> Developer Tools
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Herramientas de desarrollo y migración de datos.
            </p>

            {/* Migration Tool */}
            <div className="bg-black/30 border border-gray-700 rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <span>📦</span> Migración de Datos
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                Migra grabaciones de la estructura legacy (/recordings) a la nueva estructura user-scoped (/users/userId/recordings).
              </p>

              {migrationResult && (
                <div className={`mb-3 p-3 rounded-lg text-sm ${
                  migrationResult.success
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {migrationResult.success ? (
                    <>
                      <p className="font-medium">✓ Migración exitosa</p>
                      <p className="text-xs mt-1">
                        {migrationResult.migrated} grabaciones migradas
                        {migrationResult.skipped ? `, ${migrationResult.skipped} omitidas` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">✗ Error en migración</p>
                      <p className="text-xs mt-1">{migrationResult.error}</p>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handleMigration}
                disabled={isMigrating}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isMigrating ? '⏳ Migrando...' : '🚀 Ejecutar Migración'}
              </button>
            </div>
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
