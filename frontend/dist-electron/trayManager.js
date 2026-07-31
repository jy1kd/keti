/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */
import { Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
/**
 * TrayManager class
 */
export class TrayManager {
    constructor() {
        this.tray = null;
        this.mainWindow = null;
    }
    /**
     * Initialize the tray with a main window reference
     */
    initialize(mainWindow) {
        this.mainWindow = mainWindow;
        // Create tray icon
        const iconPath = path.join(__dirname, '../assets/tray-icon.png');
        // Check if icon file exists
        if (!fs.existsSync(iconPath)) {
            console.warn('[TrayManager] Tray icon not found:', iconPath);
            console.warn('[TrayManager] Tray functionality will be limited');
            // Create a simple 16x16 transparent icon as fallback
            const fallbackIcon = nativeImage.createEmpty();
            this.tray = new Tray(fallbackIcon);
        }
        else {
            const icon = nativeImage.createFromPath(iconPath);
            this.tray = new Tray(icon);
        }
        this.tray.setToolTip('SimNow 交易终端');
        // Build context menu
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                    }
                },
            },
            { type: 'separator' },
            {
                label: '行情面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        // TODO: Switch to market tab
                    }
                },
            },
            {
                label: '报单面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        // TODO: Switch to order tab
                    }
                },
            },
            {
                label: '查询面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        // TODO: Switch to query tab
                    }
                },
            },
            { type: 'separator' },
            {
                label: '设置',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        // TODO: Open settings panel
                    }
                },
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.destroy();
                    }
                    this.destroy();
                },
            },
        ]);
        this.tray.setContextMenu(contextMenu);
        // Handle tray click (show/hide window)
        this.tray.on('click', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isVisible()) {
                    this.mainWindow.hide();
                }
                else {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                }
            }
        });
        // Handle window close - minimize to tray instead of quitting
        if (this.mainWindow) {
            this.mainWindow.on('close', (event) => {
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    event.preventDefault();
                    this.mainWindow.hide();
                }
            });
        }
    }
    /**
     * Show a balloon notification
     */
    showNotification(notification) {
        if (this.tray && !this.tray.isDestroyed()) {
            this.tray.displayBalloon({
                title: notification.title,
                content: notification.content,
            });
        }
    }
    /**
     * Get the tray instance
     */
    getTray() {
        return this.tray;
    }
    /**
     * Destroy the tray
     */
    destroy() {
        if (this.tray && !this.tray.isDestroyed()) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}
//# sourceMappingURL=trayManager.js.map