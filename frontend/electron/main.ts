import { app, BrowserWindow, ipcMain } from 'electron';
import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { ShortcutManager } from './shortcuts';
import { NotificationManager } from './notificationManager';
import { BackendManager } from './backendManager';
import { AutoUpdaterManager } from './autoUpdater';
import { IPC_CHANNELS } from './ipc/index';
import { registerWindowControlHandlers, registerWindowManagementHandlers } from './ipc/window';
import { registerAppInfoHandlers, registerBackendManagementHandlers } from './ipc/app';
import { sendIPCMonitorToWindow } from './ipcWrapper';

// Check if in development mode
export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Global manager instances
let windowManager: WindowManager;
let trayManager: TrayManager;
let shortcutManager: ShortcutManager;
let notificationManager: NotificationManager;
let backendManager: BackendManager;
let autoUpdaterManager: AutoUpdaterManager;

/**
 * Get the window manager instance
 */
export function getWindowManager(): WindowManager {
  return windowManager;
}

/**
 * Get the tray manager instance
 */
export function getTrayManager(): TrayManager {
  return trayManager;
}

/**
 * Get the shortcut manager instance
 */
export function getShortcutManager(): ShortcutManager {
  return shortcutManager;
}

/**
 * Get the notification manager instance
 */
export function getNotificationManager(): NotificationManager {
  return notificationManager;
}

/**
 * Get the backend manager instance
 */
export function getBackendManager(): BackendManager {
  return backendManager;
}

/**
 * Get the auto updater manager instance
 */
export function getAutoUpdaterManager(): AutoUpdaterManager {
  return autoUpdaterManager;
}

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  // Wait for app to be ready
  await app.whenReady();

  // Create window manager
  windowManager = new WindowManager(isDev);

  // Create main window
  const mainWindow = windowManager.createMainWindow();

  // Create tray manager and initialize
  trayManager = new TrayManager();
  trayManager.initialize(mainWindow);

  // Store selected instrument from renderer
  let selectedInstrument = '';

  // IPC handler to receive selected instrument from renderer
  ipcMain.handle(IPC_CHANNELS.SELECTED_INSTRUMENT_RESPONSE, (_event, instrumentID: string) => {
    selectedInstrument = instrumentID;
  });

  // Create shortcut manager and register defaults
  shortcutManager = new ShortcutManager();
  shortcutManager.loadAndRegister({
    'open-order': () => {
      windowManager.openOrderWindow();
    },
    'open-kline': () => {
      // Request selected instrument from renderer
      mainWindow.webContents.send(IPC_CHANNELS.GET_SELECTED_INSTRUMENT);
      // Open K-line window with stored instrument (will be updated on response)
      if (selectedInstrument) {
        windowManager.openKLineWindow(selectedInstrument);
      }
    },
    'quit': () => {
      app.quit();
    },
  });

  // Create notification manager
  notificationManager = new NotificationManager();

  // Create backend manager and start backend
  backendManager = new BackendManager();
  await backendManager.start();

  // Create auto updater manager
  autoUpdaterManager = new AutoUpdaterManager();
  autoUpdaterManager.setMainWindow(mainWindow);

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdaterManager.checkForUpdates();
  }, 5000);

  // Handle app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });

  // Handle all windows closed
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Register IPC handlers using modular approach
  registerWindowControlHandlers(mainWindow);
  registerWindowManagementHandlers(windowManager);
  registerAppInfoHandlers();
  registerBackendManagementHandlers(backendManager);

  // Send IPC Monitor to main window
  sendIPCMonitorToWindow(mainWindow);

  // Cleanup on quit
  app.on('will-quit', () => {
    shortcutManager.save();
    shortcutManager.unregisterAll();
    notificationManager.closeAll();
    backendManager.stop();
  });
}

// Only auto-initialize when not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeApp().catch(console.error);
}
