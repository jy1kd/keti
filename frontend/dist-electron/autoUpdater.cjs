"use strict";
/**
 * Auto Updater
 *
 * Manages automatic application updates using electron-updater.
 * Supports checking for updates, downloading, and installing.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoUpdaterManager = void 0;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
/**
 * AutoUpdaterManager class
 */
class AutoUpdaterManager {
    constructor() {
        this.mainWindow = null;
        this.status = 'not-available';
        this.updateInfo = null;
        // Configure auto updater
        electron_updater_1.autoUpdater.logger = electron_log_1.default;
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        // Set up event handlers
        this.setupEventHandlers();
    }
    /**
     * Set the main window reference
     */
    setMainWindow(window) {
        this.mainWindow = window;
    }
    /**
     * Set up auto updater event handlers
     */
    setupEventHandlers() {
        electron_updater_1.autoUpdater.on('checking-for-update', () => {
            this.status = 'checking';
            this.sendStatusToRenderer('checking-for-update');
            electron_log_1.default.info('[AutoUpdater] Checking for update...');
        });
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            this.status = 'available';
            this.updateInfo = {
                version: info.version,
                releaseDate: info.releaseDate?.toString() || new Date().toISOString(),
                releaseNotes: info.releaseNotes,
            };
            this.sendStatusToRenderer('update-available', this.updateInfo);
            electron_log_1.default.info(`[AutoUpdater] Update available: ${info.version}`);
            // Ask user if they want to download
            this.promptDownload(info.version);
        });
        electron_updater_1.autoUpdater.on('update-not-available', (info) => {
            this.status = 'not-available';
            this.sendStatusToRenderer('update-not-available');
            electron_log_1.default.info('[AutoUpdater] Update not available');
        });
        electron_updater_1.autoUpdater.on('download-progress', (progress) => {
            this.status = 'downloading';
            this.sendStatusToRenderer('download-progress', {
                percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                total: progress.total,
                transferred: progress.transferred,
            });
            electron_log_1.default.info(`[AutoUpdater] Download progress: ${progress.percent.toFixed(2)}%`);
        });
        electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
            this.status = 'downloaded';
            this.updateInfo = {
                version: info.version,
                releaseDate: info.releaseDate?.toString() || new Date().toISOString(),
                releaseNotes: info.releaseNotes,
            };
            this.sendStatusToRenderer('update-downloaded', this.updateInfo);
            electron_log_1.default.info(`[AutoUpdater] Update downloaded: ${info.version}`);
            // Ask user if they want to install
            this.promptInstall(info.version);
        });
        electron_updater_1.autoUpdater.on('error', (error) => {
            this.status = 'error';
            this.sendStatusToRenderer('error', { message: error.message });
            electron_log_1.default.error('[AutoUpdater] Error:', error);
        });
    }
    /**
     * Check for updates
     */
    async checkForUpdates() {
        try {
            await electron_updater_1.autoUpdater.checkForUpdates();
        }
        catch (error) {
            electron_log_1.default.error('[AutoUpdater] Failed to check for updates:', error);
        }
    }
    /**
     * Download update
     */
    async downloadUpdate() {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
        }
        catch (error) {
            electron_log_1.default.error('[AutoUpdater] Failed to download update:', error);
        }
    }
    /**
     * Install update and restart
     */
    quitAndInstall() {
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
    }
    /**
     * Get current status
     */
    getStatus() {
        return {
            status: this.status,
            updateInfo: this.updateInfo,
        };
    }
    /**
     * Send status to renderer
     */
    sendStatusToRenderer(event, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update-status', { event, data });
        }
    }
    /**
     * Prompt user to download update
     */
    promptDownload(version) {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        electron_1.dialog.showMessageBox(this.mainWindow, {
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
    promptInstall(version) {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        electron_1.dialog.showMessageBox(this.mainWindow, {
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
exports.AutoUpdaterManager = AutoUpdaterManager;
//# sourceMappingURL=autoUpdater.js.map