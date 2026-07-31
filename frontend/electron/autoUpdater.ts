/**
 * Auto Updater
 *
 * Manages automatic application updates using electron-updater.
 * Supports checking for updates, downloading, and installing.
 */

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

// Update status
export type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

// Update info
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

/**
 * AutoUpdaterManager class
 */
export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = 'not-available';
  private updateInfo: UpdateInfo | null = null;

  constructor() {
    // Configure auto updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set up auto updater event handlers
   */
  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      this.status = 'checking';
      this.sendStatusToRenderer('checking-for-update');
      log.info('[AutoUpdater] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      this.status = 'available';
      this.updateInfo = {
        version: info.version,
        releaseDate: info.releaseDate?.toString() || new Date().toISOString(),
        releaseNotes: info.releaseNotes as string,
      };
      this.sendStatusToRenderer('update-available', this.updateInfo);
      log.info(`[AutoUpdater] Update available: ${info.version}`);

      // Ask user if they want to download
      this.promptDownload(info.version);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.status = 'not-available';
      this.sendStatusToRenderer('update-not-available');
      log.info('[AutoUpdater] Update not available');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.status = 'downloading';
      this.sendStatusToRenderer('download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      });
      log.info(`[AutoUpdater] Download progress: ${progress.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.status = 'downloaded';
      this.updateInfo = {
        version: info.version,
        releaseDate: info.releaseDate?.toString() || new Date().toISOString(),
        releaseNotes: info.releaseNotes as string,
      };
      this.sendStatusToRenderer('update-downloaded', this.updateInfo);
      log.info(`[AutoUpdater] Update downloaded: ${info.version}`);

      // Ask user if they want to install
      this.promptInstall(info.version);
    });

    autoUpdater.on('error', (error) => {
      this.status = 'error';
      this.sendStatusToRenderer('error', { message: error.message });
      log.error('[AutoUpdater] Error:', error);
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('[AutoUpdater] Failed to check for updates:', error);
    }
  }

  /**
   * Download update
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('[AutoUpdater] Failed to download update:', error);
    }
  }

  /**
   * Install update and restart
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Get current status
   */
  getStatus(): { status: UpdateStatus; updateInfo: UpdateInfo | null } {
    return {
      status: this.status,
      updateInfo: this.updateInfo,
    };
  }

  /**
   * Send status to renderer
   */
  private sendStatusToRenderer(event: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', { event, data });
    }
  }

  /**
   * Prompt user to download update
   */
  private promptDownload(version: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${version}`,
      detail: '是否现在下载？',
      buttons: ['下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        this.downloadUpdate();
      }
    });
  }

  /**
   * Prompt user to install update
   */
  private promptInstall(version: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: `版本 ${version} 已下载完成`,
      detail: '是否立即安装并重启？',
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        this.quitAndInstall();
      }
    });
  }
}
