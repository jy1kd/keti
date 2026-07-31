/**
 * Auto Updater
 *
 * Manages automatic application updates using electron-updater.
 * Supports checking for updates, downloading, and installing.
 */
import { BrowserWindow } from 'electron';
export type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
export interface UpdateInfo {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
}
/**
 * AutoUpdaterManager class
 */
export declare class AutoUpdaterManager {
    private mainWindow;
    private status;
    private updateInfo;
    constructor();
    /**
     * Set the main window reference
     */
    setMainWindow(window: BrowserWindow): void;
    /**
     * Set up auto updater event handlers
     */
    private setupEventHandlers;
    /**
     * Check for updates
     */
    checkForUpdates(): Promise<void>;
    /**
     * Download update
     */
    downloadUpdate(): Promise<void>;
    /**
     * Install update and restart
     */
    quitAndInstall(): void;
    /**
     * Get current status
     */
    getStatus(): {
        status: UpdateStatus;
        updateInfo: UpdateInfo | null;
    };
    /**
     * Send status to renderer
     */
    private sendStatusToRenderer;
    /**
     * Prompt user to download update
     */
    private promptDownload;
    /**
     * Prompt user to install update
     */
    private promptInstall;
}
//# sourceMappingURL=autoUpdater.d.ts.map