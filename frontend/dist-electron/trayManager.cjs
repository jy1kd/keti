"use strict";
/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayManager = void 0;
const electron_1 = require("electron");
const index_1 = require('./ipc/index.cjs');
/**
 * TrayManager class
 */
class TrayManager {
    constructor() {
        this.tray = null;
        this.mainWindow = null;
    }
    /**
     * Initialize the tray with a main window reference
     */
    initialize(mainWindow) {
        this.mainWindow = mainWindow;
        // Create tray icon (use empty icon as fallback since build/icon.png was removed)
        const fallbackIcon = electron_1.nativeImage.createEmpty();
        this.tray = new electron_1.Tray(fallbackIcon);
        this.tray.setToolTip('SimNow 交易终端');
        // Build context menu
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
                label: '📊 行情',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'market');
                    }
                },
            },
            {
                label: '⭐ 自选',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'favorites');
                    }
                },
            },
            {
                label: '📝 报单',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'order');
                    }
                },
            },
            {
                label: '📋 查询',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'query');
                    }
                },
            },
            {
                label: '📈 K线',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'kline');
                    }
                },
            },
            { type: 'separator' },
            {
                label: '⚙ 设置',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'settings');
                    }
                },
            },
            {
                label: '🔌 IPC 监控',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'ipc-monitor');
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
exports.TrayManager = TrayManager;
//# sourceMappingURL=trayManager.js.map