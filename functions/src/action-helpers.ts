/**
 * action-helpers.ts
 * Helper functions for generating and executing action item drafts
 */

import OpenAI from 'openai';

/**
 * Genera un draft de email usando GPT-4o basado en el contexto
 */
export async function generateEmailDraft(
  openai: OpenAI,
  action: {
    description: string;
    assignee?: string;
    context?: string;
    deadline?: string;
  },
  transcriptText: string
): Promise<string> {
  const prompt = `Eres un asistente experto en redacción de correos profesionales.

Basándote en la siguiente conversación transcrita y la acción detectada, redacta un correo electrónico completo y profesional.

TRANSCRIPCIÓN:
${transcriptText}

ACCIÓN DETECTADA:
- Para: ${action.assignee || 'Destinatario'}
- Descripción: ${action.description}
${action.deadline ? `- Deadline: ${action.deadline}` : ''}
${action.context ? `- Contexto: ${action.context}` : ''}

INSTRUCCIONES:
1. Redacta un email completo con saludo, cuerpo y despedida
2. Usa un tono profesional pero amigable
3. Sé claro y conciso
4. Incluye todos los detalles relevantes mencionados en la conversación
5. Si hay un deadline, menciónalo claramente
6. NO inventes información que no esté en la transcripción

FORMATO DE SALIDA (texto plano, sin markdown):
Asunto: [título descriptivo]

[Saludo]

[Cuerpo del mensaje]

[Despedida]
[Nombre del remitente]`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente experto en redacción profesional. Generas emails claros, concisos y con toda la información necesaria.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Genera un draft de evento de calendario usando GPT-4o
 */
export async function generateCalendarEventDraft(
  openai: OpenAI,
  action: {
    description: string;
    assignee?: string;
    context?: string;
    deadline?: string;
  },
  transcriptText: string
): Promise<string> {
  const prompt = `Basándote en la siguiente conversación y la reunión detectada, genera los detalles para un evento de calendario.

TRANSCRIPCIÓN:
${transcriptText}

REUNIÓN DETECTADA:
- Con: ${action.assignee || 'Participantes'}
- Descripción: ${action.description}
${action.deadline ? `- Cuándo: ${action.deadline}` : ''}
${action.context ? `- Contexto: ${action.context}` : ''}

Genera:
1. Título conciso del evento
2. Descripción detallada
3. Lista de participantes sugeridos
4. Duración estimada
5. Agenda/topics a cubrir

NO inventes información que no esté en la transcripción.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente experto en organización de reuniones profesionales.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Regenera un draft con feedback del usuario
 */
export async function regenerateDraftWithFeedback(
  openai: OpenAI,
  previousDraft: string,
  feedback: string
): Promise<string> {
  const prompt = `BORRADOR ANTERIOR:
${previousDraft}

FEEDBACK DEL USUARIO:
${feedback}

Por favor, regenera el contenido aplicando el feedback del usuario. Mantén el formato y estructura, pero incorpora los cambios solicitados.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente que mejora contenido basándose en feedback específico del usuario.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Genera draft para otros tipos de acciones (call, document, followup)
 */
export async function generateGenericActionDraft(
  openai: OpenAI,
  actionType: string,
  action: {
    description: string;
    assignee?: string;
    context?: string;
    deadline?: string;
  },
  transcriptText: string
): Promise<string> {
  const typeLabels: Record<string, string> = {
    call: 'llamada',
    document: 'revisión de documento',
    followup: 'seguimiento',
    other: 'acción'
  };

  const prompt = `Basándote en la conversación transcrita, genera un resumen estructurado para esta ${typeLabels[actionType]}.

TRANSCRIPCIÓN:
${transcriptText}

ACCIÓN:
- Tipo: ${typeLabels[actionType]}
- Con/Para: ${action.assignee || 'No especificado'}
- Descripción: ${action.description}
${action.deadline ? `- Deadline: ${action.deadline}` : ''}
${action.context ? `- Contexto: ${action.context}` : ''}

Genera un resumen que incluya:
1. Propósito de la acción
2. Pasos específicos a realizar
3. Información clave de la conversación relevante para esta acción
4. Resultado esperado`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente que estructura información de conversaciones para facilitar acciones de seguimiento.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  return completion.choices[0]?.message?.content || '';
}
