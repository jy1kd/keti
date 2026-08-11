/**
 * Menu Manager
 *
 * Builds the application menu bar from the shared menu template (menuTemplate.ts):
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 * Click behavior lives in menuActions.ts.
 */
import type { BrowserWindow } from 'electron';
import type { WindowManager } from './windowManager';
/**
 * MenuManager class
 */
export declare class MenuManager {
    /**
     * Set the application menu: app menus built from the shared template + default View.
     */
    initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void;
}
//# sourceMappingURL=menuManager.d.ts.map