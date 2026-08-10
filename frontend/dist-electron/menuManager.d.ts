/**
 * Menu Manager
 *
 * Manages the application menu bar for the Electron application.
 * Replaces Electron's default File/Edit/Window/Help menus with app menus:
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 */
import { BrowserWindow } from 'electron';
import { WindowManager } from './windowManager';
/**
 * MenuManager class
 */
export declare class MenuManager {
    private mainWindow;
    private windowManager;
    /**
     * Set the application menu: app menus + the default View menu.
     */
    initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void;
    /**
     * Open the market tab in a separate window (mirrors TabBar 右键「在新窗口打开」).
     */
    private openMarketInNewWindow;
    /**
     * Send a request to the main window's renderer to open a floating tab.
     */
    private sendOpenFloating;
    /**
     * Send a request to the main window's renderer to switch the market home view
     * (全部/自选/T型期权) without creating new tabs.
     */
    private sendMarketView;
    /**
     * Send a request to the main window's renderer to toggle FPS monitor.
     */
    private sendTogglePerf;
}
//# sourceMappingURL=menuManager.d.ts.map