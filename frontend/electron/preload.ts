import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
export interface ElectronAPI {
  // Window control
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Window management
  openOrderWindow: (instrumentID?: string) => Promise<void>;
  openKLineWindow: (instrumentID: string) => Promise<void>;

  // App info
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getAppName: () => Promise<string>;

  // Backend management
  restartBackend: () => Promise<void>;
  getBackendStatus: () => Promise<{ running: boolean; pid?: number }>;

  // Event listeners
  onOrderUpdate: (callback: (data: any) => void) => void;
  onNotification: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window control
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Window management
  openOrderWindow: (instrumentID?: string) =>
    ipcRenderer.invoke('window:open-order', instrumentID),
  openKLineWindow: (instrumentID: string) =>
    ipcRenderer.invoke('window:open-kline', instrumentID),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getAppName: () => ipcRenderer.invoke('app:name'),

  // Backend management
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),

  // Event listeners
  onOrderUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('order:update', (_, data) => callback(data));
  },
  onNotification: (callback: (data: any) => void) => {
    ipcRenderer.on('notification', (_, data) => callback(data));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
} as ElectronAPI);
