import { app, BrowserWindow } from 'electron';
import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { ShortcutManager } from './shortcuts';
import { registerWindowControlHandlers, registerWindowManagementHandlers } from './ipc/window';
import { registerAppInfoHandlers, registerBackendManagementHandlers } from './ipc/app';

// Check if in development mode
export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Global manager instances
let windowManager: WindowManager;
let trayManager: TrayManager;
let shortcutManager: ShortcutManager;

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

  // Create shortcut manager and register defaults
  shortcutManager = new ShortcutManager();
  shortcutManager.registerDefaults({
    'open-order': () => {
      windowManager.openOrderWindow();
    },
    'open-kline': () => {
      // Get selected instrument from main window
      mainWindow.webContents.send('get-selected-instrument');
    },
    'quit': () => {
      app.quit();
    },
  });

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
  registerBackendManagementHandlers();

  // Cleanup on quit
  app.on('will-quit', () => {
    shortcutManager.unregisterAll();
  });
}

// Only auto-initialize when not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeApp().catch(console.error);
}
