/**
 * IPC Channel Definitions
 *
 * Centralized definition of all IPC channels used for communication
 * between the main process and renderer process.
 *
 * ⚠️ IMPORTANT: preload.ts uses hardcoded channel strings that must match
 * these constants. When adding new channels, update both files.
 */
export declare const IPC_CHANNELS: {
    readonly WINDOW_MINIMIZE: "window:minimize";
    readonly WINDOW_MAXIMIZE: "window:maximize";
    readonly WINDOW_CLOSE: "window:close";
    readonly WINDOW_OPEN_ORDER: "window:open-order";
    readonly WINDOW_OPEN_KLINE: "window:open-kline";
    readonly APP_VERSION: "app:version";
    readonly APP_PLATFORM: "app:platform";
    readonly APP_NAME: "app:name";
    readonly BACKEND_RESTART: "backend:restart";
    readonly BACKEND_STATUS: "backend:status";
    readonly NAVIGATE_TAB: "navigate:tab";
    readonly GET_SELECTED_INSTRUMENT: "data:get-selected-instrument";
    readonly SELECTED_INSTRUMENT_RESPONSE: "data:selected-instrument-response";
    readonly EVENT_ORDER_UPDATE: "order:update";
    readonly EVENT_NOTIFICATION: "notification";
};
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
export interface IPCResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface WindowControlAPI {
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
}
export interface WindowManagementAPI {
    openOrderWindow: (instrumentID?: string) => Promise<void>;
    openKLineWindow: (instrumentID: string) => Promise<void>;
}
export interface AppInfoAPI {
    getAppVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getAppName: () => Promise<string>;
}
export interface BackendManagementAPI {
    restartBackend: () => Promise<void>;
    getBackendStatus: () => Promise<{
        running: boolean;
        pid?: number;
    }>;
}
export interface EventListenerAPI {
    onOrderUpdate: (callback: (data: any) => void) => () => void;
    onNotification: (callback: (data: any) => void) => () => void;
    removeAllListeners: (channel: string) => void;
}
export interface ElectronAPI extends WindowControlAPI, WindowManagementAPI, AppInfoAPI, BackendManagementAPI, EventListenerAPI {
}
export interface BackendStatus {
    running: boolean;
    pid?: number;
    port?: number;
    uptime?: number;
}
export interface OrderUpdateEvent {
    orderRef: string;
    instrumentID: string;
    status: string;
    message?: string;
    timestamp: number;
}
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
//# sourceMappingURL=index.d.ts.map