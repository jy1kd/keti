"use strict";
/**
 * App IPC Handlers
 *
 * Handles all app-related IPC communications:
 * - App info (version, platform, name)
 * - Backend management (restart, status)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAppInfoHandlers = registerAppInfoHandlers;
exports.registerBackendManagementHandlers = registerBackendManagementHandlers;
exports.unregisterAppHandlers = unregisterAppHandlers;
const electron_1 = require("electron");
const index_1 = require('./index.cjs');
/**
 * Register app info IPC handlers
 */
function registerAppInfoHandlers() {
    // Get app version
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.APP_VERSION, () => {
        return electron_1.app.getVersion();
    });
    // Get platform
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.APP_PLATFORM, () => {
        return process.platform;
    });
    // Get app name
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.APP_NAME, () => {
        return electron_1.app.getName();
    });
}
/**
 * Register backend management IPC handlers
 */
function registerBackendManagementHandlers(backendManager) {
    // Restart backend
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.BACKEND_RESTART, async () => {
        const success = await backendManager.restart();
        return { success };
    });
    // Get backend status
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.BACKEND_STATUS, () => {
        return backendManager.getStatus();
    });
}
/**
 * Unregister all app IPC handlers
 */
function unregisterAppHandlers() {
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_VERSION);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_PLATFORM);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_NAME);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.BACKEND_RESTART);
    electron_1.ipcMain.removeHandler(index_1.IPC_CHANNELS.BACKEND_STATUS);
}
//# sourceMappingURL=app.js.map