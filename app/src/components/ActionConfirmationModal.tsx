'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface ActionConfirmationModalProps {
  action: {
    type: string;
    description: string;
    assignee?: string;
    deadline?: string;
    context?: string;
    priority?: string;
  };
  recordingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ActionConfirmationModal({ 
  action, 
  recordingId, 
  onClose, 
  onSuccess 
}: ActionConfirmationModalProps) {
  const [step, setStep] = useState<'confirm' | 'draft' | 'feedback' | 'approve'>('confirm');
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabels: Record<string, string> = {
    email: 'Correo Electrónico',
    meeting: 'Evento de Calendario',
    call: 'Llamada',
    document: 'Documento',
    followup: 'Seguimiento',
    other: 'Acción'
  };

  const typeIcons: Record<string, string> = {
    email: '✉️',
    meeting: '📅',
    call: '📞',
    document: '📄',
    followup: '🔄',
    other: '📌'
  };

  // Paso 1: Confirmar si quiere que redactemos
  const handleConfirmDraft = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Llamar a Cloud Function para generar draft
      const generateDraft = httpsCallable(functions, 'generateActionDraft');
      const result = await generateDraft({
        recordingId,
        action,
      });

      const data = result.data as { draft: string };
      setDraft(data.draft);
      setStep('draft');
    } catch (err: any) {
      console.error('Error generando draft:', err);
      setError(err.message || 'Error al generar borrador');
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2: Regenerar con feedback
  const handleRegenerateWithFeedback = async () => {
    if (!feedback.trim()) {
      setStep('approve');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const regenerateDraft = httpsCallable(functions, 'generateActionDraft');
      const result = await regenerateDraft({
        recordingId,
        action,
        previousDraft: draft,
        feedback: feedback.trim(),
      });

      const data = result.data as { draft: string };
      setDraft(data.draft);
      setFeedback(''); // Limpiar feedback
      setStep('approve');
    } catch (err: any) {
      console.error('Error regenerando draft:', err);
      setError(err.message || 'Error al regenerar borrador');
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 3: Ejecutar acción
  const handleExecuteAction = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Llamar a Cloud Function para ejecutar la acción
      const executeAction = httpsCallable(functions, 'executeAction');
      await executeAction({
        recordingId,
        action,
        draft,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error ejecutando acción:', err);
      setError(err.message || 'Error al ejecutar acción');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-6xl mb-3">{typeIcons[action.type]}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                ¿Deseas que redacte {typeLabels[action.type].toLowerCase()}?
              </h3>
              <p className="text-gray-400 text-sm">
                El sistema puede generar un borrador completo basado en el contexto de la conversación
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-sm font-medium">Para:</span>
                <span className="text-white text-sm">{action.assignee || 'No especificado'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 text-sm font-medium">Descripción:</span>
                <span className="text-gray-300 text-sm">{action.description}</span>
              </div>
              {action.deadline && (
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 text-sm font-medium">Deadline:</span>
                  <span className="text-gray-300 text-sm">{action.deadline}</span>
                </div>
              )}
              {action.context && (
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 text-sm font-medium">Contexto:</span>
                  <span className="text-gray-300 text-sm">{action.context}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDraft}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generando...' : '✓ Sí, redactar'}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                ✕ No, cancelar
              </button>
            </div>
          </div>
        );

      case 'draft':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span>{typeIcons[action.type]}</span>
                Borrador Generado
              </h3>
              <p className="text-gray-400 text-sm">
                Revisa el contenido generado. Puedes dar feedback para mejorarlo.
              </p>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {draft}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Feedback (opcional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder='Ej: "Hazlo más formal", "Agrega X", "Quita Y"...'
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              {feedback.trim() ? (
                <button
                  onClick={handleRegenerateWithFeedback}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Regenerando...' : '🔄 Regenerar con feedback'}
                </button>
              ) : (
                <button
                  onClick={() => setStep('approve')}
                  className="flex-1 px-4 py-3 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-medium hover:bg-green-500/30 transition-colors"
                >
                  ✓ Continuar a aprobación
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-3 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg font-medium hover:bg-gray-500/30 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        );

      case 'approve':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Aprobar y Ejecutar
              </h3>
              <p className="text-gray-400 text-sm">
                Revisa el contenido final antes de ejecutar la acción
              </p>
            </div>

            <div className="bg-black/50 border border-green-500/20 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {draft}
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <p className="text-orange-300 text-sm font-medium mb-1">
                ⚠️ Esta acción se ejecutará inmediatamente
              </p>
              <p className="text-gray-400 text-xs">
                {action.type === 'email' && 'Se enviará el correo electrónico'}
                {action.type === 'meeting' && 'Se creará el evento en tu calendario'}
                {action.type === 'call' && 'Se registrará la llamada por hacer'}
                {action.type === 'document' && 'Se registrará el documento por revisar'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleExecuteAction}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-green-500/30 text-green-300 border-2 border-green-500/50 rounded-lg font-bold hover:bg-green-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Ejecutando...' : '✓ Aprobar y Enviar'}
              </button>
              <button
                onClick={() => setStep('draft')}
                disabled={isLoading}
                className="px-4 py-3 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg font-medium hover:bg-gray-500/30 transition-colors disabled:opacity-50"
              >
                ← Volver
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-black/95 border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-blue-500' : 'bg-gray-600'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'draft' ? 'bg-blue-500' : 'bg-gray-600'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'approve' ? 'bg-blue-500' : 'bg-gray-600'}`} />
          </div>

          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
