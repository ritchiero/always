'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AnalisisPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'flujo' | 'ejemplo'>('flujo');

  useEffect(() => {
    const q = query(collection(db, 'recordings'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecordings(data);
    });
    return () => unsubscribe();
  }, []);

  const stats = {
    total: recordings.length,
    processed: recordings.filter(r => r.status === 'processed').length,
    errors: recordings.filter(r => r.status === 'process_error').length,
  };

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-black text-white py-6 px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-gray-500 hover:text-white text-sm mb-2 inline-block">
            ← Volver a Always
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-pink-500">🧠</span> Análisis Inteligente y Proactivo
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm ${
              stats.errors > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
              {stats.errors > 0 ? 'Con errores' : 'Operativo'}
            </span>
          </div>
          
          <div className="text-gray-400 mt-3 space-y-3">
            <p className="leading-relaxed">
              El sistema de análisis inteligente va más allá de simplemente resumir conversaciones. 
              Procesa automáticamente cada grabación de audio en el momento en que se guarda, utilizando 
              <span className="text-pink-400 font-medium"> GPT-4o-mini</span> para identificar 
              <span className="text-white font-medium"> acciones concretas que necesitan seguimiento</span>, 
              permitiendo a agentes y usuarios actuar de forma inmediata sobre los insights detectados.
            </p>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-300 font-medium mb-2">🎯 Objetivo: Análisis Orientado a la Acción</p>
              <p className="text-gray-300 text-sm leading-relaxed">
                En lugar de solo documentar lo que se dijo, el sistema identifica proactivamente qué necesita 
                hacerse después de cada conversación: correos por enviar, citas por agendar, personas por contactar, 
                documentos por revisar, o seguimientos pendientes.
              </p>
            </div>
            
            <p className="leading-relaxed">
              <span className="text-white font-medium text-lg">¿Qué información se extrae?</span>
            </p>
            
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 mt-1 text-xl">📝</span>
                <div>
                  <span className="text-white font-medium">Resumen Ejecutivo</span>
                  <p className="text-gray-400 text-sm mt-1">
                    Condensación de la conversación en 1-2 oraciones que capturan la esencia y el propósito 
                    de la interacción.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-3">
                <span className="text-purple-400 mt-1 text-xl">👥</span>
                <div>
                  <span className="text-white font-medium">Participantes</span>
                  <p className="text-gray-400 text-sm mt-1">
                    Identificación automática de personas involucradas, detectando nombres o asignando roles contextuales.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-3">
                <span className="text-cyan-400 mt-1 text-xl">🏷️</span>
                <div>
                  <span className="text-white font-medium">Temas Principales</span>
                  <p className="text-gray-400 text-sm mt-1">
                    Hasta 5 categorías que permiten organizar y buscar grabaciones por contenido temático.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-3 bg-green-500/5 border border-green-500/20 rounded-lg p-3 -ml-3">
                <span className="text-green-400 mt-1 text-xl">⚡</span>
                <div>
                  <span className="text-green-300 font-medium">Potenciales Acciones</span>
                  <p className="text-gray-300 text-sm mt-1">
                    El sistema detecta si se mencionaron compromisos o tareas. 
                    <span className="text-yellow-400"> No todas las conversaciones generan acciones</span> - 
                    muchas son solo informativas.
                  </p>
                  <p className="text-gray-300 text-sm mt-2">
                    <span className="text-white font-medium">Cuando sí hay acciones, identifica:</span>
                  </p>
                  <ul className="text-gray-400 text-sm mt-2 space-y-1 ml-4">
                    <li>• <span className="text-green-400">Correos por enviar</span> → A quién, contenido</li>
                    <li>• <span className="text-green-400">Reuniones por agendar</span> → Con quién, cuándo</li>
                    <li>• <span className="text-green-400">Llamadas de seguimiento</span> → Contactos, tema</li>
                    <li>• <span className="text-green-400">Documentos por revisar</span> → Qué archivos, quién</li>
                  </ul>
                </div>
              </li>
            </ul>
            
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mt-3">
              <p className="text-purple-300 font-medium mb-2">🚀 Análisis Proactivo</p>
              <p className="text-gray-300 text-sm leading-relaxed">
                El objetivo no es solo documentar, sino <span className="text-white font-medium">facilitar la acción inmediata</span>. 
                Cada análisis te dice exactamente qué hacer después de cada conversación.
              </p>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mt-4">
              <p className="text-orange-300 font-bold mb-3 flex items-center gap-2">
                🛡️ Principio de Confirmación Humana
              </p>
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                <span className="text-white font-medium">Nada se ejecuta automáticamente sin tu aprobación.</span> El sistema 
                detecta y estructura las acciones, pero <span className="text-orange-300">siempre pregunta antes de actuar</span>.
              </p>
              
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-orange-200 font-medium text-sm mb-2">Flujo de Confirmación:</p>
                <ol className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">1.</span>
                    <span>Sistema detecta acción (ej: enviar email a Carlos)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">2.</span>
                    <span>Te pregunta: <span className="text-white">&quot;¿Deseas que redacte el correo?&quot;</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">3.</span>
                    <span>Si dices <span className="text-green-400">Sí</span> → GPT-4o redacta el email completo con contexto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">4.</span>
                    <span>Te muestra el borrador editable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">5.</span>
                    <span><span className="text-white">Puedes dar feedback:</span> &quot;Hazlo más formal&quot;, &quot;Agrega X&quot;, &quot;Quita Y&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold">6.</span>
                    <span>Click en <span className="text-green-400">&quot;Aprobar y Enviar&quot;</span> → Ejecuta la acción</span>
                  </li>
                </ol>
              </div>
              
              <p className="text-gray-400 text-xs mt-3 italic">
                Este enfoque mantiene el control humano mientras maximiza la eficiencia al pre-redactar el contenido.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg mt-4 overflow-hidden">
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('flujo')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'flujo'
                      ? 'bg-white/10 text-white border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  📊 Flujo
                </button>
                <button
                  onClick={() => setActiveTab('ejemplo')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'ejemplo'
                      ? 'bg-white/10 text-white border-b-2 border-green-500'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  💡 Ejemplo
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'flujo' ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
                        <span className="text-blue-400 font-bold text-sm">1</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-blue-300 font-medium text-sm">🎤 Grabación Completada</p>
                          <p className="text-gray-400 text-xs mt-1">
                            Se guarda en Firestore con transcripción en tiempo real
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="text-gray-600 text-xl">↓</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/50">
                        <span className="text-purple-400 font-bold text-sm">2</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-purple-300 font-medium text-sm">⚡ Trigger Automático</p>
                          <p className="text-gray-400 text-xs mt-1">
                            Cloud Function se ejecuta instantáneamente
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="text-gray-600 text-xl">↓</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center border border-pink-500/50">
                        <span className="text-pink-400 font-bold text-sm">3</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
                          <p className="text-pink-300 font-medium text-sm">🧠 Análisis con GPT-4o-mini</p>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div className="bg-black/30 px-2 py-1 rounded text-gray-300">📝 Resumen</div>
                            <div className="bg-black/30 px-2 py-1 rounded text-gray-300">👥 Participantes</div>
                            <div className="bg-black/30 px-2 py-1 rounded text-gray-300">🏷️ Temas</div>
                            <div className="bg-black/30 px-2 py-1 rounded text-green-300 font-medium">⚡ Acciones</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="text-gray-600 text-xl">↓</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50">
                        <span className="text-yellow-400 font-bold text-sm">4</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                          <p className="text-yellow-300 font-medium text-sm">🔍 Detección de Acciones</p>
                          <p className="text-gray-400 text-xs mt-1">
                            ¿Se mencionaron compromisos o tareas?
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pl-11">
                      <div className="relative">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-green-400 text-xs">Sí ✓</div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                          <p className="text-green-300 font-medium text-xs mb-2">Acciones Detectadas</p>
                          <ul className="text-gray-400 text-xs space-y-1">
                            <li>✉️ Enviar email</li>
                            <li>📅 Agendar reunión</li>
                            <li>📞 Llamar</li>
                          </ul>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-gray-500 text-xs">No</div>
                        <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-3">
                          <p className="text-gray-300 font-medium text-xs mb-2">Sin Acciones</p>
                          <p className="text-gray-400 text-xs">
                            Campo vacío. Normal.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="text-gray-600 text-xl">↓</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">
                        <span className="text-green-400 font-bold text-sm">5</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                          <p className="text-green-300 font-medium text-sm">💾 Guardado</p>
                          <p className="text-gray-400 text-xs mt-1">
                            Disponible en toda la app (5-10s)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <span className="text-red-500">🔴</span> Grabación Original
                      </h4>
                      <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                        <p className="text-gray-300 text-sm leading-relaxed italic">
                          Hola María, habla Ricardo. Te llamo para confirmar la reunión de mañana con el 
                          cliente Acme Corporation a las 10 AM. Necesitamos revisar el contrato de servicios que 
                          te envié por correo ayer. Por favor trae las observaciones que tengas. Ah, y también 
                          recuérdame enviarle a Juan el reporte financiero del Q4 antes del viernes. Nos vemos mañana.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <span className="text-pink-500">🧠</span> Análisis Generado
                      </h4>
                      
                      <div className="space-y-2">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-blue-300 font-medium text-xs mb-1">📝 Resumen</p>
                          <p className="text-gray-300 text-sm">
                            Ricardo confirma reunión con Acme Corporation para revisar contrato de servicios 
                            y solicita preparación de documentos.
                          </p>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-purple-300 font-medium text-xs mb-2">👥 Participantes</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">Ricardo</span>
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">María</span>
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">Juan</span>
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">Cliente (Acme)</span>
                          </div>
                        </div>

                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                          <p className="text-cyan-300 font-medium text-xs mb-2">🏷️ Temas</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">Reunión cliente</span>
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">Contrato</span>
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">Reporte Q4</span>
                          </div>
                        </div>

                        <div className="bg-green-500/10 border-2 border-green-500/40 rounded-lg p-3">
                          <p className="text-green-300 font-medium text-xs mb-2">⚡ Acciones Detectadas</p>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-green-400">📅</span>
                              <div className="text-sm">
                                <p className="text-white font-medium">Reunión por confirmar</p>
                                <p className="text-gray-400 text-xs">
                                  Con: María y Acme Corp | Cuándo: Mañana 10 AM | Propósito: Revisar contrato
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <span className="text-green-400">📄</span>
                              <div className="text-sm">
                                <p className="text-white font-medium">Documento por revisar</p>
                                <p className="text-gray-400 text-xs">
                                  Qué: Contrato servicios | Enviado: Ayer | Quién: María (traer observaciones)
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <span className="text-green-400">✉️</span>
                              <div className="text-sm">
                                <p className="text-white font-medium">Correo por enviar</p>
                                <p className="text-gray-400 text-xs">
                                  A: Juan | Contenido: Reporte Q4 | Deadline: Antes del viernes
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <span className="text-blue-500">👁️</span> Cómo se Visualiza
                      </h4>
                      
                      <div className="bg-black/50 border border-white/20 rounded-lg p-3">
                        <div className="space-y-3">
                          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-2 font-medium">PANEL LATERAL</p>
                            <p className="text-gray-300 text-sm">
                              Ricardo confirma reunión con Acme Corporation...
                            </p>
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <p className="text-gray-500 text-xs mb-1">Topics:</p>
                              <div className="flex gap-1">
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Reunión</span>
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Contrato</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-2 font-medium">TAB SUMMARY</p>
                            <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                              <p className="text-green-300 font-medium text-xs mb-1">Action Items</p>
                              <ul className="space-y-1 text-gray-300 text-xs">
                                <li className="flex gap-1"><span className="text-green-400">✓</span> Confirmar reunión mañana 10 AM</li>
                                <li className="flex gap-1"><span className="text-green-400">✓</span> Revisar contrato servicios</li>
                                <li className="flex gap-1"><span className="text-green-400">✓</span> Enviar reporte Q4 a Juan</li>
                              </ul>
                            </div>
                          </div>

                          <div className="text-center text-xs text-gray-500 pt-2">
                            💡 3 acciones visibles de inmediato sin escuchar la grabación
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Flujo de Confirmación y Feedback */}
                    <div className="mt-6 pt-6 border-t border-white/20">
                      <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                        <span className="text-orange-400">🛡️</span> Flujo de Confirmación y Feedback
                      </h4>
                      
                      <div className="space-y-3">
                        {/* Paso 1: Click en botón */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-blue-300 font-medium text-sm mb-1">1️⃣ Usuario hace click en &quot;✉️ Abrir Email&quot;</p>
                          <p className="text-gray-400 text-xs">
                            En lugar de abrir mailto directamente, aparece modal de confirmación
                          </p>
                        </div>

                        {/* Paso 2: Modal de confirmación */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                          <p className="text-yellow-300 font-medium text-sm mb-2">2️⃣ Modal: &quot;¿Deseas que redacte el correo?&quot;</p>
                          <div className="bg-black/30 rounded p-2 text-xs space-y-2">
                            <p className="text-gray-300">Para: <span className="text-white">Carlos</span></p>
                            <p className="text-gray-300">Tema: <span className="text-white">Enviar reporte financiero Q4</span></p>
                            <p className="text-gray-300">Contexto: <span className="text-white">Reporte del cuarto trimestre</span></p>
                            <div className="flex gap-2 mt-2">
                              <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs">✓ Sí, redactar</button>
                              <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs">✕ No, cancelar</button>
                            </div>
                          </div>
                        </div>

                        {/* Paso 3: IA redacta */}
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                          <p className="text-purple-300 font-medium text-sm mb-2">3️⃣ GPT-4o redacta el email completo</p>
                          <div className="bg-black/30 rounded p-2 text-xs">
                            <p className="text-gray-500 mb-2">Borrador generado (editable):</p>
                            <p className="text-gray-300 leading-relaxed">
                              Hola Carlos,<br/><br/>
                              Espero te encuentres bien. Te contacto para solicitar el reporte financiero del Q4 que discutimos anteriormente.<br/><br/>
                              Necesito el documento antes del viernes para poder revisarlo...<br/><br/>
                              Saludos,<br/>
                              Ricardo
                            </p>
                          </div>
                        </div>

                        {/* Paso 4: Feedback */}
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                          <p className="text-cyan-300 font-medium text-sm mb-2">4️⃣ Usuario da feedback (opcional)</p>
                          <div className="bg-black/30 rounded p-2">
                            <input 
                              type="text" 
                              placeholder='Ej: &quot;Hazlo más formal&quot;, &quot;Agrega que es urgente&quot;'
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300"
                              disabled
                            />
                            <div className="flex gap-2 mt-2">
                              <button className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">🔄 Regenerar con feedback</button>
                              <button className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">Omitir feedback</button>
                            </div>
                          </div>
                        </div>

                        {/* Paso 5: Aprobar */}
                        <div className="bg-green-500/10 border-2 border-green-500/40 rounded-lg p-3">
                          <p className="text-green-300 font-medium text-sm mb-2">5️⃣ Aprobar y Ejecutar</p>
                          <div className="bg-black/30 rounded p-2">
                            <p className="text-gray-400 text-xs mb-2">Contenido final aprobado:</p>
                            <button className="w-full px-4 py-2 bg-green-500/30 text-green-300 rounded font-medium text-sm hover:bg-green-500/40 transition-colors">
                              ✓ Aprobar y Enviar Email
                            </button>
                          </div>
                          <p className="text-gray-400 text-xs mt-2">
                            Solo después de esta confirmación se ejecuta la acción real
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <p className="leading-relaxed text-sm pt-2 text-gray-500">
              Este proceso se ejecuta automáticamente con un tiempo de respuesta de 5-10 segundos por grabación.
            </p>
          </div>
        </div>

        {/* Plan de Implementación - Post-its Style */}
        <div className="mt-8 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-2 border-orange-500/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-orange-300 flex items-center gap-2">
              📌 Plan de Implementación
            </h2>
            <span className="text-xs text-gray-400 bg-black/30 px-2 py-1 rounded">Roadmap</span>
          </div>
          
          <p className="text-gray-300 text-sm mb-4">
            Pasos ordenados para lograr el sistema de análisis proactivo completo. 
            Incluye funcionalidades básicas de gestión antes de automatización avanzada.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Fase 1: Fundamentos */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-400 font-bold">FASE 1</span>
                <span className="text-xs text-gray-500">Fundamentos</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Configurar Cloud Functions</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Integrar GPT-4o-mini</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Trigger automático en onCreate</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Extraer campos básicos</span>
                </label>
              </div>
            </div>

            {/* Fase 2: Mejora del Prompt */}
            <div className="bg-white/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 2 ✓</span>
                <span className="text-xs text-gray-500">Prompt Inteligente</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Estructurar detección de acciones</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Categorizar tipos de acción (email, meeting, call, document)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Extraer metadata: a quién, cuándo, qué</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Agregar campo de prioridad (urgente/normal/baja)</span>
                </label>
              </div>
            </div>

            {/* Fase 3: Estructura de Datos */}
            <div className="bg-white/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 3 ✓</span>
                <span className="text-xs text-gray-500">Estructura de Datos</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Actualizar schema de actionItems</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Agregar campos: type, assignee, deadline, context</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-white">Crear colección separada para tasks (opcional)</span>
                </label>
              </div>
            </div>

            {/* Fase 4: UI/UX */}
            <div className="bg-white/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 4 ✓</span>
                <span className="text-xs text-gray-500">Interfaz</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Mostrar action items estructurados en UI</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Agregar botones de acción rápida (email, calendar)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                  <span className="text-sm text-white">Vista de lista de tareas pendientes (opcional)</span>
                </label>
              </div>
            </div>

            {/* Fase 5: Gestión de Grabaciones */}
            <div className="bg-white/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 5 ✓</span>
                <span className="text-xs text-gray-500">Gestión de Grabaciones</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Soft Delete: Marcar como eliminado (campo &quot;deletedAt&quot;)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Papelera: Vista de grabaciones eliminadas</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Recuperar: Restaurar grabación desde papelera</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Hard Delete: Eliminar permanentemente (después de 30 días)</span>
                </label>
              </div>
            </div>

            {/* Fase 6: Gestión de Action Items */}
            <div className="bg-white/5 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 6 ✓</span>
                <span className="text-xs text-gray-500">Gestión de Acciones</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Marcar acción como &quot;Completada&quot;</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Descartar acción: &quot;No aplica&quot; o &quot;Ya lo hice manualmente&quot;</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Archivar acciones completadas (no mostrar en lista activa)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-gray-300 line-through opacity-50">Estados: pending, completed, discarded</span>
                </label>
              </div>
            </div>

            {/* Fase 7: Sistema de Confirmación */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-orange-400 font-bold">FASE 7</span>
                <span className="text-xs text-gray-500">Sistema de Confirmación</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-orange-500" />
                  <span className="text-sm text-white">Modal de confirmación: &quot;¿Deseas que redacte el correo?&quot;</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-orange-500" />
                  <span className="text-sm text-white">Botones Sí/No antes de cualquier acción</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-orange-500" />
                  <span className="text-sm text-white">Generar draft del contenido (email/evento)</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-orange-500" />
                  <span className="text-sm text-white">Campo de feedback para editar antes de enviar</span>
                </label>
              </div>
            </div>

            {/* Fase 8: Redacción con IA */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-pink-400 font-bold">FASE 8</span>
                <span className="text-xs text-gray-500">Redacción Asistida</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-pink-500" />
                  <span className="text-sm text-white">GPT-4o redacta email completo con contexto</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-pink-500" />
                  <span className="text-sm text-white">Generar descripción de evento para calendar</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-pink-500" />
                  <span className="text-sm text-white">Vista previa editable del contenido</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-pink-500" />
                  <span className="text-sm text-white">Botón &quot;Aprobar y Enviar&quot;</span>
                </label>
              </div>
            </div>

            {/* Fase 7: Integraciones */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400 font-bold">FASE 7</span>
                <span className="text-xs text-gray-500">Integraciones</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-white">Integrar con Gmail API</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-white">Integrar con Google Calendar</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-white">Sincronizar con sistema de CRM</span>
                </label>
              </div>
            </div>

            {/* Fase 10: Automatización Completa */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400 font-bold">FASE 10</span>
                <span className="text-xs text-gray-500">Automatización Final</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-white">Envío real de emails tras confirmación</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-white">Creación real de eventos tras confirmación</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-white">Log de acciones ejecutadas</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                  <input type="checkbox" className="mt-0.5 accent-green-500" />
                  <span className="text-sm text-white">Historial de confirmaciones y feedback</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-black/30 border border-green-500/20 rounded-lg p-3">
            <p className="text-green-300 text-sm font-medium mb-1">📊 Progreso General</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-black/50 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-green-400 h-full" style={{width: '54%'}}></div>
              </div>
              <span className="text-white font-bold text-sm">20/37</span>
            </div>
            <p className="text-gray-300 text-xs mt-2">
              Fases 1-6 completadas ✓ | Siguiente: Sistema de confirmación (Fase 7)
            </p>
          </div>
          
          <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <p className="text-orange-300 font-medium text-sm flex items-center gap-2">
              🛡️ Garantía de Control Humano
            </p>
            <p className="text-gray-300 text-xs mt-2">
              <span className="text-white font-medium">Ninguna acción se ejecuta automáticamente.</span> El sistema 
              siempre pregunta, genera borradores editables, acepta feedback y espera aprobación final antes de 
              enviar emails, crear eventos o cualquier otra acción.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center text-gray-500 text-sm">
          <p>Always - Sistema de Análisis de Conversaciones</p>
          <p className="mt-1 text-xs">GPT-4o-mini | Cloud Function: processRecording</p>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
