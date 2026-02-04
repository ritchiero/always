'use client';

import { useState, useEffect } from 'react';
import { recoverRecording, hardDeleteRecording, onDeletedRecordingsChange } from '@/lib/firebase';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function PapeleraPage() {
    const { user } = useAuth();
    const [deletedRecordings, setDeletedRecordings] = useState<any[]>([]);
    const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
    const [recordingToHardDelete, setRecordingToHardDelete] = useState<any>(null);

  useEffect(() => {
        if (!user) {
                setDeletedRecordings([]);
                return;
        }

                // Use the user-scoped function from firebase.ts
                const unsubscribe = onDeletedRecordingsChange((recordings) => {
                        setDeletedRecordings(recordings);
                });

                return () => unsubscribe();
  }, [user]);

  const calculateDaysRemaining = (deletedAt: any) => {
        if (!deletedAt) return 30;
        const deleted = deletedAt.toDate();
        const now = new Date();
        const daysPassed = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - daysPassed);
  };

  const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Desconocido';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
        });
  };

  const handleRecover = async (recordingId: string) => {
        try {
                await recoverRecording(recordingId);
                console.log('Grabación recuperada');
        } catch (error) {
                console.error('Error al recuperar:', error);
                alert('Error al recuperar la grabación');
        }
  };

  const handleHardDelete = async () => {
        if (!recordingToHardDelete) return;

        try {
                await hardDeleteRecording(recordingToHardDelete.id);
                console.log('Grabación eliminada permanentemente');
                setShowHardDeleteModal(false);
                setRecordingToHardDelete(null);
        } catch (error) {
                console.error('Error al eliminar permanentemente:', error);
                alert('Error al eliminar la grabación');
        }
  };

  return (
        <ProtectedRoute>
              <div className="min-h-screen bg-black text-white py-6 px-8">
                      <div className="max-w-4xl mx-auto">
                                <div className="mb-6">
                                            <Link href="/" className="text-gray-500 hover:text-white text-sm mb-2 inline-block">
                                                          ← Volver a Always
                                            </Link>Link>
                                            <div className="flex items-center justify-between">
                                                          <h1 className="text-3xl font-bold flex items-center gap-3">
                                                                          <span>📦</span>span>
                                                                          Papelera
                                                          </h1>h1>
                                                          <span className="text-sm text-gray-400">
                                                            {deletedRecordings.length} elemento(s)
                                                          </span>span>
                                            </div>div>
                                            <p className="text-gray-400 mt-2">
                                                          Las grabaciones eliminadas se conservan 30 días antes de eliminarse permanentemente.
                                            </p>p>
                                </div>div>
                      
                        {deletedRecordings.length === 0 ? (
                      <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                                    <span className="text-4xl">📦</span>span>
                                    </div>div>
                                    <p className="text-gray-500">La papelera está vacía</p>p>
                                    <p className="text-xs text-gray-600 mt-1">Las grabaciones eliminadas aparecerán aquí</p>p>
                      </div>div>
                    ) : (
                      <div className="space-y-3">
                        {deletedRecordings.map((recording) => {
                                        const daysRemaining = calculateDaysRemaining(recording.deletedAt);
                                        const isUrgent = daysRemaining <= 3;
                                        
                                        return (
                                                            <div
                                                                                  key={recording.id}
                                                                                  className={`bg-white/5 border rounded-lg p-4 ${
                                                                                                          isUrgent ? 'border-red-500/50' : 'border-white/10'
                                                                                    }`}
                                                                                >
                                                                                <div className="flex items-start justify-between gap-4">
                                                                                                      <div className="flex-1">
                                                                                                                              <div className="flex items-start gap-2 mb-2">
                                                                                                                                                        <span className="text-xs text-gray-500">
                                                                                                                                                          {formatDate(recording.createdAt)}
                                                                                                                                                          </span>span>
                                                                                                                                {isUrgent && (
                                                                                                              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                                                                                                                            ⚠️ {daysRemaining} día{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}
                                                                                                                </span>span>
                                                                                                                                                        )}
                                                                                                                                </div>div>
                                                                                                      
                                                                                                        {recording.transcript?.text && (
                                                                                                            <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                                                                                                              {recording.transcript.text.substring(0, 150)}...
                                                                                                              </p>p>
                                                                                                                              )}
                                                                                                      
                                                                                                                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                                                                                                                                        <span>Eliminado: {formatDate(recording.deletedAt)}</span>span>
                                                                                                                                {!isUrgent && (
                                                                                                              <span className="text-gray-600">
                                                                                                                {daysRemaining} días restantes
                                                                                                                </span>span>
                                                                                                                                                        )}
                                                                                                                                </div>div>
                                                                                                      
                                                                                                        {recording.analysis?.actionItems && recording.analysis.actionItems.length > 0 && (
                                                                                                            <div className="mt-2 text-xs text-yellow-400">
                                                                                                                                        📋 {recording.analysis.actionItems.length} acción(es) asociada(s)
                                                                                                              </div>div>
                                                                                                                              )}
                                                                                                        </div>div>
                                                                                
                                                                                                      <div className="flex flex-col gap-2">
                                                                                                                              <button
                                                                                                                                                          onClick={() => handleRecover(recording.id)}
                                                                                                                                                          className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors text-sm font-medium flex items-center gap-1"
                                                                                                                                                        >
                                                                                                                                                        ♻️ Recuperar
                                                                                                                                </button>button>
                                                                                                                              <button
                                                                                                                                                          onClick={() => {
                                                                                                                                                                                        setRecordingToHardDelete(recording);
                                                                                                                                                                                        setShowHardDeleteModal(true);
                                                                                                                                                            }}
                                                                                                                                                          className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm font-medium flex items-center gap-1"
                                                                                                                                                        >
                                                                                                                                                        🗑️ Eliminar Forever
                                                                                                                                </button>button>
                                                                                                        </div>div>
                                                                                  </div>div>
                                                            </div>div>
                                                          );
                      })}
                      </div>div>
                                )}
                      
                        {/* Hard Delete Confirmation Modal */}
                        {showHardDeleteModal && recordingToHardDelete && (
                      <div 
                                      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                                      onClick={() => setShowHardDeleteModal(false)}
                                    >
                                    <div 
                                                      className="bg-gray-900 border border-red-500/50 rounded-xl p-6 max-w-md w-full mx-4"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                    <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Eliminación Permanente</h3>h3>
                                                    <p className="text-gray-300 mb-4">
                                                                      Esta acción es <span className="text-red-400 font-bold">IRREVERSIBLE</span>span>. 
                                                                      La grabación y su audio se eliminarán permanentemente.
                                                    </p>p>
                                                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                                                                      <p className="text-sm text-gray-300 line-clamp-2">
                                                                        {recordingToHardDelete.transcript?.text?.substring(0, 100) || recordingToHardDelete.id}...
                                                                      </p>p>
                                                    </div>div>
                                                    <div className="flex gap-3">
                                                                      <button
                                                                                            onClick={handleHardDelete}
                                                                                            className="flex-1 px-4 py-2 bg-red-500/30 text-red-300 rounded-lg hover:bg-red-500/40 transition-colors font-bold"
                                                                                          >
                                                                                          Eliminar Permanentemente
                                                                      </button>button>
                                                                      <button
                                                                                            onClick={() => {
                                                                                                                    setShowHardDeleteModal(false);
                                                                                                                    setRecordingToHardDelete(null);
                                                                                              }}
                                                                                            className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors font-medium"
                                                                                          >
                                                                                          Cancelar
                                                                      </button>button>
                                                    </div>div>
                                    </div>div>
                      </div>div>
                                )}
                      </div>div>
              </div>div>
        </ProtectedRoute>ProtectedRoute>
      );
}</ProtectedRoute>
