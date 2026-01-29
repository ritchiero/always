# ✅ Google Calendar Integration - Setup Checklist

Quick reference para implementar la integración.

---

## 📋 Pre-Requisitos

- [ ] Proyecto de Always en Google Cloud Console
- [ ] Firebase Functions configurado
- [ ] Vercel deployment funcionando
- [ ] Firestore con security rules actualizadas

---

## 🔧 Setup Paso a Paso

### 1. Google Cloud Console (15 min)

- [ ] Ir a https://console.cloud.google.com/
- [ ] Seleccionar proyecto `always-f6dda`
- [ ] **APIs & Services** → **Enable APIs**
  - [ ] Google Calendar API ✓
  - [ ] Google People API ✓ (para contacts después)
- [ ] **OAuth consent screen**
  - [ ] Tipo: External (o Internal si G Suite)
  - [ ] App name: "Always - Smart Recording"
  - [ ] User support email: ricardo.rodriguez@getlawgic.com
  - [ ] Scopes: calendar.readonly, calendar.events
  - [ ] Test users: Agregar tu email
- [ ] **Credentials** → **Create OAuth 2.0 Client ID**
  - [ ] Application type: Web application
  - [ ] Name: Always Calendar Integration
  - [ ] Authorized redirect URIs:
    - `https://app-pi-one-84.vercel.app/auth/google/callback`
    - `http://localhost:3000/auth/google/callback`
  - [ ] **Copiar Client ID y Client Secret**

### 2. Firebase Configuration (5 min)

```bash
# Desde tu computadora
cd /path/to/always

# Configurar credentials
firebase functions:config:set \
  google.client_id="<TU_CLIENT_ID>.apps.googleusercontent.com" \
  google.client_secret="<TU_CLIENT_SECRET>"

# Verificar
firebase functions:config:get
```

### 3. Environment Variables (2 min)

**`app/.env.local`** (para Next.js)
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<TU_CLIENT_ID>
```

**No incluir** Client Secret en frontend (solo en Functions)

### 4. Install Dependencies (1 min)

```bash
# Functions
cd functions
npm install googleapis google-auth-library

# App (si necesitas)
cd ../app
npm install @react-oauth/google
```

### 5. Firestore Security Rules (3 min)

Agregar a `firestore.rules`:

```javascript
// Calendar tokens (solo owner)
match /users/{userId}/calendarAuth/{provider} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Calendar events (solo owner read, functions write)
match /users/{userId}/calendarEvents/{eventId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Solo Cloud Functions
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 6. Implement Cloud Functions (4-6 hrs)

Copiar implementaciones del documento de arquitectura:

- [ ] `connectGoogleCalendar` - OAuth exchange
- [ ] `syncCalendarEvents` - Scheduled sync
- [ ] `correlateEventsWithRecordings` - Matching logic
- [ ] `refreshAccessToken` - Token refresh
- [ ] Helper functions

### 7. Implement Frontend (2-3 hrs)

- [ ] Settings page con botón "Connect Calendar"
- [ ] OAuth callback handler (`/auth/google/callback`)
- [ ] Display event info en recording detail
- [ ] Connection status indicator

### 8. Deploy (5 min)

```bash
# Deploy functions
firebase deploy --only functions:connectGoogleCalendar,functions:syncCalendarEvents

# Deploy app (Vercel auto-deploys on git push)
git add .
git commit -m "feat: Google Calendar integration"
git push origin main
```

### 9. Testing (30 min)

- [ ] Click "Connect Calendar" en Settings
- [ ] Completar OAuth flow
- [ ] Verificar que tokens se guardan en Firestore
- [ ] Manualmente trigger sync
- [ ] Verificar events en Firestore
- [ ] Crear grabación en horario de evento
- [ ] Verificar correlación
- [ ] Check event info aparece en UI

### 10. Monitoring (10 min)

- [ ] Firebase Console → Functions → Logs
- [ ] Verificar que cron job ejecuta cada hora
- [ ] Set up alerts para errores de sync
- [ ] Monitor API quota usage en Google Cloud

---

## 🐛 Troubleshooting Común

### "redirect_uri_mismatch"
✅ Verificar que el redirect URI en Google Cloud coincide EXACTAMENTE con el que usas en código
- Incluir https://
- Sin trailing slash
- Case-sensitive

### "invalid_grant" al refresh token
✅ El refresh token expiró o fue revocado
- Pedir al usuario re-conectar calendar
- Asegurar que `access_type=offline` y `prompt=consent` estén en OAuth URL

### "insufficient_permissions"
✅ Verificar scopes en OAuth consent screen
- Debe incluir `calendar.readonly` mínimo

### Tokens no se guardan
✅ Verificar security rules
✅ Verificar que userId coincide con context.auth.uid

### Events no se sincronizan
✅ Verificar cron job está activo: `firebase functions:log --only syncCalendarEvents`
✅ Verificar API quota no está excedido

---

## 📊 Success Metrics

Después del deploy, monitorear:

- **Conexiones:** Cuántos usuarios conectaron calendar
- **Sync rate:** % de syncs exitosos (target: >95%)
- **Correlation rate:** % de recordings correlacionados (target: >80%)
- **Token refresh success:** % de refresh exitosos (target: >99%)

---

## 🎯 Quick Win: MVP en 1 Día

Si quieres un MVP rápido:

1. ✅ Setup OAuth (30 min)
2. ✅ Implementar solo `connectGoogleCalendar` (1 hr)
3. ✅ Implementar solo `syncCalendarEvents` sin cron (1 hr)
4. ✅ UI básica: botón connect + lista de events (2 hrs)
5. ✅ Testing manual (1 hr)

**Total: ~6 horas de trabajo**

Correlation automática y cron se pueden agregar después.

---

## 📝 After Launch

### Semana 1
- Monitor error rates
- Collect user feedback
- Fix critical bugs

### Semana 2
- Implementar correlation automática
- Set up scheduled sync
- Add UI polish

### Semana 3
- Advanced features (manual correlation, multi-calendar)
- Performance optimization
- Documentation update

---

**Next:** Una vez completado, documentar en README y actualizar roadmap a Phase 9 ✓
