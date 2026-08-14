/**
 * Electron Service
 *
 * Provides a clean API for the renderer process to interact with Electron.
 * This service wraps the electronAPI exposed by the preload script.
 */

import type {
  ElectronAPI,
  BackendStatus,
  OrderUpdateEvent,
  NotificationEvent,
} from '../../electron/ipc/index';

// Check if running in Electron (dynamic check for testability)
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Get the Electron API (only available in Electron environment)
 */
function getElectronAPI(): ElectronAPI {
  if (!isElectron()) {
    throw new Error('Electron API is not available. This function can only be used in Electron environment.');
  }
  return window.electronAPI!;
}

// Window control
export async function minimizeWindow(): Promise<void> {
  return getElectronAPI().minimizeWindow();
}

export async function maximizeWindow(): Promise<void> {
  return getElectronAPI().maximizeWindow();
}

export async function closeWindow(): Promise<void> {
  return getElectronAPI().closeWindow();
}

// Window management
export async function openOrderWindow(instrumentID?: string): Promise<void> {
  return getElectronAPI().openOrderWindow(instrumentID);
}

export async function openKLineWindow(instrumentID: string): Promise<void> {
  return getElectronAPI().openKLineWindow(instrumentID);
}

export async function openTabWindow(tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>): Promise<void> {
  return getElectronAPI().openTabWindow(tabType, tabId, tabTitle, props);
}

// App info
export async function getAppVersion(): Promise<string> {
  return getElectronAPI().getAppVersion();
}

export async function getPlatform(): Promise<string> {
  return getElectronAPI().getPlatform();
}

export async function getAppName(): Promise<string> {
  return getElectronAPI().getAppName();
}

// Backend management
export async function restartBackend(): Promise<void> {
  return getElectronAPI().restartBackend();
}

export async function getBackendStatus(): Promise<BackendStatus> {
  return getElectronAPI().getBackendStatus();
}

// Event listeners
export function onOrderUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
  return getElectronAPI().onOrderUpdate(callback);
}

export function onNotification(callback: (data: NotificationEvent) => void): () => void {
  return getElectronAPI().onNotification(callback);
}

export function removeAllListeners(channel: string): void {
  return getElectronAPI().removeAllListeners(channel);
}

// Type-safe window.electronAPI declaration
declare global {
  interface Window {
    electronAPI?: {
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

      // Navigation
      onNavigateTab: (callback: (tab: string) => void) => () => void;

      // Menu (main → renderer): 顶部菜单打开浮动窗
      onOpenFloatingTab: (callback: (tab: 'order' | 'kline' | 'infinite' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account') => void) => () => void;

      // Menu (main → renderer): 切换 FPS 监控
      onTogglePerf: (callback: () => void) => () => void;

      // Menu (main → renderer): 行情主页内切换视图（期货/自选/期权）
      onMarketView: (callback: (view: 'all' | 'favorites' | 'options') => void) => () => void;

      // Data exchange
      onGetSelectedInstrument: (callback: () => string) => () => void;
      sendSelectedInstrument: (instrumentID: string) => void;

      // Event listeners
      onOrderUpdate: (callback: (data: any) => void) => () => void;
      onNotification: (callback: (data: any) => void) => () => void;

      // IPC Monitor listeners
      onIPCMonitorMessages: (callback: (messages: any[]) => void) => () => void;
      onIPCMonitorMessage: (callback: (message: any) => void) => () => void;

      removeAllListeners: (channel: string) => void;
    };
  }
}
