import { contextBridge, ipcRenderer } from 'electron';

// ⚠️ IMPORTANT: The IPC channel strings below must match those defined in ipc/index.ts
// This file cannot import from ipc/index.ts directly (different execution context),
// so channel names are hardcoded. Keep them in sync manually.

// Define the API interface
export interface ElectronAPI {
  // Window control
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Window management
  openOrderWindow: (instrumentID?: string) => Promise<void>;
  openKLineWindow: (instrumentID: string) => Promise<void>;
  openTabWindow: (tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>) => Promise<void>;

  // App info
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getAppName: () => Promise<string>;

  // Backend management
  restartBackend: () => Promise<void>;
  getBackendStatus: () => Promise<{ running: boolean; pid?: number }>;

  // Navigation (main → renderer)
  onNavigateTab: (callback: (tab: string) => void) => () => void;

  // Data exchange (renderer → main)
  onGetSelectedInstrument: (callback: () => string) => () => void;
  sendSelectedInstrument: (instrumentID: string) => void;

  // Event listeners (return cleanup function to prevent memory leaks)
  onOrderUpdate: (callback: (data: any) => void) => () => void;
  onNotification: (callback: (data: any) => void) => () => void;
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
  openTabWindow: (tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>) =>
    ipcRenderer.invoke('window:open-tab', tabType, tabId, tabTitle, props),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getAppName: () => ipcRenderer.invoke('app:name'),

  // Backend management
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),

  // Navigation (main → renderer)
  onNavigateTab: (callback: (tab: string) => void) => {
    const handler = (_: any, tab: string) => callback(tab);
    ipcRenderer.on('navigate:tab', handler);
    return () => ipcRenderer.removeListener('navigate:tab', handler);
  },

  // Data exchange (renderer → main)
  onGetSelectedInstrument: (callback: () => string) => {
    const handler = () => callback();
    ipcRenderer.on('data:get-selected-instrument', handler);
    return () => ipcRenderer.removeListener('data:get-selected-instrument', handler);
  },
  sendSelectedInstrument: (instrumentID: string) => {
    ipcRenderer.invoke('data:selected-instrument-response', instrumentID);
  },

  // Event listeners (return cleanup function to prevent memory leaks)
  onOrderUpdate: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('order:update', handler);
    return () => ipcRenderer.removeListener('order:update', handler);
  },
  onNotification: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('notification', handler);
    return () => ipcRenderer.removeListener('notification', handler);
  },

  // IPC Monitor listeners
  onIPCMonitorMessages: (callback: (messages: any[]) => void) => {
    const handler = (_: any, messages: any[]) => callback(messages);
    ipcRenderer.on('ipc-monitor-messages', handler);
    return () => ipcRenderer.removeListener('ipc-monitor-messages', handler);
  },
  onIPCMonitorMessage: (callback: (message: any) => void) => {
    const handler = (_: any, message: any) => callback(message);
    ipcRenderer.on('ipc-monitor-message', handler);
    return () => ipcRenderer.removeListener('ipc-monitor-message', handler);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
} as ElectronAPI);
