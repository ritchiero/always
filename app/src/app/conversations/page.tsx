'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import ConversationCard from '@/components/ConversationCard';

interface Conversation {
      id: string;
      title: string;
      summary: string;
      startTime: Date;
      endTime: Date;
      participants: string[];
      topics: string[];
      sentiment: string;
      actionItems?: string[];
      keyDecisions?: string[];
      followUps?: string[];
}

export default function ConversationsPage() {
      const { user, loading: authLoading } = useAuth();
      const [conversations, setConversations] = useState<Conversation[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);

  useEffect(() => {
          if (authLoading) return;

                if (!user) {
                          setLoading(false);
                          return;
                }

                const fetchConversations = async () => {
                          try {
                                      const conversationsRef = collection(db, 'users', user.uid, 'conversations');
                                      const q = query(conversationsRef, orderBy('startTime', 'desc'));
                                      const snapshot = await getDocs(q);

                            const convos = snapshot.docs.map(doc => ({
                                          id: doc.id,
                                          ...doc.data(),
                                          startTime: doc.data().startTime?.toDate() || new Date(),
                                          endTime: doc.data().endTime?.toDate() || new Date(),
                            })) as Conversation[];

                            setConversations(convos);
                          } catch (err) {
                                      console.error('Error fetching conversations:', err);
                                      setError('Error al cargar las conversaciones');
                          } finally {
                                      setLoading(false);
                          }
                };

                fetchConversations();
  }, [user, authLoading]);

  if (authLoading || loading) {
          return (
                    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                            <div className="text-center">
                                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>div>
                                      <p>Cargando conversaciones...</p>p>
                            </div>div>
                    </div>div>
                  );
  }
    
      if (!user) {
              return (
                        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                                <p className="text-gray-400">Debes iniciar sesión para ver tus conversaciones</p>p>
                        </div>div>
                      );
      }
    
      if (error) {
              return (
                        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                                <p className="text-red-400">{error}</p>p>
                        </div>div>
                      );
      }
    
      return (
              <div className="min-h-screen bg-gray-900 text-white p-6">
                    <div className="max-w-7xl mx-auto">
                            <h1 className="text-3xl font-bold mb-8">Mis Conversaciones</h1>h1>
                            
                        {conversations.length === 0 ? (
                            <div className="text-center py-12">
                                        <p className="text-gray-400 mb-4">No hay conversaciones consolidadas aún</p>p>
                                        <p className="text-sm text-gray-500">
                                                      Las conversaciones se consolidan automáticamente después de 5 minutos de silencio
                                        </p>p>
                            </div>div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {conversations.map((conversation) => (
                                              <ConversationCard key={conversation.id} conversation={conversation} />
                                            ))}
                            </div>div>
                            )}
                    </div>div>
              </div>div>
            );
}</div>
