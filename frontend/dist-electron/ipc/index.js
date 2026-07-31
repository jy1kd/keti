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
    // App info
    APP_VERSION: 'app:version',
    APP_PLATFORM: 'app:platform',
    APP_NAME: 'app:name',
    // Backend management
    BACKEND_RESTART: 'backend:restart',
    BACKEND_STATUS: 'backend:status',
    // Events (main → renderer)
    EVENT_ORDER_UPDATE: 'order:update',
    EVENT_NOTIFICATION: 'notification',
};
//# sourceMappingURL=index.js.map