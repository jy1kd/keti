"use strict";
/**
 * Shared Menu Actions
 *
 * Maps MenuAction (menuTemplate.ts) to real behavior shared by the top app menu
 * and the tray context menu. Both menus call resolveAction for every click.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAction = resolveAction;
const electron_1 = require("electron");
const index_1 = require('./ipc/index.cjs');
/**
 * show + focus 主窗口并发送 IPC。
 * 守卫与现有私有方法一致：主窗口不存在/已销毁时不操作不发送。
 */
function showAndSend(ctx, channel, ...args) {
    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.show();
        ctx.mainWindow.focus();
        ctx.mainWindow.webContents.send(channel, ...args);
    }
}
function resolveAction(action, ctx) {
    switch (action.type) {
        case 'market-view':
            return showAndSend(ctx, index_1.IPC_CHANNELS.MENU_MARKET_VIEW, action.view);
        case 'open-floating':
            return showAndSend(ctx, index_1.IPC_CHANNELS.MENU_OPEN_FLOATING, action.tab);
        case 'open-market-window':
            if (ctx.windowManager) {
                ctx.windowManager.openTabWindow('market', 'tab-market', '📊 期货');
            }
            return;
        case 'toggle-perf':
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
                ctx.mainWindow.webContents.send(index_1.IPC_CHANNELS.MENU_TOGGLE_PERF);
            }
            return;
        case 'quit':
            electron_1.app.quit();
            return;
    }
}
//# sourceMappingURL=menuActions.js.map