/**
 * App IPC Handlers
 *
 * Handles all app-related IPC communications:
 * - App info (version, platform, name)
 * - Backend management (restart, status)
 */

import { app } from 'electron';
import { IPC_CHANNELS, BackendStatus } from './index';
import { BackendManager } from '../backendManager';
import { handleIPC } from '../ipcWrapper';

/**
 * Register app info IPC handlers
 */
export function registerAppInfoHandlers(): void {
  // Get app version
  handleIPC(IPC_CHANNELS.APP_VERSION, () => {
    return app.getVersion();
  });

  // Get platform
  handleIPC(IPC_CHANNELS.APP_PLATFORM, () => {
    return process.platform;
  });

  // Get app name
  handleIPC(IPC_CHANNELS.APP_NAME, () => {
    return app.getName();
  });
}

/**
 * Register backend management IPC handlers
 */
export function registerBackendManagementHandlers(backendManager: BackendManager): void {
  // Restart backend
  handleIPC(IPC_CHANNELS.BACKEND_RESTART, async () => {
    const success = await backendManager.restart();
    return { success };
  });

  // Get backend status
  handleIPC(IPC_CHANNELS.BACKEND_STATUS, (): BackendStatus => {
    return backendManager.getStatus();
  });
}

/**
 * Unregister all app IPC handlers
 */
export function unregisterAppHandlers(): void {
  const { ipcMain } = require('electron');
  ipcMain.removeHandler(IPC_CHANNELS.APP_VERSION);
  ipcMain.removeHandler(IPC_CHANNELS.APP_PLATFORM);
  ipcMain.removeHandler(IPC_CHANNELS.APP_NAME);
  ipcMain.removeHandler(IPC_CHANNELS.BACKEND_RESTART);
  ipcMain.removeHandler(IPC_CHANNELS.BACKEND_STATUS);
}
