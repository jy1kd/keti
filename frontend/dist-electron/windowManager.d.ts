/**
 * Window Manager
 *
 * Manages multiple BrowserWindow instances for the Electron application.
 * Supports creating, closing, and switching between windows.
 */
import { BrowserWindow } from 'electron';
export interface WindowConfig {
    id: string;
    title: string;
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    x?: number;
    y?: number;
    parent?: BrowserWindow;
    modal?: boolean;
}
export interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
}
/**
 * WindowManager class
 */
export declare class WindowManager {
    private windows;
    private windowStates;
    private isDev;
    constructor(isDev?: boolean);
    /**
     * Create the main application window
     */
    createMainWindow(): BrowserWindow;
    /**
     * Open order window for a specific instrument
     */
    openOrderWindow(instrumentID?: string): BrowserWindow;
    /**
     * Open K-line window for a specific instrument
     */
    openKLineWindow(instrumentID: string): BrowserWindow;
    /**
     * Get a window by ID
     */
    getWindow(id: string): BrowserWindow | null;
    /**
     * Get all active windows
     */
    getAllWindows(): BrowserWindow[];
    /**
     * Close all windows
     */
    closeAllWindows(): void;
    /**
     * Send message to a specific window
     */
    sendToWindow(windowId: string, channel: string, data: any): void;
    /**
     * Broadcast message to all windows
     */
    broadcast(channel: string, data: any): void;
    /**
     * Save window state for persistence
     */
    saveWindowState(id: string): void;
    /**
     * Get saved window state
     */
    getWindowState(id: string): WindowState | null;
    /**
     * Restore window state
     */
    restoreWindowState(id: string): void;
}
//# sourceMappingURL=windowManager.d.ts.map