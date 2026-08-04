"use strict";
/**
 * IPC Monitor
 *
 * Monitors all IPC communications between main and renderer processes.
 * Sends captured messages to renderer for display in IPCMonitorPage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCMonitor = void 0;
exports.getIPCMonitor = getIPCMonitor;
const electron_1 = require("electron");
/**
 * IPCMonitor class
 *
 * Captures IPC messages and sends them to renderer windows.
 */
class IPCMonitor {
    constructor() {
        this.enabled = false;
        this.messages = [];
        this.maxMessages = 1000;
        this.listeners = new Set();
        this.originalHandlers = new Map();
    }
    /**
     * Enable IPC monitoring
     */
    enable() {
        if (this.enabled)
            return;
        this.enabled = true;
        this.setupInterceptors();
    }
    /**
     * Disable IPC monitoring
     */
    disable() {
        this.enabled = false;
        this.restoreHandlers();
    }
    /**
     * Check if monitoring is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get all captured messages
     */
    getMessages() {
        return [...this.messages];
    }
    /**
     * Clear all captured messages
     */
    clearMessages() {
        this.messages = [];
    }
    /**
     * Add a listener for new messages
     */
    addListener(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Notify all listeners of a new message
     */
    notifyListeners(msg) {
        this.messages.push(msg);
        // Trim to max messages
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
        for (const listener of this.listeners) {
            try {
                listener(msg);
            }
            catch (e) {
                console.error('[IPC Monitor] Listener error:', e);
            }
        }
    }
    /**
     * Setup IPC interceptors
     */
    setupInterceptors() {
        // Intercept all ipcMain.handle calls
        const originalHandle = electron_1.ipcMain.handle.bind(electron_1.ipcMain);
        const monitor = this;
        electron_1.ipcMain.handle = (channel, handler) => {
            // Wrap the handler to capture incoming messages
            const wrappedHandler = (event, ...args) => {
                if (monitor.enabled) {
                    monitor.notifyListeners({
                        timestamp: Date.now(),
                        direction: 'in',
                        channel,
                        data: args.length === 1 ? args[0] : args,
                        windowId: monitor.getWindowId(event.sender),
                    });
                }
                return handler(event, ...args);
            };
            // Store original handler for restoration
            monitor.originalHandlers.set(channel, handler);
            return originalHandle(channel, wrappedHandler);
        };
        // Note: We don't intercept webContents.send to avoid "Object has been destroyed" errors
        // The ipcMain.handle interceptor captures incoming messages from renderer
        // Outgoing messages (main → renderer) can be monitored by wrapping specific send calls
    }
    /**
     * Restore original IPC handlers
     */
    restoreHandlers() {
        // Note: Restoring handlers is complex due to Electron's API
        // For now, we just disable the monitoring flag
        // In production, consider using a Proxy pattern instead
    }
    /**
     * Get window ID from webContents
     */
    getWindowId(webContents) {
        const window = electron_1.BrowserWindow.fromWebContents(webContents);
        if (!window)
            return 'unknown';
        // Try to find window ID from our tracked windows
        const windows = electron_1.BrowserWindow.getAllWindows();
        const index = windows.indexOf(window);
        return index >= 0 ? `window-${index}` : 'unknown';
    }
    /**
     * Send monitoring data to a specific window
     */
    sendToWindow(window) {
        if (!this.enabled)
            return;
        // Send current messages
        window.webContents.send('ipc-monitor-messages', this.messages);
        // Set up real-time forwarding
        this.addListener((msg) => {
            if (!window.isDestroyed()) {
                window.webContents.send('ipc-monitor-message', msg);
            }
        });
    }
}
exports.IPCMonitor = IPCMonitor;
// Singleton instance
let monitorInstance = null;
/**
 * Get the IPC Monitor singleton instance
 */
function getIPCMonitor() {
    if (!monitorInstance) {
        monitorInstance = new IPCMonitor();
    }
    return monitorInstance;
}
//# sourceMappingURL=ipcMonitor.js.map