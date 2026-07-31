/**
 * Window IPC Handlers
 *
 * Handles all window-related IPC communications:
 * - Window control (minimize, maximize, close)
 * - Window management (open order window, open kline window)
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './index';
/**
 * Register window control IPC handlers
 */
export function registerWindowControlHandlers(mainWindow) {
    // Minimize window
    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
        mainWindow.minimize();
    });
    // Maximize/restore window
    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
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
export function registerWindowManagementHandlers(windowManager) {
    // Open order window
    ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_ORDER, (_event, instrumentID) => {
        windowManager.openOrderWindow(instrumentID);
    });
    // Open K-line window
    ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_KLINE, (_event, instrumentID) => {
        windowManager.openKLineWindow(instrumentID);
    });
}
/**
 * Unregister all window IPC handlers
 */
export function unregisterWindowHandlers() {
    ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MINIMIZE);
    ipcMain.removeHandler(IPC_CHANNELS.WINDOW_MAXIMIZE);
    ipcMain.removeHandler(IPC_CHANNELS.WINDOW_CLOSE);
    ipcMain.removeHandler(IPC_CHANNELS.WINDOW_OPEN_ORDER);
    ipcMain.removeHandler(IPC_CHANNELS.WINDOW_OPEN_KLINE);
}
//# sourceMappingURL=window.js.map