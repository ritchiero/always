'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

// Emails autorizados para acceso
const AUTHORIZED_EMAILS: string[] = [
    'ricardo.rodriguez@getlawgic.com',
    'ribarra@lawgic.com.mx',
  ];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthorized: boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar si el email está autorizado
  const checkAuthorization = (email: string | null): boolean => {
    if (!email) return false; return AUTHORIZED_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
  };

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    console.log('[Auth] Setting up auth state listener...');

    // Verificar que auth esté inicializado
    if (!auth) {
      console.error('[Auth] Firebase auth not initialized!');
      setLoading(false);
      setError('Error de configuración: Firebase Auth no está inicializado');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] Auth state changed:', firebaseUser ? firebaseUser.email : 'No user');

      if (firebaseUser) {
        // Verificar si el email está autorizado
        if (checkAuthorization(firebaseUser.email)) {
          console.log('[Auth] User authorized:', firebaseUser.email);
          setUser(firebaseUser);
          setError(null);
        } else {
          // Email no autorizado - cerrar sesión automáticamente
          console.log('[Auth] User NOT authorized:', firebaseUser.email);
          await signOut(auth);
          setUser(null);
          setError('Acceso denegado. Este email no está autorizado para usar esta aplicación.');
        }
      } else {
        console.log('[Auth] No user signed in');
        setUser(null);
      }
      setLoading(false);
    }, (error) => {
      // Error handler para onAuthStateChanged
      console.error('[Auth] Auth state error:', error);
      setError('Error al verificar autenticación: ' + error.message);
      setLoading(false);
    });

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Sign in con Google
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);

      // Verificar autorización
      if (!checkAuthorization(result.user.email)) {
        await signOut(auth);
        throw new Error('Acceso denegado. Este email no está autorizado para usar esta aplicación.');
      }
    } catch (err: any) {
      console.error('Error en Google Sign-In:', err);
      setError(err.message || 'Error al iniciar sesión con Google');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign in con Email/Password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      // Verificar autorización antes de intentar login
      if (!checkAuthorization(email)) {
        throw new Error('Acceso denegado. Este email no está autorizado para usar esta aplicación.');
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Error en Email Sign-In:', err);
      let errorMessage = 'Error al iniciar sesión';

      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este email';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign up con Email/Password
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      // Verificar autorización antes de crear cuenta
      if (!checkAuthorization(email)) {
        throw new Error('Acceso denegado. Este email no está autorizado para crear una cuenta.');
      }

      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Error en Sign-Up:', err);
      let errorMessage = 'Error al crear cuenta';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Ya existe una cuenta con este email';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      console.error('Error en logout:', err);
      setError(err.message || 'Error al cerrar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar error
  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    isAuthorized: user !== null && checkAuthorization(user.email),
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
