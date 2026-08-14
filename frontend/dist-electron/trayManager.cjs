"use strict";
/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * The context menu mirrors the top application menu (shared template, menuTemplate.ts)
 * plus a top-level 退出 item. Supports tray icon, context menu, and notifications.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const menuTemplate_1 = require('./menuTemplate.cjs');
/**
 * TrayManager class
 */
class TrayManager {
    constructor() {
        this.tray = null;
        this.mainWindow = null;
        this.isQuitting = false;
    }
    /**
     * Initialize the tray with a main window and window manager reference.
     * The context menu mirrors the native app menu (shared template) with 退出 at the bottom.
     */
    initialize(mainWindow, windowManager) {
        this.mainWindow = mainWindow;
        // 退出标志：app.quit() 时放行窗口关闭；否则 close 事件会被拦截，应用无法退出。
        // 刻意不重置：本应用无「取消退出」路径（无其他 close/before-quit 拦截方），不存在需复位该标志的场景。
        electron_1.app.on('before-quit', () => {
            this.isQuitting = true;
        });
        // Create tray icon
        const iconPath = path_1.default.join(__dirname, '../build/icon.png');
        // Check if icon file exists
        if (!fs_1.default.existsSync(iconPath)) {
            console.warn('[TrayManager] Tray icon not found:', iconPath);
            // Create a simple 16x16 transparent icon as fallback
            const fallbackIcon = electron_1.nativeImage.createEmpty();
            this.tray = new electron_1.Tray(fallbackIcon);
        }
        else {
            const icon = electron_1.nativeImage.createFromPath(iconPath);
            this.tray = new electron_1.Tray(icon);
        }
        this.tray.setToolTip('SimNow 交易终端');
        // 托盘菜单 = 共享四组定义（剔除「设置」内嵌退出 app-quit）+ 一级底部退出
        const def = [
            ...(0, menuTemplate_1.getAppMenuDef)(),
            { id: 'tray-sep', type: 'separator' },
            { id: 'tray-quit', label: '退出', action: { type: 'quit' } },
        ];
        const ctx = { mainWindow, windowManager };
        this.tray.setContextMenu(electron_1.Menu.buildFromTemplate((0, menuTemplate_1.buildMenuFromDef)(def, ctx, { omitIds: ['app-quit'] })));
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
        // Handle window close - minimize to tray instead of quitting (except while quitting)
        if (this.mainWindow) {
            this.mainWindow.on('close', (event) => {
                if (!this.isQuitting && this.mainWindow && !this.mainWindow.isDestroyed()) {
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