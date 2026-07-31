"use strict";
/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./ipc/index");
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
        // Create tray icon
        const iconPath = path_1.default.join(__dirname, '../assets/tray-icon.png');
        // Check if icon file exists
        if (!fs_1.default.existsSync(iconPath)) {
            console.warn('[TrayManager] Tray icon not found:', iconPath);
            console.warn('[TrayManager] Tray functionality will be limited');
            // Create a simple 16x16 transparent icon as fallback
            const fallbackIcon = electron_1.nativeImage.createEmpty();
            this.tray = new electron_1.Tray(fallbackIcon);
        }
        else {
            const icon = electron_1.nativeImage.createFromPath(iconPath);
            this.tray = new electron_1.Tray(icon);
        }
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
                label: '行情面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'market');
                    }
                },
            },
            {
                label: '报单面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'order');
                    }
                },
            },
            {
                label: '查询面板',
                click: () => {
                    if (this.mainWindow) {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'query');
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
                        this.mainWindow.webContents.send(index_1.IPC_CHANNELS.NAVIGATE_TAB, 'settings');
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