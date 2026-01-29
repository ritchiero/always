# 📅 Google Calendar Integration - Arquitectura Completa

**Fecha:** Enero 29, 2026  
**Estado:** Planeación - Fase 9  
**Objetivo:** Sincronizar calendario para enriquecer contexto de grabaciones

---

## 🎯 Objetivos

### Primarios
1. **Leer eventos del día** automáticamente
2. **Correlacionar grabaciones con reuniones** por timestamp
3. **Extraer participantes** para contexto en análisis
4. **Enriquecer action items** con emails de participantes

### Secundarios
1. Mostrar próximos eventos en UI
2. Crear eventos nuevos desde action items (Fase 10)
3. Sincronizar bidireccionalmente (futuro)

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                         ALWAYS APP                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─── OAuth 2.0 Flow ───┐
                              │                        │
                              ▼                        ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │  Google Calendar │    │   User Calendar  │
                    │       API        │◄───┤     Events       │
                    └──────────────────┘    └──────────────────┘
                              │
                              ├─── Token Management ───┐
                              │                         │
                              ▼                         ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │  Firebase Auth   │    │   Firestore DB   │
                    │   + OAuth Flow   │    │  tokens/events   │
                    └──────────────────┘    └──────────────────┘
                              │
                              ├─── Processing ───┐
                              │                   │
                              ▼                   ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │  Cloud Function  │    │   Recording      │
                    │  correlateEvents │    │   + Event Data   │
                    └──────────────────┘    └──────────────────┘
```

---

## 🔐 OAuth 2.0 Flow

### Setup Inicial (Una vez)

```bash
# 1. Google Cloud Console
https://console.cloud.google.com/

# 2. Habilitar APIs
- Google Calendar API
- Google People API (para contacts después)

# 3. Crear OAuth 2.0 Client
Type: Web application
Name: Always App - Calendar Integration
Authorized redirect URIs:
  - https://app-pi-one-84.vercel.app/auth/google/callback
  - http://localhost:3000/auth/google/callback (dev)

# 4. Obtener credenciales
Client ID: <generated>
Client Secret: <generated>

# 5. Configurar en Firebase
firebase functions:config:set google.client_id="xxx" google.client_secret="yyy"
```

### Scopes Necesarios

```javascript
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',  // Leer calendario
  'https://www.googleapis.com/auth/calendar.events',    // Crear eventos (Fase 10)
  'openid',                                             // Identificación
  'email',                                              // Email del usuario
  'profile'                                             // Info básica
];
```

### Flow Diagram

```
Usuario                    App                     Google              Firestore
  │                         │                        │                    │
  │─── Click "Connect" ────>│                        │                    │
  │                         │── Generate OAuth URL ──>│                    │
  │<──── Redirect ──────────│                        │                    │
  │                                                   │                    │
  │─────── Login + Authorize ──────────────────────>│                    │
  │                                                   │                    │
  │<──────── Redirect with code ─────────────────────│                    │
  │                         │                        │                    │
  │── Send code ───────────>│                        │                    │
  │                         │── Exchange code ──────>│                    │
  │                         │<─ Access + Refresh ────│                    │
  │                         │                        │                    │
  │                         │────── Store tokens ─────────────────────────>│
  │                         │                        │                    │
  │<─── Success ────────────│                        │                    │
```

---

## 💾 Estructura de Datos

### Firestore Collections

#### `/users/{userId}/calendarAuth`
```javascript
{
  accessToken: string,           // Token de acceso (expires in 1hr)
  refreshToken: string,          // Token para renovar (long-lived)
  expiresAt: Timestamp,          // Cuando expira el accessToken
  scope: string,                 // Scopes otorgados
  tokenType: 'Bearer',
  
  // Metadata
  connectedAt: Timestamp,
  lastSync: Timestamp,
  calendarId: string,            // primary calendar ID
  userEmail: string,
  
  // Status
  isActive: boolean,
  lastError: string | null
}
```

#### `/users/{userId}/calendarEvents`
```javascript
{
  eventId: string,               // Google Calendar event ID
  calendarId: string,
  
  // Event data
  summary: string,               // Título del evento
  description: string,
  location: string,
  
  // Time
  startTime: Timestamp,
  endTime: Timestamp,
  timeZone: string,
  
  // Participants
  organizer: {
    email: string,
    name: string,
    self: boolean
  },
  attendees: [
    {
      email: string,
      displayName: string,
      responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction',
      optional: boolean
    }
  ],
  
  // Links
  meetingUrl: string | null,     // Google Meet, Zoom, etc.
  htmlLink: string,              // Link al evento en Google Calendar
  
  // Metadata
  status: 'confirmed' | 'tentative' | 'cancelled',
  visibility: 'default' | 'public' | 'private',
  createdAt: Timestamp,
  updatedAt: Timestamp,
  syncedAt: Timestamp,           // Última sync con Google
  
  // Correlation
  correlatedRecordings: [
    {
      recordingId: string,
      matchScore: number,        // 0-1, confianza del match
      matchedBy: 'time' | 'manual' | 'ai'
    }
  ]
}
```

#### Update en `/recordings/{recordingId}`
```javascript
{
  // ... existing fields ...
  
  // NEW: Calendar correlation
  correlatedEvent: {
    eventId: string,
    summary: string,
    participants: [
      {
        email: string,
        name: string
      }
    ],
    startTime: Timestamp,
    matchScore: number
  } | null
}
```

---

## ⚙️ Cloud Functions

### 1. `connectGoogleCalendar` (HTTPS Callable)

**Trigger:** Usuario hace click en "Connect Calendar"

```typescript
export const connectGoogleCalendar = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // Verificar auth
    if (!context.auth) throw new HttpsError('unauthenticated');
    
    const userId = context.auth.uid;
    const { code } = data; // OAuth code from redirect
    
    // 1. Exchange code for tokens
    const tokens = await oauth2Client.getToken(code);
    
    // 2. Get user's calendar info
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(c => c.primary);
    
    // 3. Store tokens in Firestore
    await db.collection('users').doc(userId)
      .collection('calendarAuth').doc('google').set({
        accessToken: tokens.tokens.access_token,
        refreshToken: tokens.tokens.refresh_token,
        expiresAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + (tokens.tokens.expiry_date || 3600000)
        ),
        scope: tokens.tokens.scope,
        tokenType: tokens.tokens.token_type,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        calendarId: primaryCalendar?.id,
        userEmail: primaryCalendar?.summary,
        isActive: true
      });
    
    // 4. Trigger initial sync
    await syncCalendarEvents({ userId });
    
    return { success: true };
  });
```

### 2. `syncCalendarEvents` (Scheduled + Callable)

**Trigger:** Cron (cada hora) + Manual

```typescript
export const syncCalendarEvents = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .pubsub.schedule('every 1 hours')
  .onRun(async (context) => {
    // Obtener todos los usuarios con calendar conectado
    const usersSnapshot = await db.collectionGroup('calendarAuth')
      .where('isActive', '==', true)
      .get();
    
    const syncPromises = usersSnapshot.docs.map(doc => {
      const userId = doc.ref.parent.parent!.id;
      return syncUserCalendar(userId);
    });
    
    await Promise.all(syncPromises);
  });

async function syncUserCalendar(userId: string) {
  try {
    // 1. Get auth tokens
    const authDoc = await db.collection('users').doc(userId)
      .collection('calendarAuth').doc('google').get();
    
    if (!authDoc.exists) return;
    
    const auth = authDoc.data()!;
    
    // 2. Check token expiry, refresh if needed
    if (auth.expiresAt.toMillis() < Date.now()) {
      await refreshAccessToken(userId);
      // Re-fetch updated tokens
      return syncUserCalendar(userId);
    }
    
    // 3. Get events from today and next 7 days
    const calendar = google.calendar({ 
      version: 'v3', 
      auth: getOAuthClient(auth.accessToken)
    });
    
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: weekFromNow.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50
    });
    
    // 4. Store/update events in Firestore
    const batch = db.batch();
    
    events.data.items?.forEach(event => {
      const eventRef = db.collection('users').doc(userId)
        .collection('calendarEvents').doc(event.id!);
      
      batch.set(eventRef, {
        eventId: event.id,
        calendarId: 'primary',
        summary: event.summary,
        description: event.description,
        location: event.location,
        startTime: admin.firestore.Timestamp.fromDate(
          new Date(event.start?.dateTime || event.start?.date!)
        ),
        endTime: admin.firestore.Timestamp.fromDate(
          new Date(event.end?.dateTime || event.end?.date!)
        ),
        timeZone: event.start?.timeZone,
        organizer: event.organizer,
        attendees: event.attendees || [],
        meetingUrl: event.hangoutLink || extractMeetingUrl(event.description),
        htmlLink: event.htmlLink,
        status: event.status,
        visibility: event.visibility,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        syncedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    
    await batch.commit();
    
    // 5. Update last sync time
    await authDoc.ref.update({
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 6. Trigger correlation with recordings
    await correlateEventsWithRecordings(userId);
    
  } catch (error) {
    console.error('Error syncing calendar for user', userId, error);
    
    // Store error in auth doc
    await db.collection('users').doc(userId)
      .collection('calendarAuth').doc('google').update({
        lastError: error.message,
        isActive: error.code === 401 ? false : true // Disable if auth failed
      });
  }
}
```

### 3. `correlateEventsWithRecordings` (Background)

**Trigger:** Después de sync + onCreate de recording

```typescript
async function correlateEventsWithRecordings(userId: string) {
  // 1. Get today's events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  const eventsSnapshot = await db.collection('users').doc(userId)
    .collection('calendarEvents')
    .where('startTime', '>=', admin.firestore.Timestamp.fromDate(todayStart))
    .where('startTime', '<=', admin.firestore.Timestamp.fromDate(todayEnd))
    .get();
  
  // 2. Get today's recordings (not deleted)
  const recordingsSnapshot = await db.collection('recordings')
    .where('userId', '==', userId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
    .where('deletedAt', '==', null)
    .get();
  
  // 3. Match recordings to events by timestamp
  const matches: Array<{recording: any, event: any, score: number}> = [];
  
  recordingsSnapshot.docs.forEach(recDoc => {
    const recording = { id: recDoc.id, ...recDoc.data() };
    const recTime = recording.createdAt.toMillis();
    
    eventsSnapshot.docs.forEach(eventDoc => {
      const event = eventDoc.data();
      const eventStart = event.startTime.toMillis();
      const eventEnd = event.endTime.toMillis();
      
      // Match if recording started within 15 min before/after event start
      const timeDiff = Math.abs(recTime - eventStart);
      const fifteenMin = 15 * 60 * 1000;
      
      if (timeDiff < fifteenMin) {
        // Score based on proximity (closer = higher score)
        const score = 1 - (timeDiff / fifteenMin);
        matches.push({ recording, event, score });
      }
      
      // Also match if recording started during event
      if (recTime >= eventStart && recTime <= eventEnd) {
        matches.push({ recording, event, score: 0.9 });
      }
    });
  });
  
  // 4. Apply matches (keep highest score per recording)
  const batch = db.batch();
  
  const recordingBestMatches = new Map<string, any>();
  matches.forEach(match => {
    const existing = recordingBestMatches.get(match.recording.id);
    if (!existing || match.score > existing.score) {
      recordingBestMatches.set(match.recording.id, match);
    }
  });
  
  recordingBestMatches.forEach((match, recordingId) => {
    const recRef = db.collection('recordings').doc(recordingId);
    
    batch.update(recRef, {
      correlatedEvent: {
        eventId: match.event.eventId,
        summary: match.event.summary,
        participants: match.event.attendees.map((a: any) => ({
          email: a.email,
          name: a.displayName
        })),
        startTime: match.event.startTime,
        matchScore: match.score
      }
    });
    
    // Also update event with correlation
    const eventRef = db.collection('users').doc(userId)
      .collection('calendarEvents').doc(match.event.eventId);
    
    batch.update(eventRef, {
      correlatedRecordings: admin.firestore.FieldValue.arrayUnion({
        recordingId,
        matchScore: match.score,
        matchedBy: 'time'
      })
    });
  });
  
  await batch.commit();
  
  console.log(`Correlated ${recordingBestMatches.size} recordings with events`);
}
```

### 4. `refreshAccessToken` (Helper)

```typescript
async function refreshAccessToken(userId: string) {
  const authDoc = await db.collection('users').doc(userId)
    .collection('calendarAuth').doc('google').get();
  
  if (!authDoc.exists) return;
  
  const auth = authDoc.data()!;
  
  // Use refresh token to get new access token
  oauth2Client.setCredentials({
    refresh_token: auth.refreshToken
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  // Update tokens in Firestore
  await authDoc.ref.update({
    accessToken: credentials.access_token,
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + (credentials.expiry_date || 3600000)
    ),
    lastError: null
  });
}
```

---

## 🎨 Frontend Integration

### 1. Calendar Connection UI

**Location:** Settings page or Profile

```tsx
// app/src/app/settings/page.tsx

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  useEffect(() => {
    // Check if calendar is connected
    const checkConnection = async () => {
      const authDoc = await db.collection('users').doc(currentUser.uid)
        .collection('calendarAuth').doc('google').get();
      
      if (authDoc.exists) {
        const data = authDoc.data();
        setIsConnected(data.isActive);
        setCalendarEmail(data.userEmail);
        setLastSync(data.lastSync?.toDate());
      }
    };
    
    checkConnection();
  }, []);
  
  const handleConnect = () => {
    // Redirect to OAuth flow
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = SCOPES.join(' ');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    window.location.href = authUrl;
  };
  
  const handleDisconnect = async () => {
    await db.collection('users').doc(currentUser.uid)
      .collection('calendarAuth').doc('google').update({
        isActive: false
      });
    
    setIsConnected(false);
  };
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Calendar Integration</h2>
      
      {isConnected ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 font-medium">✓ Connected</p>
              <p className="text-sm text-gray-400">{calendarEmail}</p>
              {lastSync && (
                <p className="text-xs text-gray-500 mt-1">
                  Last synced: {lastSync.toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <p className="text-gray-400 mb-4">
            Connect your Google Calendar to automatically add meeting participants to your recordings.
          </p>
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect Google Calendar
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2. OAuth Callback Handler

```tsx
// app/src/app/auth/google/callback/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      
      if (error) {
        console.error('OAuth error:', error);
        router.push('/settings?error=calendar_connection_failed');
        return;
      }
      
      if (!code) {
        router.push('/settings?error=no_code');
        return;
      }
      
      try {
        // Call Cloud Function to exchange code for tokens
        const connectCalendar = httpsCallable(functions, 'connectGoogleCalendar');
        await connectCalendar({ code });
        
        router.push('/settings?success=calendar_connected');
      } catch (error) {
        console.error('Error connecting calendar:', error);
        router.push('/settings?error=connection_failed');
      }
    };
    
    handleCallback();
  }, [searchParams, router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Connecting your calendar...</p>
      </div>
    </div>
  );
}
```

### 3. Display Event Info in Recording Detail

```tsx
// In recording detail view

{selectedRecording.correlatedEvent && (
  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <span className="text-2xl">📅</span>
      <div className="flex-1">
        <p className="text-blue-300 font-medium text-sm mb-1">
          Calendar Event
        </p>
        <p className="text-white font-semibold">
          {selectedRecording.correlatedEvent.summary}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {selectedRecording.correlatedEvent.startTime.toDate().toLocaleString()}
        </p>
        
        {selectedRecording.correlatedEvent.participants && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Participants:</p>
            <div className="flex flex-wrap gap-2">
              {selectedRecording.correlatedEvent.participants.map((p, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded"
                >
                  {p.name || p.email}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-600 mt-2">
          Match confidence: {Math.round(selectedRecording.correlatedEvent.matchScore * 100)}%
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 🔒 Seguridad y Privacidad

### 1. Token Storage
- ✅ Tokens en Firestore con Security Rules
- ✅ Access token temporal (1 hora)
- ✅ Refresh token encriptado
- ✅ Solo el usuario puede acceder a sus tokens

### 2. Firestore Security Rules

```javascript
match /users/{userId}/calendarAuth/{provider} {
  // Solo el dueño puede leer/escribir sus tokens
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

match /users/{userId}/calendarEvents/{eventId} {
  // Solo el dueño puede leer sus eventos
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // Solo Cloud Functions pueden escribir
  allow write: if false;
}
```

### 3. Datos Sensibles
- ❌ Nunca exponer refresh tokens al frontend
- ❌ Nunca loguear tokens completos
- ✅ Usar HTTPS everywhere
- ✅ Validar scopes antes de solicitar

---

## 📊 Monitoreo y Logs

### Métricas a Rastrear
1. **Conexiones activas:** Usuarios con calendar conectado
2. **Sync success rate:** % de syncs exitosos
3. **Correlation accuracy:** % de recordings correlacionados
4. **Token refresh failures:** Cuántos refresh fallan
5. **API quota usage:** Consumo de Google Calendar API

### Logs Importantes
```typescript
// En cada función
console.log('[Calendar] Sync started for user:', userId);
console.log('[Calendar] Events synced:', events.length);
console.log('[Calendar] Correlations created:', matches.length);
console.error('[Calendar] Sync failed:', error.message);
```

---

## 🧪 Testing

### Unit Tests
- Token refresh logic
- Time-based correlation algorithm
- Event parsing and storage

### Integration Tests
- OAuth flow end-to-end
- Calendar sync con API real
- Correlation con grabaciones reales

### Manual QA Checklist
- [ ] Connect calendar funciona
- [ ] Events se sincronizan correctamente
- [ ] Recordings se correlacionan bien
- [ ] Tokens se refrescan automáticamente
- [ ] Disconnect funciona
- [ ] Error handling muestra mensajes claros
- [ ] Security rules previenen acceso no autorizado

---

## 🚀 Plan de Implementación

### Fase 1: OAuth Setup (1-2 días)
1. Configurar Google Cloud Project
2. Habilitar Calendar API
3. Crear OAuth credentials
4. Implementar connectGoogleCalendar function
5. UI de conexión en Settings
6. Callback handler

### Fase 2: Sync (2-3 días)
1. Implementar syncCalendarEvents
2. Token refresh logic
3. Scheduled sync (cron)
4. Error handling y retry logic
5. Security rules

### Fase 3: Correlation (1-2 días)
1. Implementar correlateEventsWithRecordings
2. Time-based matching algorithm
3. Update data structures
4. Trigger on recording create

### Fase 4: UI (1 día)
1. Display event info in recording detail
2. List próximos eventos
3. Manual correlation controls
4. Status indicators

### Fase 5: Testing & Deploy (1 día)
1. Unit tests
2. Integration tests
3. Manual QA
4. Deploy a producción
5. Monitoring setup

**Total estimado: 6-9 días de desarrollo**

---

## 🎯 Success Criteria

✅ Usuario puede conectar Google Calendar en 3 clicks  
✅ Events se sincronizan cada hora automáticamente  
✅ 80%+ de recordings se correlacionan correctamente  
✅ Token refresh funciona sin intervención del usuario  
✅ Cero exposición de tokens sensibles  
✅ UI muestra contexto de calendario claramente  

---

## 📝 Notas Finales

### Consideraciones Futuras
1. **Multi-calendar support:** Permitir seleccionar varios calendarios
2. **Bidirectional sync:** Crear eventos desde Always hacia Calendar
3. **Smart suggestions:** AI sugiere correlaciones cuando no hay match automático
4. **Recurring events:** Manejar eventos recurrentes correctamente
5. **Timezone handling:** Soporte para múltiples zonas horarias

### Alternativas Consideradas
- **Nylas API:** Abstracción multi-provider, pero costo adicional
- **Microsoft Graph:** Para Outlook/Office 365 users
- **CalDAV:** Protocolo abierto, pero más complejo de implementar

### Dependencies
```json
{
  "googleapis": "^126.0.0",
  "google-auth-library": "^9.0.0"
}
```

---

**Documento vivo** - Actualizar conforme se implementa y se descubren edge cases.
