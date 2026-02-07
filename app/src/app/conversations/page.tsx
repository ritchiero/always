'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import ConversationCard from '@/components/ConversationCard';
import { MessageSquare, Loader2, AlertCircle } from 'lucide-react';

export default function ConversationsPage() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

  useEffect(() => {
        if (!user) {
                setLoading(false);
                return;
        }

                try {
                        const conversationsQuery = query(
                                  collection(db, `users/${user.uid}/conversations`),
                                  orderBy('startTime', 'desc'),
                                  limit(50)
                                );

          const unsubscribe = onSnapshot(
                    conversationsQuery,
                    (snapshot) => {
                                const convos = snapshot.docs.map(doc => ({
                                              id: doc.id,
                                              ...doc.data()
                                }));

                      console.log('[Conversations] Loaded:', convos.length);
                                setConversations(convos);
                                setLoading(false);
                                setError(null);
                    },
                    (err) => {
                                console.error('[Conversations] Error:', err);
                                setError('Error al cargar conversaciones');
                                setLoading(false);
                    }
                  );

          return () => unsubscribe();
                } catch (err: any) {
                        console.error('[Conversations] Setup error:', err);
                        setError('Error al configurar listener');
                        setLoading(false);
                }
  }, [user]);

  if (!user) {
        return (
                <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center">
                                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                  <p className="text-gray-400">Debes iniciar sesión para ver tus conversaciones</p>p>
                        </div>div>
                </div>div>
              );
  }
  
    if (loading) {
          return (
                  <div className="flex items-center justify-center min-h-screen">
                          <div className="text-center">
                                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                                    <p className="text-gray-400">Cargando conversaciones...</p>p>
                          </div>div>
                  </div>div>
                );
    }
  
    if (error) {
          return (
                  <div className="flex items-center justify-center min-h-screen">
                          <div className="text-center">
                                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-red-400">{error}</p>p>
                          </div>div>
                  </div>div>
                );
    }
  
    return (
          <div className="min-h-screen bg-black text-white p-6">
                <div className="max-w-7xl mx-auto">
                        <div className="mb-8">
                                  <div className="flex items-center gap-3 mb-2">
                                              <MessageSquare className="w-8 h-8 text-blue-400" />
                                              <h1 className="text-3xl font-bold">Conversaciones</h1>h1>
                                  </div>div>
                                  <p className="text-gray-400">
                                    {conversations.length} conversación{conversations.length !== 1 ? 'es' : ''} consolidada{conversations.length !== 1 ? 's' : ''}
                                  </p>p>
                        </div>div>
                
                  {conversations.length === 0 ? (
                      <div className="text-center py-20">
                                  <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                  <h3 className="text-xl text-gray-400 mb-2">No hay conversaciones consolidadas</h3>h3>
                                  <p className="text-sm text-gray-500">
                                                Las conversaciones se consolidan automáticamente después de 5 minutos de inactividad
                                  </p>p>
                      </div>div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {conversations.map((conversation) => (
                                      <ConversationCard key={conversation.id} conversation={conversation} />
                                    ))}
                      </div>div>
                        )}
                </div>div>
          </div>div>
        );
}</div>
