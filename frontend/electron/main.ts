import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

// App configuration
export const APP_CONFIG = {
  title: 'SimNow 交易终端',
  width: 1600,
  height: 1000,
  minWidth: 1200,
  minHeight: 800,
};

// Check if in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Create the main application window
 */
export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: APP_CONFIG.width,
    height: APP_CONFIG.height,
    minWidth: APP_CONFIG.minWidth,
    minHeight: APP_CONFIG.minHeight,
    title: APP_CONFIG.title,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  return mainWindow;
}

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  // Wait for app to be ready
  await app.whenReady();

  // Create main window
  const mainWindow = createMainWindow();

  // Handle app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Handle all windows closed
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Register IPC handlers
  registerIpcHandlers(mainWindow);
}

/**
 * Register IPC handlers for window control
 */
function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Window control
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });

  // App info
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:platform', () => {
    return process.platform;
  });

  ipcMain.handle('app:name', () => {
    return app.getName();
  });
}

// Auto-initialize when imported
initializeApp().catch(console.error);
