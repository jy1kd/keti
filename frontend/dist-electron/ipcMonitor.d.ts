/**
 * IPC Monitor
 *
 * Monitors all IPC communications between main and renderer processes.
 * Sends captured messages to renderer for display in IPCMonitorPage.
 */
import { BrowserWindow } from 'electron';
interface IPCMessage {
    timestamp: number;
    direction: 'in' | 'out';
    channel: string;
    data?: unknown;
    windowId?: string;
}
/**
 * IPCMonitor class
 *
 * Captures IPC messages and sends them to renderer windows.
 */
export declare class IPCMonitor {
    private enabled;
    private messages;
    private maxMessages;
    private listeners;
    private originalHandlers;
    /**
     * Enable IPC monitoring
     */
    enable(): void;
    /**
     * Disable IPC monitoring
     */
    disable(): void;
    /**
     * Check if monitoring is enabled
     */
    isEnabled(): boolean;
    /**
     * Get all captured messages
     */
    getMessages(): IPCMessage[];
    /**
     * Clear all captured messages
     */
    clearMessages(): void;
    /**
     * Add a listener for new messages
     */
    addListener(listener: (msg: IPCMessage) => void): () => void;
    /**
     * Notify all listeners of a new message
     */
    private notifyListeners;
    /**
     * Setup IPC interceptors
     */
    private setupInterceptors;
    /**
     * Restore original IPC handlers
     */
    private restoreHandlers;
    /**
     * Get window ID from webContents
     */
    private getWindowId;
    /**
     * Send monitoring data to a specific window
     */
    sendToWindow(window: BrowserWindow): void;
}
/**
 * Get the IPC Monitor singleton instance
 */
export declare function getIPCMonitor(): IPCMonitor;
export {};
//# sourceMappingURL=ipcMonitor.d.ts.map