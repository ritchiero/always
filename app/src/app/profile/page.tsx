'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Link from 'next/link';

interface UserProfile {
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  context: string;
  reportTone: 'professional' | 'friendly' | 'concise';
  language: 'es' | 'en';
  timezone: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    role: '',
    company: '',
    industry: '',
    bio: '',
    context: '',
    reportTone: 'friendly',
    language: 'es',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'profile', 'main');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setSuccess(false);

    try {
      const docRef = doc(db, 'users', user.uid, 'profile', 'main');
      await setDoc(docRef, {
        ...profile,
        updatedAt: new Date()
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error al guardar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Cargando perfil...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-3xl mx-auto">
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
              <h1 className="text-3xl font-bold">Mi Perfil</h1>
              <p className="text-gray-500 text-sm mt-1">
                Ayuda a Always a conocerte mejor para generar resúmenes personalizados
              </p>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Perfil guardado exitosamente
              </p>
            </div>
          )}

          {/* Profile Form */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>👤</span> Información Básica
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Tu nombre completo"
                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Rol / Posición
                  </label>
                  <input
                    type="text"
                    value={profile.role}
                    onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                    placeholder="Ej: Product Manager, Abogado, Consultor..."
                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                      placeholder="Nombre de tu empresa"
                      className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Industria
                    </label>
                    <input
                      type="text"
                      value={profile.industry}
                      onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                      placeholder="Ej: Tech, Legal, Educación, Salud..."
                      className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bio & Context */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>📝</span> Sobre Ti
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Bio (2-3 frases sobre ti)
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Describe brevemente quién eres y a qué te dedicas (2-3 frases)"
                    rows={3}
                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Contexto adicional (¿Qué usa Always para? ¿Qué temas típicamente grabas?)
                  </label>
                  <textarea
                    value={profile.context}
                    onChange={(e) => setProfile({ ...profile, context: e.target.value })}
                    placeholder="Ej: Uso Always para reuniones con clientes, sesiones de trabajo, llamadas con el equipo, etc."
                    rows={4}
                    className="w-full px-4 py-2 bg-black border border-white/20 rounded-lg text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>⚙️</span> Preferencias de Reportes
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Tono de resúmenes diarios
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setProfile({ ...profile, reportTone: 'professional' })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        profile.reportTone === 'professional'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-black border-white/20 text-gray-400 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">💼</div>
                      <div className="text-sm font-medium">Profesional</div>
                    </button>

                    <button
                      onClick={() => setProfile({ ...profile, reportTone: 'friendly' })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        profile.reportTone === 'friendly'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-black border-white/20 text-gray-400 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">😊</div>
                      <div className="text-sm font-medium">Amigable</div>
                    </button>

                    <button
                      onClick={() => setProfile({ ...profile, reportTone: 'concise' })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        profile.reportTone === 'concise'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-black border-white/20 text-gray-400 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">⚡</div>
                      <div className="text-sm font-medium">Conciso</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Idioma
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setProfile({ ...profile, language: 'es' })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        profile.language === 'es'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-black border-white/20 text-gray-400 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">🇪🇸</div>
                      <div className="text-sm font-medium">Español</div>
                    </button>

                    <button
                      onClick={() => setProfile({ ...profile, language: 'en' })}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        profile.language === 'en'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-black border-white/20 text-gray-400 hover:border-white/40'
                      }`}
                    >
                      <div className="text-2xl mb-1">🇺🇸</div>
                      <div className="text-sm font-medium">English</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <span className="font-medium">💡 ¿Para qué se usa esto?</span>
                <br />
                Always genera resúmenes diarios personalizados basados en tu perfil.
                Entre más contexto proporciones, más relevantes serán tus resúmenes.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Perfil
                  </>
                )}
              </button>

              <Link
                href="/"
                className="px-6 py-3 bg-white/5 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors font-medium"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
