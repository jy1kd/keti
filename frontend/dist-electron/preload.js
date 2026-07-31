import { contextBridge, ipcRenderer } from 'electron';
// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window control
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    // Window management
    openOrderWindow: (instrumentID) => ipcRenderer.invoke('window:open-order', instrumentID),
    openKLineWindow: (instrumentID) => ipcRenderer.invoke('window:open-kline', instrumentID),
    // App info
    getAppVersion: () => ipcRenderer.invoke('app:version'),
    getPlatform: () => ipcRenderer.invoke('app:platform'),
    getAppName: () => ipcRenderer.invoke('app:name'),
    // Backend management
    restartBackend: () => ipcRenderer.invoke('backend:restart'),
    getBackendStatus: () => ipcRenderer.invoke('backend:status'),
    // Event listeners (return cleanup function to prevent memory leaks)
    onOrderUpdate: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on('order:update', handler);
        return () => ipcRenderer.removeListener('order:update', handler);
    },
    onNotification: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on('notification', handler);
        return () => ipcRenderer.removeListener('notification', handler);
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
});
//# sourceMappingURL=preload.js.map