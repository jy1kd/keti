/**
 * Menu Manager
 *
 * Builds the application menu bar from the shared menu template (menuTemplate.ts):
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 * Click behavior lives in menuActions.ts.
 */

import { Menu } from 'electron';
import type { BrowserWindow } from 'electron';
import { buildMenuFromDef, getAppMenuDef } from './menuTemplate';
import type { WindowManager } from './windowManager';

/**
 * MenuManager class
 */
export class MenuManager {
  /**
   * Set the application menu: app menus built from the shared template + default View.
   */
  initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void {
    const appMenu = buildMenuFromDef(getAppMenuDef(), { mainWindow, windowManager });
    Menu.setApplicationMenu(Menu.buildFromTemplate([...appMenu, { role: 'viewMenu' }]));
  }
}
