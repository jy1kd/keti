/**
 * Window IPC Handlers
 *
 * Handles all window-related IPC communications:
 * - Window control (minimize, maximize, close)
 * - Window management (open order window, open kline window)
 */

import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from './index';

/**
 * Register window control IPC handlers
 */
export function registerWindowControlHandlers(mainWindow: BrowserWindow): void {
  // Minimize window
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();
  });

  // Maximize/restore window
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // Close window
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow.close();
  });
}

/**
 * Register window management IPC handlers
 *
 * These are placeholder implementations that will be extended in PR-E3
 * with the full WindowManager class.
 */
export function registerWindowManagementHandlers(): void {
  // Open order window (placeholder for PR-E3)
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_ORDER, (_event, instrumentID?: string) => {
    // TODO: Implement in PR-E3 (Window Manager)
    console.log('[IPC] open-order-window', instrumentID);
    // In PR-E3, this will create a new BrowserWindow for order entry
  });

  // Open K-line window (placeholder for PR-E3)
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_KLINE, (_event, instrumentID: string) => {
    // TODO: Implement in PR-E3 (Window Manager)
    console.log('[IPC] open-kline-window', instrumentID);
    // In PR-E3, this will create a new BrowserWindow for K-line chart
  });
}

/**
 * Unregister all window IPC handlers
 */
export function unregisterWindowHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MINIMIZE);
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MAXIMIZE);
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_CLOSE);
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_OPEN_ORDER);
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_OPEN_KLINE);
}
