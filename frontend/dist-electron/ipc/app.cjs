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
const ipcWrapper_1 = require('../ipcWrapper.cjs');
/**
 * Register app info IPC handlers
 */
function registerAppInfoHandlers() {
    // Get app version
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.APP_VERSION, () => {
        return electron_1.app.getVersion();
    });
    // Get platform
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.APP_PLATFORM, () => {
        return process.platform;
    });
    // Get app name
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.APP_NAME, () => {
        return electron_1.app.getName();
    });
}
/**
 * Register backend management IPC handlers
 */
function registerBackendManagementHandlers(backendManager) {
    // Restart backend
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.BACKEND_RESTART, async () => {
        const success = await backendManager.restart();
        return { success };
    });
    // Get backend status
    (0, ipcWrapper_1.handleIPC)(index_1.IPC_CHANNELS.BACKEND_STATUS, () => {
        return backendManager.getStatus();
    });
}
/**
 * Unregister all app IPC handlers
 */
function unregisterAppHandlers() {
    const { ipcMain } = require('electron');
    ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_VERSION);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_PLATFORM);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.APP_NAME);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.BACKEND_RESTART);
    ipcMain.removeHandler(index_1.IPC_CHANNELS.BACKEND_STATUS);
}
//# sourceMappingURL=app.js.map