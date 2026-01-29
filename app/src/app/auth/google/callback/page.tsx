'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !currentUser) {
      // Wait for auth and mount
      return;
    }

    handleCallback();
  }, [searchParams, currentUser, mounted]);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      setStatus('error');
      setErrorMessage('Error de autorización de Google');
      setTimeout(() => {
        router.push('/settings?error=calendar_connection_failed');
      }, 2000);
      return;
    }

    // Check for missing code
    if (!code) {
      console.error('No code in callback');
      setStatus('error');
      setErrorMessage('Código de autorización no recibido');
      setTimeout(() => {
        router.push('/settings?error=no_code');
      }, 2000);
      return;
    }

    try {
      console.log('Exchanging code for tokens...');
      
      // Call Cloud Function to exchange code for tokens
      const connectCalendar = httpsCallable(functions, 'connectGoogleCalendar');
      const result = await connectCalendar({ code });
      
      console.log('Calendar connected successfully:', result);
      
      setStatus('success');
      
      // Redirect to settings with success message
      setTimeout(() => {
        router.push('/settings?success=calendar_connected');
      }, 1500);
      
    } catch (error: any) {
      console.error('Error connecting calendar:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Error al conectar calendario');
      
      setTimeout(() => {
        router.push('/settings?error=connection_failed');
      }, 2000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center max-w-md px-6">
        {status === 'processing' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Conectando tu calendario</h1>
            <p className="text-gray-400">
              Estamos configurando la integración con Google Calendar...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-400">¡Listo!</h1>
            <p className="text-gray-400">
              Tu calendario ha sido conectado exitosamente. Redirigiendo...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Error</h1>
            <p className="text-gray-400 mb-4">
              {errorMessage || 'Ocurrió un error al conectar tu calendario'}
            </p>
            <p className="text-sm text-gray-500">
              Redirigiendo a configuración...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center max-w-md px-6">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
