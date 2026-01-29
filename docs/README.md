# 📚 Always - Documentation

Documentación técnica y de producto para Always.

---

## 📋 Índice

### 🎯 Product & Planning

- **[Roadmap & Progress](../app/src/app/analisis/page.tsx)** - Estado actual del proyecto, fases completadas, próximos pasos
- **[QA Checklist](../QA_CHECKLIST.md)** - Lista de verificación de calidad para Phase 7
- **[Deployment Guide - Phase 7](../DEPLOY_PHASE7.md)** - Guía de deployment para sistema de confirmación

### 🏗️ Architecture

- **[Calendar Integration Architecture](./CALENDAR_INTEGRATION_ARCHITECTURE.md)** ⭐ NEW
  - Arquitectura completa técnica
  - OAuth 2.0 flow
  - Data structures
  - Cloud Functions (código completo)
  - Security & Privacy
  - Monitoring & Testing
  - **~26KB | 6-9 días de implementación**

### ✅ Implementation Guides

- **[Calendar Setup Checklist](./CALENDAR_SETUP_CHECKLIST.md)** ⭐ NEW
  - Paso a paso de configuración
  - Pre-requisitos
  - Troubleshooting común
  - Quick win: MVP en 1 día
  - **~6KB | Setup en 30 min**

### 🎨 User Experience

- **[Calendar User Flow](./CALENDAR_USER_FLOW.md)** ⭐ NEW
  - Experiencia de usuario completa
  - Before/After comparisons
  - UI states y mockups
  - Value proposition
  - Time savings calculados
  - **~13KB | Storytelling visual**

---

## 🚀 Quick Start

### Para Desarrolladores

**Empezar con Phase 7 (Sistema de Confirmación):**
1. Lee [DEPLOY_PHASE7.md](../DEPLOY_PHASE7.md)
2. Configura OpenAI secret
3. Deploy functions
4. Test en staging

**Empezar con Phase 9 (Calendar Integration):**
1. Lee [CALENDAR_SETUP_CHECKLIST.md](./CALENDAR_SETUP_CHECKLIST.md)
2. Setup OAuth en Google Cloud
3. Implementa funciones desde [CALENDAR_INTEGRATION_ARCHITECTURE.md](./CALENDAR_INTEGRATION_ARCHITECTURE.md)
4. Test end-to-end

### Para Product/UX

**Entender el valor de Calendar:**
1. Lee [CALENDAR_USER_FLOW.md](./CALENDAR_USER_FLOW.md)
2. Revisa mockups y user journey
3. Valida value proposition con usuarios
4. Prioriza features

### Para QA

**Testing Phase 7:**
1. [QA_CHECKLIST.md](../QA_CHECKLIST.md) - Lista completa de tests
2. Smoke tests, edge cases, security

---

## 📊 Project Status (Enero 29, 2026)

### Completado ✅
- **Phases 1-6:** Análisis automático, action items, gestión
- **UX Mobile:** Header hamburguesa, FAB, animaciones
- **Phase 7 Code:** Sistema de confirmación (pendiente deploy)

### En Progreso 🔄
- **Phase 7 Deploy:** Configurar secrets + Cloud Functions
- **Phase 9 Planning:** Calendar integration (docs completas)

### Próximo 🎯
- Deploy Phase 7
- Implementar Calendar integration (6-9 días)
- Phase 8: Redacción IA con feedback iterativo
- Phase 10: Integraciones Gmail + Calendar bidireccionales

**Progreso General:** 79% (33/42 tareas)

---

## 🎓 Learning Path

### Si eres nuevo en el proyecto:

1. **Entender el producto:**
   - Lee la página de [/analisis](../app/src/app/analisis/page.tsx) en la app
   - Revisa el roadmap y fases completadas

2. **Entender la arquitectura:**
   - Firebase (Firestore + Functions + Storage)
   - Next.js 14 (App Router)
   - Cloud-based processing (GPT-4o-mini)
   - Real-time transcription (Deepgram)

3. **Contribuir:**
   - Pick una fase del roadmap
   - Lee la documentación correspondiente
   - Implementa siguiendo las guías
   - Test con el QA checklist

---

## 🔧 Tech Stack Reference

### Frontend
- **Framework:** Next.js 14 (React, TypeScript)
- **Styling:** Tailwind CSS
- **Auth:** Firebase Auth
- **State:** React hooks + Context

### Backend
- **Functions:** Firebase Cloud Functions (Node.js)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Cron:** Firebase scheduled functions

### APIs & Services
- **Transcription:** Deepgram (real-time)
- **AI Analysis:** OpenAI GPT-4o-mini
- **Vector Search:** Pinecone (1536 dims)
- **Calendar:** Google Calendar API (OAuth 2.0)
- **Email:** Gmail API (future)

### Infrastructure
- **Hosting:** Vercel (app) + Firebase (functions)
- **CI/CD:** Git push → Vercel auto-deploy
- **Monitoring:** Firebase Console logs

---

## 📝 Documentation Guidelines

### Adding New Docs

**Technical docs** → `/docs/` folder
- Architecture designs
- API references
- Setup guides

**Product docs** → `/docs/` or inline in features
- User flows
- Value propositions
- Mockups

**Code docs** → Inline comments + README in feature folders

### Doc Template

```markdown
# Title - What This Is

Brief description (1-2 sentences)

## Objectives
What we're trying to achieve

## Architecture / Plan
Technical details or step-by-step

## Implementation
Code, commands, or UI specs

## Testing
How to verify it works

## Next Steps
What comes after
```

---

## 🤝 Contributing

1. **Branch naming:** `feature/calendar-sync`, `fix/recording-bug`
2. **Commit messages:** Follow conventional commits
   - `feat:` new features
   - `fix:` bug fixes
   - `docs:` documentation
   - `refactor:` code improvements
3. **Before commit:**
   - Run `npm run build` (both app and functions)
   - Test locally if possible
   - Update relevant docs

---

## 📞 Support

- **GitHub Issues:** Technical bugs and feature requests
- **Discord:** Community discussion (link TBD)
- **Email:** ricardo.rodriguez@getlawgic.com (project owner)

---

**Last Updated:** Enero 29, 2026  
**Next Review:** Después de implementar Phase 9 (Calendar)
