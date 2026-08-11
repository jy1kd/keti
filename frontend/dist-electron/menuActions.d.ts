/**
 * Shared Menu Actions
 *
 * Maps MenuAction (menuTemplate.ts) to real behavior shared by the top app menu
 * and the tray context menu. Both menus call resolveAction for every click.
 */
import type { BrowserWindow } from 'electron';
import type { MenuAction } from './menuTemplate';
import type { WindowManager } from './windowManager';
export interface MenuContext {
    mainWindow: BrowserWindow;
    windowManager: WindowManager;
}
export declare function resolveAction(action: MenuAction, ctx: MenuContext): void;
//# sourceMappingURL=menuActions.d.ts.map