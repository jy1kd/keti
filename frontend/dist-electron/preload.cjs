"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Window control
    minimizeWindow: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('window:maximize'),
    closeWindow: () => electron_1.ipcRenderer.invoke('window:close'),
    // Window management
    openOrderWindow: (instrumentID) => electron_1.ipcRenderer.invoke('window:open-order', instrumentID),
    openKLineWindow: (instrumentID) => electron_1.ipcRenderer.invoke('window:open-kline', instrumentID),
    // App info
    getAppVersion: () => electron_1.ipcRenderer.invoke('app:version'),
    getPlatform: () => electron_1.ipcRenderer.invoke('app:platform'),
    getAppName: () => electron_1.ipcRenderer.invoke('app:name'),
    // Backend management
    restartBackend: () => electron_1.ipcRenderer.invoke('backend:restart'),
    getBackendStatus: () => electron_1.ipcRenderer.invoke('backend:status'),
    // Navigation (main → renderer)
    onNavigateTab: (callback) => {
        const handler = (_, tab) => callback(tab);
        electron_1.ipcRenderer.on('navigate:tab', handler);
        return () => electron_1.ipcRenderer.removeListener('navigate:tab', handler);
    },
    // Data exchange (renderer → main)
    onGetSelectedInstrument: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('data:get-selected-instrument', handler);
        return () => electron_1.ipcRenderer.removeListener('data:get-selected-instrument', handler);
    },
    sendSelectedInstrument: (instrumentID) => {
        electron_1.ipcRenderer.invoke('data:selected-instrument-response', instrumentID);
    },
    // Event listeners (return cleanup function to prevent memory leaks)
    onOrderUpdate: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('order:update', handler);
        return () => electron_1.ipcRenderer.removeListener('order:update', handler);
    },
    onNotification: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('notification', handler);
        return () => electron_1.ipcRenderer.removeListener('notification', handler);
    },
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    },
});
//# sourceMappingURL=preload.js.map