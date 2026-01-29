# 🚀 Deployment Guide - Phase 7: Confirmation System

## ⚠️ ANTES DE DEPLOYAR

Las nuevas Cloud Functions requieren configuración de secrets en Firebase.

## 📋 Paso 1: Configurar OpenAI API Key como Secret

Desde tu máquina local (con firebase-tools instalado):

```bash
# 1. Ir al directorio del proyecto
cd /path/to/always

# 2. Login a Firebase (si no lo has hecho)
firebase login

# 3. Configurar el secret de OpenAI
firebase functions:secrets:set OPENAI_API_KEY

# Cuando te pida el valor, pega tu OpenAI API key (ya la tienes guardada)
```

## 📋 Paso 2: Deploy de Cloud Functions

```bash
# Deployar SOLO las dos nuevas funciones
firebase deploy --only functions:generateActionDraft,functions:executeAction

# O deployar todas las functions
firebase deploy --only functions
```

## 📋 Paso 3: Verificar Deployment

### 3.1 Firebase Console
1. Ve a https://console.firebase.google.com
2. Selecciona proyecto "always-f6dda"
3. Navega a Functions
4. Verifica que aparezcan:
   - `generateActionDraft`
   - `executeAction`

### 3.2 Test Manual
1. Abre https://app-pi-one-84.vercel.app/
2. Selecciona una grabación con action items
3. Click en "🤖 Redactar Email"
4. Debe aparecer el modal
5. Click en "✓ Sí, redactar"
6. Espera a que GPT-4o genere el draft (5-10 seg)
7. Revisa el contenido generado
8. (Opcional) Da feedback y regenera
9. Click en "✓ Aprobar y Enviar"

## 🧪 Tests de Validación

### Test 1: Modal Opens
- [ ] Modal abre al hacer click en "Redactar Email"
- [ ] Modal muestra información correcta del action
- [ ] Modal se puede cerrar con X

### Test 2: Draft Generation
- [ ] Loading state se muestra mientras genera
- [ ] Draft aparece después de 5-10 segundos
- [ ] Draft tiene contexto relevante de la conversación
- [ ] Draft incluye saludo y despedida

### Test 3: Feedback Loop
- [ ] Campo de feedback aparece
- [ ] Regenerar con feedback funciona
- [ ] Nuevo draft refleja los cambios pedidos

### Test 4: Execution
- [ ] Botón "Aprobar y Enviar" funciona
- [ ] Modal se cierra después de ejecutar
- [ ] Action item se marca como "executed"
- [ ] Aparece en `executedActions` collection

## 🚨 Troubleshooting

### Error: "OPENAI_API_KEY not configured"
**Solución:** Ejecuta `firebase functions:secrets:set OPENAI_API_KEY`

### Error: "Firebase auth required"
**Solución:** 
1. Verifica que estás logueado: `firebase projects:list`
2. Si no, ejecuta: `firebase login`

### Error: "Function timeout"
**Solución:**
- GPT-4o puede tardar hasta 60 segundos
- Ya está configurado timeout de 60s
- Si sigue fallando, aumenta a 120s en index.ts

### Error: "No draft generated"
**Solución:**
- Verifica que la transcripción tiene texto
- Revisa logs en Firebase Console
- Verifica que OPENAI_API_KEY es válida

## 📊 Monitoreo Post-Deploy

### Firebase Console - Logs
```
https://console.firebase.google.com/project/always-f6dda/functions/logs
```

Buscar:
- "generateActionDraft called"
- "Draft generated successfully"
- "executeAction called"

### Firestore - Verificar Data
Collections a revisar:
- `recordings` → Campo `analysis.actionItems` debe tener `status: executed`
- `executedActions` → Debe haber nuevos docs con drafts ejecutados

## ✅ Checklist Final

Antes de considerar Phase 7 como completo:

- [ ] Secrets configurados correctamente
- [ ] Functions deployadas sin errores
- [ ] Test manual exitoso de email draft
- [ ] Test manual exitoso de meeting draft
- [ ] Feedback loop funciona correctamente
- [ ] Execution registra en Firestore
- [ ] No hay errores en logs de Firebase
- [ ] UI mobile funciona correctamente

## 🎯 Estado Actual

**Código:** ✅ Completado y pusheado a GitHub
**Build:** ✅ Compilación exitosa
**Secrets:** ⏳ Pendiente configurar
**Deploy:** ⏳ Pendiente
**Testing:** ⏳ Pendiente

---

**Nota:** Las integraciones reales (Gmail API, Google Calendar) se implementarán en Fases 9-10. Por ahora, `executeAction` solo registra la acción en Firestore.
