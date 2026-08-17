"use strict";
/**
 * Menu Manager
 *
 * Builds the application menu bar from the shared menu template (menuTemplate.ts):
 * 行情 / 交易 / 查询 / 设置.
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
     * Set the application menu: app menus built from the shared template.
     */
    initialize(mainWindow, windowManager) {
        const appMenu = (0, menuTemplate_1.buildMenuFromDef)((0, menuTemplate_1.getAppMenuDef)(), { mainWindow, windowManager });
        electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(appMenu));
    }
}
exports.MenuManager = MenuManager;
//# sourceMappingURL=menuManager.js.map