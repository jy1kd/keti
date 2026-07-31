/**
 * App IPC Handlers
 *
 * Handles all app-related IPC communications:
 * - App info (version, platform, name)
 * - Backend management (restart, status)
 */

import { app, ipcMain } from 'electron';
import { IPC_CHANNELS, BackendStatus } from './index';
import { BackendManager } from '../backendManager';

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
 */
export function registerBackendManagementHandlers(backendManager: BackendManager): void {
  // Restart backend
  ipcMain.handle(IPC_CHANNELS.BACKEND_RESTART, async () => {
    const success = await backendManager.restart();
    return { success };
  });

  // Get backend status
  ipcMain.handle(IPC_CHANNELS.BACKEND_STATUS, (): BackendStatus => {
    return backendManager.getStatus();
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
