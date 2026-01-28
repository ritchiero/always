'use client';

import { useState, useEffect } from 'react';
import { db, functions } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';

export default function AnalisisPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'recordings'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecordings(data);
    });
    return () => unsubscribe();
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const reprocessAll = async () => {
    setIsReprocessing(true);
    setLogs([]);
    addLog('Iniciando reprocesamiento...');

    try {
      const reprocessFn = httpsCallable(functions, 'reprocessUnanalyzedRecordings');
      addLog('Llamando a Cloud Function: reprocessUnanalyzedRecordings');
      const result = await reprocessFn();
      setReprocessResult(result.data);
      addLog(`Resultado: ${JSON.stringify(result.data)}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  const stats = {
    total: recordings.length,
    processed: recordings.filter(r => r.status === 'processed').length,
    pending: recordings.filter(r => r.status && r.status !== 'processed' && r.status !== 'process_error').length,
    errors: recordings.filter(r => r.status === 'process_error').length,
    noStatus: recordings.filter(r => !r.status).length,
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-gray-500 hover:text-white text-sm mb-2 inline-block">
              ← Volver a Always
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-pink-500">🧠</span> Análisis con GPT-4o-mini
            </h1>
            <p className="text-gray-500 mt-2">Documentación técnica y estado del sistema de análisis automático</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${
              stats.errors > 0 ? 'bg-red-500/20 text-red-400' :
              stats.pending > 0 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {stats.errors > 0 ? 'Con errores' : stats.pending > 0 ? 'En progreso' : 'Operativo'}
            </span>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.processed}</div>
            <div className="text-xs text-gray-500">Procesados</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-gray-500">Pendientes</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.errors}</div>
            <div className="text-xs text-gray-500">Errores</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-400">{stats.noStatus}</div>
            <div className="text-xs text-gray-500">Sin estado</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Documentation */}
          <div className="space-y-6">
            {/* Qué es */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                <span>📋</span> ¿Qué es?
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                El sistema de análisis automático procesa cada grabación de audio transcrita
                y extrae información estructurada usando <strong className="text-pink-400">GPT-4o-mini</strong>.
                Esto permite obtener insights sin intervención manual.
              </p>
            </div>

            {/* Flujo Paso a Paso */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                <span>🔄</span> Flujo Paso a Paso
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">1</div>
                  <div>
                    <h3 className="font-medium text-white">Trigger: Firestore onCreate</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Cuando se crea un documento en <code className="bg-white/10 px-1 rounded">recordings/</code>,
                      la función <code className="bg-white/10 px-1 rounded">processRecording</code> se ejecuta automáticamente.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">2</div>
                  <div>
                    <h3 className="font-medium text-white">Validación de Transcripción</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Se verifica que el documento tenga una transcripción válida
                      (no vacía, no "(sin transcripción)").
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">3</div>
                  <div>
                    <h3 className="font-medium text-white">Llamada a GPT-4o-mini</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Se envía la transcripción con un prompt estructurado para extraer:
                    </p>
                    <ul className="text-sm text-gray-500 mt-2 space-y-1 ml-4">
                      <li>• <strong className="text-gray-300">summary</strong>: Resumen breve (1-2 oraciones)</li>
                      <li>• <strong className="text-gray-300">participants</strong>: Lista de participantes</li>
                      <li>• <strong className="text-gray-300">topics</strong>: Temas principales (máx 5)</li>
                      <li>• <strong className="text-gray-300">actionItems</strong>: Tareas/compromisos</li>
                      <li>• <strong className="text-gray-300">sentiment</strong>: Tono (positive/neutral/negative)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">4</div>
                  <div>
                    <h3 className="font-medium text-white">Parseo de Respuesta</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Se limpia la respuesta (quita markdown) y se parsea el JSON.
                      Si falla, se usa un objeto por defecto.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">5</div>
                  <div>
                    <h3 className="font-medium text-white">Actualización en Firestore</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Se actualiza el documento con el campo <code className="bg-white/10 px-1 rounded">analysis</code>
                      y se cambia <code className="bg-white/10 px-1 rounded">status</code> a "processed".
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Actual */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <span>💬</span> Prompt Actual
              </h2>
              <div className="bg-black/50 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                <pre>{`// System Message
Eres un asistente que analiza transcripciones de conversaciones/reuniones.
Extrae información estructurada de la transcripción proporcionada.
Responde SOLO con JSON válido, sin markdown ni explicaciones.

// User Message
Analiza esta transcripción y extrae:
1. summary: Resumen breve (1-2 oraciones)
2. participants: Lista de participantes inferidos
3. topics: Temas principales (máximo 5)
4. actionItems: Tareas mencionadas
5. sentiment: Tono general (positive, neutral, negative)

Transcripción:
"{transcript}"

JSON:`}</pre>
              </div>
            </div>

            {/* Estructura de Datos */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                <span>📊</span> Estructura de Datos
              </h2>
              <div className="bg-black/50 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
                <pre>{`// Documento en Firestore: recordings/{id}
{
  // Campos existentes
  transcript: { text: "..." },
  duration: 120,
  createdAt: Timestamp,

  // Campos añadidos por el análisis
  status: "processed" | "process_error",
  analysis: {
    summary: "Resumen de la conversación...",
    participants: ["Speaker 1", "Speaker 2"],
    topics: ["Tema 1", "Tema 2"],
    actionItems: ["Tarea 1", "Tarea 2"],
    sentiment: "neutral",
    processedAt: Timestamp,
    model: "gpt-4o-mini"
  },
  processError?: "Error message if failed"
}`}</pre>
              </div>
            </div>
          </div>

          {/* Right Column - Live Data & Actions */}
          <div className="space-y-6">
            {/* Acciones */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                <span>🚀</span> Acciones
              </h2>
              <div className="space-y-3">
                <button
                  onClick={reprocessAll}
                  disabled={isReprocessing}
                  className="w-full px-4 py-3 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {isReprocessing ? '⏳ Procesando...' : '🔄 Reprocesar Grabaciones Pendientes'}
                </button>

                <a
                  href="https://console.firebase.google.com/project/always-f6dda/functions/logs?search=processRecording"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm font-medium text-center"
                >
                  📊 Ver Logs en Firebase
                </a>
              </div>

              {/* Console Log */}
              {logs.length > 0 && (
                <div className="mt-4 bg-black/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-mono space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-gray-400">{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {reprocessResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  reprocessResult.failed === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  <strong>Resultado:</strong> {reprocessResult.processed}/{reprocessResult.total} procesados
                  {reprocessResult.failed > 0 && ` (${reprocessResult.failed} fallidos)`}
                </div>
              )}
            </div>

            {/* Grabaciones Recientes */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
                <span>📝</span> Grabaciones Recientes
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recordings.slice(0, 10).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRecording(selectedRecording?.id === rec.id ? null : rec)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedRecording?.id === rec.id ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 truncate flex-1">
                        {rec.transcript?.text?.substring(0, 40) || rec.id}...
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ml-2 ${
                        rec.status === 'processed' ? 'bg-green-500/20 text-green-400' :
                        rec.status === 'process_error' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {rec.status || 'sin estado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalle de Grabación Seleccionada */}
            {selectedRecording && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                  <span>🔍</span> Detalle: {selectedRecording.id.substring(0, 8)}...
                </h2>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-2 ${
                      selectedRecording.status === 'processed' ? 'text-green-400' :
                      selectedRecording.status === 'process_error' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {selectedRecording.status || 'N/A'}
                    </span>
                  </div>

                  {selectedRecording.transcript?.text && (
                    <div>
                      <span className="text-gray-500 block mb-1">Transcripción:</span>
                      <p className="text-gray-300 bg-black/30 p-2 rounded text-xs">
                        {selectedRecording.transcript.text.substring(0, 200)}...
                      </p>
                    </div>
                  )}

                  {selectedRecording.analysis && (
                    <div>
                      <span className="text-gray-500 block mb-1">Análisis:</span>
                      <div className="bg-black/30 p-3 rounded space-y-2">
                        <div>
                          <span className="text-pink-400 text-xs">Summary:</span>
                          <p className="text-gray-300 text-xs">{selectedRecording.analysis.summary || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-cyan-400 text-xs">Participants:</span>
                          <p className="text-gray-300 text-xs">{selectedRecording.analysis.participants?.join(', ') || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-yellow-400 text-xs">Topics:</span>
                          <p className="text-gray-300 text-xs">{selectedRecording.analysis.topics?.join(', ') || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-green-400 text-xs">Sentiment:</span>
                          <p className="text-gray-300 text-xs">{selectedRecording.analysis.sentiment || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecording.processError && (
                    <div>
                      <span className="text-red-400 block mb-1">Error:</span>
                      <p className="text-red-300 bg-red-500/10 p-2 rounded text-xs">
                        {selectedRecording.processError}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Problemas Conocidos */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                <span>⚠️</span> Problemas Conocidos
              </h2>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>La API key de OpenAI tenía un newline - solucionado con <code className="bg-white/10 px-1 rounded text-xs">.trim()</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>Lazy initialization necesaria para secrets de Firebase</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>El campo <code className="bg-white/10 px-1 rounded text-xs">summary</code> está en <code className="bg-white/10 px-1 rounded text-xs">analysis.summary</code>, no en <code className="bg-white/10 px-1 rounded text-xs">summary</code></span>
                </li>
              </ul>
            </div>

            {/* Próximos Pasos */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-indigo-400 mb-4 flex items-center gap-2">
                <span>📌</span> Próximos Pasos
              </h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-300">Verificar que processRecording funciona con nueva key</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-300">Mostrar analysis.summary en la UI principal</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-300">Agregar embeddings a Pinecone post-análisis</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-300">Implementar retry automático para errores</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-300">Agregar métricas de costo de API</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
          <p>Always - Sistema de Análisis de Conversaciones</p>
          <p className="mt-1">Modelo: GPT-4o-mini | Cloud Function: processRecording</p>
        </div>
      </div>
    </div>
  );
}
