"use strict";
/**
 * Window IPC Handlers
 *
 * Handles all window-related IPC communications:
 * - Window control (minimize, maximize, close)
 * - Window management (open order window, open kline window)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWindowControlHandlers = registerWindowControlHandlers;
exports.registerWindowManagementHandlers = registerWindowManagementHandlers;
exports.unregisterWindowHandlers = unregisterWindowHandlers;
const index_1 = require('./index.cjs');
const ipcWrapper_1 = require('../ipcWrapper.cjs');
/**
 * Register window control IPC handlers
 */
function registerWindowControlHandlers(mainWindow) {
    // Minimize window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_MINIMIZE, () => {
        mainWindow.minimize();
    });
    // Maximize/restore window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    });
    // Close window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_CLOSE, () => {
        mainWindow.close();
    });
}
/**
 * Register window management IPC handlers
 */
function registerWindowManagementHandlers(windowManager) {
    // Open order window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_OPEN_ORDER, (_event, instrumentID) => {
        windowManager.openOrderWindow(instrumentID);
    });
    // Open K-line window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_OPEN_KLINE, (_event, instrumentID) => {
        windowManager.openKLineWindow(instrumentID);
    });
    // Open tab in new window
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.WINDOW_OPEN_TAB, (_event, tabType, tabId, tabTitle, props) => {
        windowManager.openTabWindow(tabType, tabId, tabTitle, props);
    });
}
/**
 * Unregister all window IPC handlers
 */
function unregisterWindowHandlers() {
    const { ipcMain } = require('electron');
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_MINIMIZE);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_MAXIMIZE);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_CLOSE);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_OPEN_ORDER);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_OPEN_KLINE);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_OPEN_TAB);
}
//# sourceMappingURL=window.js.map