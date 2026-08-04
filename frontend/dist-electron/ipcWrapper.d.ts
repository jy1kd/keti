/**
 * IPC Wrapper
 *
 * Wraps IPC handlers to automatically log messages for IPC Monitor.
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
 * Add a listener for IPC messages
 */
export declare function addIPCListener(listener: (msg: IPCMessage) => void): () => void;
/**
 * Get all captured messages
 */
export declare function getIPCMessages(): IPCMessage[];
/**
 * Clear all captured messages
 */
export declare function clearIPCMessages(): void;
/**
 * Wrap an IPC handler to log messages
 */
export declare function wrapHandler<T extends (...args: any[]) => any>(channel: string, handler: T): T;
/**
 * Register an IPC handler with logging
 */
export declare function handleIPC(channel: string, handler: (event: any, ...args: any[]) => any): void;
/**
 * Send message to a window with logging
 */
export declare function sendToWindow(window: BrowserWindow, channel: string, ...args: any[]): void;
/**
 * Broadcast message to all windows with logging
 */
export declare function broadcast(channel: string, ...args: any[]): void;
/**
 * Send IPC monitor data to a specific window
 */
export declare function sendIPCMonitorToWindow(window: BrowserWindow): void;
export {};
//# sourceMappingURL=ipcWrapper.d.ts.map