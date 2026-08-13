/**
 * Shared Menu Actions
 *
 * Maps MenuAction (menuTemplate.ts) to real behavior shared by the top app menu
 * and the tray context menu. Both menus call resolveAction for every click.
 */

import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc/index';
import type { MenuAction } from './menuTemplate';
import type { WindowManager } from './windowManager';

export interface MenuContext {
  mainWindow: BrowserWindow;
  windowManager: WindowManager;
}

/**
 * show + focus 主窗口并发送 IPC。
 * 守卫与现有私有方法一致：主窗口不存在/已销毁时不操作不发送。
 */
function showAndSend(ctx: MenuContext, channel: string, ...args: unknown[]): void {
  if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
    ctx.mainWindow.webContents.send(channel, ...args);
  }
}

export function resolveAction(action: MenuAction, ctx: MenuContext): void {
  switch (action.type) {
    case 'market-view':
      return showAndSend(ctx, IPC_CHANNELS.MENU_MARKET_VIEW, action.view);
    case 'open-floating':
      return showAndSend(ctx, IPC_CHANNELS.MENU_OPEN_FLOATING, action.tab);
    case 'open-market-window':
      if (ctx.windowManager) {
        ctx.windowManager.openTabWindow('market', 'tab-market', '📊 期货');
      }
      return;
    case 'toggle-perf':
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_PERF);
      }
      return;
    case 'quit':
      app.quit();
      return;
  }
}
