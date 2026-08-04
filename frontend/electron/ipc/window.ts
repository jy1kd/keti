/**
 * Window IPC Handlers
 *
 * Handles all window-related IPC communications:
 * - Window control (minimize, maximize, close)
 * - Window management (open order window, open kline window)
 */

import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from './index';
import { WindowManager } from '../windowManager';

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
 */
export function registerWindowManagementHandlers(windowManager: WindowManager): void {
  // Open order window
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_ORDER, (_event, instrumentID?: string) => {
    windowManager.openOrderWindow(instrumentID);
  });

  // Open K-line window
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_KLINE, (_event, instrumentID: string) => {
    windowManager.openKLineWindow(instrumentID);
  });

  // Open tab in new window
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_TAB, (_event, tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>) => {
    windowManager.openTabWindow(tabType, tabId, tabTitle, props);
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
  ipcMain.removeHandler(IPC_CHANNELS.WINDOW_OPEN_TAB);
}
