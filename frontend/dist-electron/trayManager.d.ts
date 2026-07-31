/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */
import { Tray, BrowserWindow } from 'electron';
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
    /**
     * Initialize the tray with a main window reference
     */
    initialize(mainWindow: BrowserWindow): void;
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