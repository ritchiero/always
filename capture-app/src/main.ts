import { app, BrowserWindow, Tray, Menu, nativeImage, systemPreferences } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
const record = require('node-record-lpcm16');
const screenshot = require('screenshot-desktop');
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// Configuración
const AUDIO_CHUNK_MINUTES = 15;
const SCREENSHOT_INTERVAL_SECONDS = 30;
const STORAGE_BUCKET = 'always-f6dda.firebasestorage.app';

let tray: Tray | null = null;
let isRecording = false;
let audioRecorder: any = null;
let screenshotInterval: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;

// Inicializar Firebase Admin con service account
const serviceAccountPath = path.join(__dirname, '../service-account.json');
let firebaseApp: any;
let storage: any;
let bucket: any;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: STORAGE_BUCKET
    });
    storage = getStorage(firebaseApp);
    bucket = storage.bucket(STORAGE_BUCKET);
    console.log('Firebase initialized with service account');
  } else {
    console.log('Service account file not found. Firebase functionality will be limited.');
    console.log('Please add service-account.json to the project root for full functionality.');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  
  updateTrayMenu();
  tray.setToolTip('Always - Recording');
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: isRecording ? '⏹ Stop Recording' : '🎙 Start Recording', 
      click: toggleRecording 
    },
    { type: 'separator' },
    { label: 'Open Dashboard', click: openDashboard },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray?.setContextMenu(contextMenu);
}

async function toggleRecording() {
  console.log('toggleRecording called, isRecording:', isRecording);
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
  updateTrayMenu();
}

async function startRecording() {
  console.log('startRecording called');
  // Verificar permisos de micrófono
  const micPermission = systemPreferences.getMediaAccessStatus('microphone');
  if (micPermission !== 'granted') {
    await systemPreferences.askForMediaAccess('microphone');
  }
  
  // Verificar permisos de screen recording
  const screenPermission = systemPreferences.getMediaAccessStatus('screen');
  if (screenPermission !== 'granted') {
    // macOS requiere que el usuario vaya a System Preferences manualmente
    console.log('Please enable screen recording permission in System Preferences');
  }
  
  isRecording = true;
  console.log('Recording started...');
  
  // Iniciar grabación de audio
  startAudioRecording();
  
  // Iniciar captura de screenshots
  startScreenshotCapture();
}

function stopRecording() {
  isRecording = false;
  console.log('Recording stopped.');
  
  if (audioRecorder) {
    audioRecorder.stop();
    audioRecorder = null;
  }
  
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
}

function startAudioRecording() {
  console.log('startAudioRecording called');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const audioDir = path.join(app.getPath('userData'), 'audio');
  
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  
  const audioPath = path.join(audioDir, `audio-${timestamp}.wav`);
  console.log('Audio will be saved to:', audioPath);
  const fileStream = fs.createWriteStream(audioPath);
  
  audioRecorder = record.record({
    sampleRate: 16000,
    channels: 1,
    recorder: '/opt/homebrew/bin/sox', // Ruta completa a sox (Homebrew en Apple Silicon)
  });
  console.log('Audio recorder started');
  
  audioRecorder.stream().pipe(fileStream);
  
  // Subir cada chunk después de AUDIO_CHUNK_MINUTES
  setTimeout(async () => {
    if (isRecording) {
      audioRecorder.stop();
      await uploadFile(audioPath, `audio/${path.basename(audioPath)}`);
      startAudioRecording(); // Iniciar nuevo chunk
    }
  }, AUDIO_CHUNK_MINUTES * 60 * 1000);
}

async function startScreenshotCapture() {
  console.log('startScreenshotCapture called');
  screenshotInterval = setInterval(async () => {
    if (!isRecording) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotDir = path.join(app.getPath('userData'), 'screenshots');
      
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      const screenshotPath = path.join(screenshotDir, `screenshot-${timestamp}.png`);
      await screenshot({ filename: screenshotPath });
      
      // Subir a Firebase Storage
      await uploadFile(screenshotPath, `screenshots/${path.basename(screenshotPath)}`);
      
      // Eliminar archivo local después de subir
      fs.unlinkSync(screenshotPath);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }, SCREENSHOT_INTERVAL_SECONDS * 1000);
}

async function uploadFile(localPath: string, remotePath: string) {
  if (!bucket) {
    console.log(`Skipping upload (Firebase not configured): ${remotePath}`);
    return;
  }
  
  try {
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: localPath.endsWith('.wav') ? 'audio/wav' : 'image/png',
      },
    });
    console.log(`Uploaded: ${remotePath}`);
  } catch (error) {
    console.error('Upload error:', error);
  }
}

function openDashboard() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  mainWindow.loadURL('http://localhost:3000');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createTray();
  
  // Ocultar dock icon (app solo en tray)
  app.dock?.hide();
});

app.on('window-all-closed', () => {
  // No cerrar la app cuando se cierran las ventanas
});
