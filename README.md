# Always

**Continuous Recording App with AI Transcription**

Always is a full-stack application that enables continuous audio recording with automatic AI-powered transcription. It consists of three main components:

## Architecture

```
always/
├── app/                    # Next.js web application
├── functions/              # Firebase Cloud Functions
├── capture-app/            # Electron app for Mac
├── firebase.json           # Firebase configuration
└── .firebaserc             # Firebase project settings
```

## Components

### Web App (`/app`)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Backend**: Firebase

The web dashboard for viewing transcriptions, managing recordings, and user settings.

### Cloud Functions (`/functions`)
- **Runtime**: Node.js 18
- **Framework**: Firebase Cloud Functions
- **Language**: TypeScript

Handles audio processing, AI transcription integration, and backend logic.

### Capture App (`/capture-app`)
- **Framework**: Electron
- **Platform**: macOS
- **Language**: TypeScript

Native desktop application for continuous audio capture with system tray integration.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ritchiero/always.git
   cd always
   ```

2. **Install dependencies**
   ```bash
   # Web app
   cd app && npm install
   
   # Cloud functions
   cd ../functions && npm install
   
   # Capture app
   cd ../capture-app && npm install
   ```

3. **Configure Firebase**
   ```bash
   firebase login
   firebase use --add
   ```

4. **Set up environment variables**
   Create `.env.local` in `/app` with your Firebase config.

### Development

```bash
# Run web app
cd app && npm run dev

# Run functions emulator
cd functions && npm run serve

# Run capture app
cd capture-app && npm run dev
```

### Deployment

```bash
# Deploy to Firebase
firebase deploy
```

## Features

- 🎙️ Continuous audio recording
- 🤖 AI-powered transcription
- 🖥️ Native Mac menu bar app
- 🌐 Web dashboard for transcription management
- ☁️ Cloud-based processing with Firebase

## License

MIT
