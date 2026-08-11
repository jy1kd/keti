/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * The context menu mirrors the top application menu (shared template, menuTemplate.ts)
 * plus a top-level 退出 item. Supports tray icon, context menu, and notifications.
 */
import { Tray } from 'electron';
import type { BrowserWindow } from 'electron';
import type { WindowManager } from './windowManager';
export interface TrayNotification {
    title: string;
    content: string;
}
/**
 * TrayManager class
 */
export declare class TrayManager {
    private tray;
    private mainWindow;
    private isQuitting;
    /**
     * Initialize the tray with a main window and window manager reference.
     * The context menu mirrors the native app menu (shared template) with 退出 at the bottom.
     */
    initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void;
    /**
     * Show a balloon notification
     */
    showNotification(notification: TrayNotification): void;
    /**
     * Get the tray instance
     */
    getTray(): Tray | null;
    /**
     * Destroy the tray
     */
    destroy(): void;
}
//# sourceMappingURL=trayManager.d.ts.map