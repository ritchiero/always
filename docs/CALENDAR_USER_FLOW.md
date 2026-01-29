# 📅 Google Calendar Integration - User Experience Flow

Cómo experimentará el usuario la integración de calendario.

---

## 🎬 Escenario: Ricardo graba una reunión

### ANTES de la integración

```
09:45 AM - Ricardo tiene reunión con Carlos y María
10:00 AM - Empieza la reunión (en su calendario)
10:02 AM - Ricardo abre Always y empieza a grabar
10:30 AM - Termina la reunión, detiene la grabación

Resultado en Always:
┌─────────────────────────────────┐
│ 🔴 Grabación 10:02 AM          │
│ Duración: 28 min                │
│ Transcripción: "Hola, buenos... │
│ Status: Processed               │
│                                  │
│ Action Items:                   │
│ • Enviar propuesta al cliente   │
│   ❓ ¿A quién enviar?            │
│   ❓ ¿Cuál es su email?          │
└─────────────────────────────────┘
```

**Problema:** Ricardo tiene que recordar manualmente los detalles y buscar los emails.

---

### DESPUÉS de la integración

```
09:45 AM - Ricardo conecta su Google Calendar (una sola vez)
10:00 AM - Empieza la reunión (Always detecta el evento automáticamente)
10:02 AM - Ricardo abre Always y empieza a grabar
         - Always muestra: "📅 Recording: Reunión con Cliente Acme"
10:30 AM - Termina la reunión, detiene la grabación
         - Always automáticamente correlaciona la grabación con el evento

Resultado en Always:
┌─────────────────────────────────────────────────┐
│ 📅 Reunión con Cliente Acme                    │
│ 10:00 AM - 10:30 AM                            │
│ ────────────────────────────────────────────── │
│ 🔴 Grabación 10:02 AM (28 min)                 │
│                                                  │
│ 👥 Participantes:                               │
│ • Carlos Martínez (carlos@acmecorp.com)        │
│ • María López (maria@acmecorp.com)             │
│ • Ricardo Rodriguez (tú)                        │
│                                                  │
│ 📝 Transcripción: "Hola, buenos días Carlos... │
│                                                  │
│ ⚡ Action Items:                                │
│ • Enviar propuesta a Carlos y María            │
│   📧 carlos@acmecorp.com, maria@acmecorp.com   │
│   📅 Deadline: Viernes antes de 2pm            │
│   [🤖 Redactar Email]  ← Ya sabe a quién!     │
└─────────────────────────────────────────────────┘
```

**Beneficio:** 
- Contexto completo automáticamente
- Emails listos para usar
- Menos trabajo manual
- Mayor precisión

---

## 🔄 User Journey Completo

### Paso 1: Primera Configuración (Una sola vez)

```
Usuario                          Always                      Google
  │                                │                           │
  │── Abre Always ────────────────>│                           │
  │                                │                           │
  │<─── "Connect Calendar?" ───────│                           │
  │                                │                           │
  │── Click "Connect" ────────────>│                           │
  │                                │                           │
  │                                │──── OAuth redirect ──────>│
  │                                │                           │
  │<──────────────── Google Login Screen ─────────────────────│
  │                                                            │
  │── Login + Authorize ──────────────────────────────────────>│
  │                                                            │
  │<──────────────── Redirect back to Always ──────────────────│
  │                                │                           │
  │<─── "✓ Calendar Connected" ────│                           │
```

**Tiempo:** ~30 segundos  
**Frecuencia:** Una sola vez (o cuando tokens expiren)

### Paso 2: Sincronización Automática (Background)

```
Cada hora:
  Always ──── Fetch events ──────> Google Calendar
         <─── Return events ──────
         
  Always verifica:
  ✓ ¿Hay eventos nuevos?
  ✓ ¿Hay grabaciones sin correlacionar?
  ✓ ¿Alguna grabación coincide con evento?
  
  Si hay match:
    └─> Agrega participantes a la grabación
    └─> Enriquece action items con emails
```

**Tiempo:** Automático, invisible para el usuario  
**Frecuencia:** Cada hora (configurable)

### Paso 3: Grabación con Contexto

```
Usuario empieza grabación:

┌─────────────────────────────────────┐
│ 🎙️ Always                           │
├─────────────────────────────────────┤
│                                     │
│ 📅 Reunión detectada:               │
│    "Weekly Standup"                 │
│    10:00 AM - 10:30 AM             │
│                                     │
│ 👥 3 participantes                  │
│                                     │
│ [●]  Recording...  00:05:23         │
│                                     │
│ ▂▃▅▇ Voice activity                │
│                                     │
└─────────────────────────────────────┘
```

**Beneficio:** Usuario sabe que Always tiene el contexto completo

### Paso 4: Post-Grabación Enriquecida

```
Después de grabar:

┌──────────────────────────────────────────────┐
│ 📅 Weekly Standup                            │
│ ────────────────────────────────────────────│
│ 🔴 Grabación: 25 min                        │
│ 📝 Transcripción lista                       │
│ 🧠 Análisis completado                       │
│                                              │
│ 👥 Participantes:                            │
│ [AJ] Alex Johnson (alex@company.com)        │
│ [SM] Sarah Miller (sarah@company.com)       │
│ [RR] Ricardo Rodriguez (tú)                 │
│                                              │
│ 📊 Resumen:                                  │
│ "Equipo discutió el sprint actual..."       │
│                                              │
│ ⚡ Action Items Detectados:                 │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ ✉️  Enviar actualización del sprint  │   │
│ │ Para: Alex, Sarah                     │   │
│ │ Deadline: Mañana 5pm                  │   │
│ │                                        │   │
│ │ [🤖 Redactar Email] ← Click aquí     │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ 📅 Agendar próxima reunión            │   │
│ │ Con: Todo el equipo                   │   │
│ │ Cuándo: Próxima semana                │   │
│ │                                        │   │
│ │ [📅 Crear Evento] ← Click aquí       │   │
│ └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

**Beneficio:** 
- Todos los emails disponibles automáticamente
- Puede redactar email a Alex y Sarah con un click
- Contexto completo sin esfuerzo manual

### Paso 5: Redacción Asistida (Phase 7 + Calendar)

```
Usuario click en "Redactar Email":

┌──────────────────────────────────────────────┐
│ ✉️  Redactar Email                           │
├──────────────────────────────────────────────┤
│                                              │
│ Para: Alex Johnson, Sarah Miller            │
│       alex@company.com, sarah@company.com   │
│                                              │
│ Asunto: Sprint Update - Weekly Standup      │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ Hola Alex y Sarah,                    │   │
│ │                                        │   │
│ │ Siguiendo nuestra reunión de hoy,     │   │
│ │ aquí está el resumen del sprint:      │   │
│ │                                        │   │
│ │ • Feature X: En progreso (80%)        │   │
│ │ • Bug fixes: Completados              │   │
│ │ • Testing: Programado para mañana     │   │
│ │                                        │   │
│ │ Según lo discutido, enviaré el        │   │
│ │ reporte completo antes de mañana 5pm. │   │
│ │                                        │   │
│ │ Saludos,                              │   │
│ │ Ricardo                               │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ [📝 Editar] [✓ Aprobar y Enviar]            │
└──────────────────────────────────────────────┘
```

**Magia:** Always ya sabe:
- ✓ Los emails correctos (del calendario)
- ✓ Los nombres (del calendario)
- ✓ El contexto (de la transcripción)
- ✓ La reunión (del evento correlacionado)

---

## 💡 Smart Features Habilitados por Calendar

### 1. Auto-CC Participants

```
Action Item: "Enviar contrato"

SIN calendar:
└─> User tiene que recordar quién estaba en la reunión

CON calendar:
└─> Always automáticamente sugiere CC a todos los participantes
    "¿Enviar copia a Alex y Sarah también?"
```

### 2. Context-Aware Drafts

```
SIN calendar:
"Estimado cliente, ..."  ← Generic

CON calendar:
"Hola Alex, siguiendo nuestra reunión de hoy sobre el sprint..."  ← Personal + Contextual
```

### 3. Meeting Preparation

```
30 min antes de la reunión:

┌──────────────────────────────────┐
│ 📅 Próxima reunión en 30 min     │
│ "Cliente Acme - Propuesta"       │
│                                  │
│ 💡 Contexto disponible:          │
│ • Última reunión: 15 ene         │
│ • Temas discutidos: Presupuesto  │
│ • Action items pendientes: 2     │
│                                  │
│ [Ver Detalles] [Start Recording] │
└──────────────────────────────────┘
```

### 4. Follow-up Reminders

```
Al día siguiente de la reunión:

┌──────────────────────────────────┐
│ 📋 Follow-up Reminder             │
│                                  │
│ Reunión de ayer con Alex & Sarah │
│ tenía 3 action items:            │
│                                  │
│ ✓ Item 1: Completado             │
│ ⏳ Item 2: En progreso           │
│ ❗ Item 3: Pendiente (urgente)   │
│                                  │
│ [Ver Detalles] [Mark Done]       │
└──────────────────────────────────┘
```

---

## 🎨 UI States

### Connected State

```
┌─────────────────────────────────┐
│ Settings                         │
├─────────────────────────────────┤
│                                 │
│ 📅 Google Calendar              │
│ ┌─────────────────────────────┐ │
│ │ ✓ Connected                 │ │
│ │ ricardo.rodriguez@...       │ │
│ │ Last sync: 2 min ago        │ │
│ │                             │ │
│ │ [Disconnect] [Sync Now]     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Disconnected State

```
┌─────────────────────────────────┐
│ Settings                         │
├─────────────────────────────────┤
│                                 │
│ 📅 Google Calendar              │
│ ┌─────────────────────────────┐ │
│ │ Connect your calendar to    │ │
│ │ automatically add meeting   │ │
│ │ participants to recordings. │ │
│ │                             │ │
│ │ [Connect Google Calendar]   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Syncing State

```
┌─────────────────────────────────┐
│ Settings                         │
├─────────────────────────────────┤
│                                 │
│ 📅 Google Calendar              │
│ ┌─────────────────────────────┐ │
│ │ ✓ Connected                 │ │
│ │ ricardo.rodriguez@...       │ │
│ │                             │ │
│ │ 🔄 Syncing events...        │ │
│ │                             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Error State

```
┌─────────────────────────────────┐
│ Settings                         │
├─────────────────────────────────┤
│                                 │
│ 📅 Google Calendar              │
│ ┌─────────────────────────────┐ │
│ │ ⚠️ Connection issue         │ │
│ │ Unable to sync calendar     │ │
│ │                             │ │
│ │ [Reconnect] [Help]          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 📈 Value Proposition

### Time Saved

**Without Calendar:**
- 2 min recordando quién estaba en la reunión
- 3 min buscando emails en contactos
- 2 min escribiendo email desde cero
- **Total: ~7 min por reunión**

**With Calendar:**
- 0 min (automático)
- 0 min (ya están)
- 30 seg (revisar draft)
- **Total: ~30 seg por reunión**

**Ahorro: 6.5 min × 5 reuniones/día = 32.5 min/día**

### Accuracy Improvement

- ❌ Sin calendar: 40% de emails incorrectos o faltantes
- ✅ Con calendar: 95%+ de accuracy en participantes

### User Satisfaction

- 🙁 Sin calendar: "Tengo que buscar todo manualmente"
- 😊 Con calendar: "Always sabe exactamente qué hacer"

---

## 🚀 Future Enhancements

### V2: Bidirectional Sync
```
Action Item: "Agendar follow-up la próxima semana"
  ↓
[Crear Evento]
  ↓
Always crea evento EN Google Calendar
  ↓
Aparece en tu calendario real
```

### V3: Smart Scheduling
```
"Necesito reunirme con Alex y Sarah"
  ↓
Always revisa disponibilidad de todos
  ↓
Sugiere: "¿Jueves 2pm funciona para todos?"
```

### V4: Meeting Intelligence
```
Antes de la reunión:
"Ya tuviste 3 reuniones con este cliente.
 Aquí está el resumen de las últimas conversaciones..."
```

---

**Next Steps:** Implementar siguiendo CALENDAR_SETUP_CHECKLIST.md
