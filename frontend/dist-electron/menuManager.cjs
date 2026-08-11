"use strict";
/**
 * Menu Manager
 *
 * Builds the application menu bar from the shared menu template (menuTemplate.ts):
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 * Click behavior lives in menuActions.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuManager = void 0;
const electron_1 = require("electron");
const menuTemplate_1 = require('./menuTemplate.cjs');
/**
 * MenuManager class
 */
class MenuManager {
    /**
     * Set the application menu: app menus built from the shared template + default View.
     */
    initialize(mainWindow, windowManager) {
        const appMenu = (0, menuTemplate_1.buildMenuFromDef)((0, menuTemplate_1.getAppMenuDef)(), { mainWindow, windowManager });
        electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate([...appMenu, { role: 'viewMenu' }]));
    }
}
exports.MenuManager = MenuManager;
//# sourceMappingURL=menuManager.js.map