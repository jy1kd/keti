/**
 * App IPC Handlers
 *
 * Handles all app-related IPC communications:
 * - App info (version, platform, name)
 * - Backend management (restart, status)
 */

import { app, ipcMain } from 'electron';
import { IPC_CHANNELS, BackendStatus } from './index';

/**
 * Register app info IPC handlers
 */
export function registerAppInfoHandlers(): void {
  // Get app version
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    return app.getVersion();
  });

  // Get platform
  ipcMain.handle(IPC_CHANNELS.APP_PLATFORM, () => {
    return process.platform;
  });

  // Get app name
  ipcMain.handle(IPC_CHANNELS.APP_NAME, () => {
    return app.getName();
  });
}

/**
 * Register backend management IPC handlers
 *
 * These are placeholder implementations that will be extended in PR-E10
 * with the full BackendManager class.
 */
export function registerBackendManagementHandlers(): void {
  // Restart backend (placeholder for PR-E10)
  ipcMain.handle(IPC_CHANNELS.BACKEND_RESTART, async () => {
    // TODO: Implement in PR-E10 (Python Backend Packaging)
    console.log('[IPC] backend:restart');
    // In PR-E10, this will restart the Python backend process
  });

  // Get backend status (placeholder for PR-E10)
  ipcMain.handle(IPC_CHANNELS.BACKEND_STATUS, (): BackendStatus => {
    // TODO: Implement in PR-E10 (Python Backend Packaging)
    return { running: false };
  });
}

/**
 * Unregister all app IPC handlers
 */
export function unregisterAppHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.APP_VERSION);
  ipcMain.removeHandler(IPC_CHANNELS.APP_PLATFORM);
  ipcMain.removeHandler(IPC_CHANNELS.APP_NAME);
  ipcMain.removeHandler(IPC_CHANNELS.BACKEND_RESTART);
  ipcMain.removeHandler(IPC_CHANNELS.BACKEND_STATUS);
}
