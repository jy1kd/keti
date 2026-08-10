/**
 * IPC Channel Definitions
 *
 * Centralized definition of all IPC channels used for communication
 * between the main process and renderer process.
 *
 * ⚠️ IMPORTANT: preload.ts uses hardcoded channel strings that must match
 * these constants. When adding new channels, update both files.
 */

// IPC Channel constants
export const IPC_CHANNELS = {
  // Window control
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Window management
  WINDOW_OPEN_ORDER: 'window:open-order',
  WINDOW_OPEN_KLINE: 'window:open-kline',
  WINDOW_OPEN_TAB: 'window:open-tab',

  // App info
  APP_VERSION: 'app:version',
  APP_PLATFORM: 'app:platform',
  APP_NAME: 'app:name',

  // Backend management
  BACKEND_RESTART: 'backend:restart',
  BACKEND_STATUS: 'backend:status',

  // Navigation (main → renderer)
  NAVIGATE_TAB: 'navigate:tab',
  MENU_OPEN_FLOATING: 'menu:open-floating',
  MENU_TOGGLE_PERF: 'menu:toggle-perf',
  MENU_MARKET_VIEW: 'menu:market-view',

  // Data exchange (renderer → main)
  GET_SELECTED_INSTRUMENT: 'data:get-selected-instrument',
  SELECTED_INSTRUMENT_RESPONSE: 'data:selected-instrument-response',

  // Events (main → renderer)
  EVENT_ORDER_UPDATE: 'order:update',
  EVENT_NOTIFICATION: 'notification',
} as const;

// IPC Channel type
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// IPC Response type
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Window control types
export interface WindowControlAPI {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

// Window management types
export interface WindowManagementAPI {
  openOrderWindow: (instrumentID?: string) => Promise<void>;
  openKLineWindow: (instrumentID: string) => Promise<void>;
  openTabWindow: (tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>) => Promise<void>;
}

// App info types
export interface AppInfoAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getAppName: () => Promise<string>;
}

// Backend management types
export interface BackendManagementAPI {
  restartBackend: () => Promise<void>;
  getBackendStatus: () => Promise<{ running: boolean; pid?: number }>;
}

// Event listener types
export interface EventListenerAPI {
  onOrderUpdate: (callback: (data: any) => void) => () => void;
  onNotification: (callback: (data: any) => void) => () => void;
  removeAllListeners: (channel: string) => void;
}

// Complete Electron API interface
export interface ElectronAPI extends
  WindowControlAPI,
  WindowManagementAPI,
  AppInfoAPI,
  BackendManagementAPI,
  EventListenerAPI {}

// Backend status type
export interface BackendStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime?: number;
}

// Order update event type
export interface OrderUpdateEvent {
  orderRef: string;
  instrumentID: string;
  status: string;
  message?: string;
  timestamp: number;
}

// Notification event type
export interface NotificationEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  action?: {
    type: 'open-window';
    target: string;
    params?: Record<string, any>;
  };
}
