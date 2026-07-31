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
const electron_1 = require("electron");
const index_1 = require("./index");
/**
 * Register window control IPC handlers
 */
function registerWindowControlHandlers(mainWindow) {
    // Minimize window
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.WINDOW_MINIMIZE, () => {
        mainWindow.minimize();
    });
    // Maximize/restore window
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    });
    // Close window
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.WINDOW_CLOSE, () => {
        mainWindow.close();
    });
}
/**
 * Register window management IPC handlers
 */
function registerWindowManagementHandlers(windowManager) {
    // Open order window
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.WINDOW_OPEN_ORDER, (_event, instrumentID) => {
        windowManager.openOrderWindow(instrumentID);
    });
    // Open K-line window
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.WINDOW_OPEN_KLINE, (_event, instrumentID) => {
        windowManager.openKLineWindow(instrumentID);
    });
}
/**
 * Unregister all window IPC handlers
 */
function unregisterWindowHandlers() {
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_MINIMIZE);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_MAXIMIZE);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_CLOSE);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_OPEN_ORDER);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.WINDOW_OPEN_KLINE);
}
//# sourceMappingURL=window.js.map