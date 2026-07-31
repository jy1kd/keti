import { app, BrowserWindow } from 'electron';
import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { registerWindowControlHandlers, registerWindowManagementHandlers } from './ipc/window';
import { registerAppInfoHandlers, registerBackendManagementHandlers } from './ipc/app';

// Check if in development mode
export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Global manager instances
let windowManager: WindowManager;
let trayManager: TrayManager;

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
}

// Only auto-initialize when not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeApp().catch(console.error);
}
