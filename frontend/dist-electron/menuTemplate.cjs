"use strict";
/**
 * Shared Menu Template
 *
 * Single source of truth for the application menus.
 * The top app menu and the tray context menu both build from getAppMenuDef(),
 * so adding/removing items in one place keeps both in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppMenuDef = getAppMenuDef;
exports.buildMenuFromDef = buildMenuFromDef;
const menuActions_1 = require('./menuActions.cjs');
/**
 * 四组原生菜单定义 —— 唯一的菜单真源。
 * 「设置」子菜单末尾的退出（id 'app-quit'）仅顶部菜单保留；托盘 omitIds: ['app-quit'] 剔除并放到一级底部。
 */
function getAppMenuDef() {
    return [
        {
            id: 'market',
            label: '行情',
            submenu: [
                { id: 'market-all', label: '📊 期货', action: { type: 'market-view', view: 'all' } },
                { id: 'market-options', label: '📉 期权', action: { type: 'market-view', view: 'options' } },
                { id: 'market-favorites', label: '⭐ 自选行情', action: { type: 'market-view', view: 'favorites' } },
                { id: 'market-sep1', type: 'separator' },
                { id: 'market-kline', label: '📈 K线窗口', action: { type: 'open-floating', tab: 'kline' } },
                { id: 'market-tquote', label: '📉 T型报价', action: { type: 'open-floating', tab: 'tquote' } },
                { id: 'market-sep2', type: 'separator' },
                { id: 'market-new-window', label: '🪟 在新窗口打开', action: { type: 'open-market-window' } },
            ],
        },
        {
            id: 'trade',
            label: '交易',
            submenu: [
                { id: 'trade-order', label: '📝 报单窗口', action: { type: 'open-floating', tab: 'order' } },
                { id: 'trade-infinite', label: '♾️ 无限下单窗口', action: { type: 'open-floating', tab: 'infinite' } },
            ],
        },
        {
            id: 'query',
            label: '查询',
            submenu: [
                { id: 'query-orders', label: '📋 报单查询窗口', action: { type: 'open-floating', tab: 'query-orders' } },
                { id: 'query-positions', label: '📋 持仓查询窗口', action: { type: 'open-floating', tab: 'query-positions' } },
                { id: 'query-account', label: '💰 资金查询窗口', action: { type: 'open-floating', tab: 'query-account' } },
            ],
        },
        {
            id: 'settings',
            label: '设置',
            submenu: [
                { id: 'settings-main', label: '⚙ 设置', action: { type: 'open-floating', tab: 'settings' } },
                { id: 'settings-sep1', type: 'separator' },
                { id: 'settings-ipc', label: '🔌 网络监控', action: { type: 'open-floating', tab: 'ipc-monitor' } },
                { id: 'settings-sep2', type: 'separator' },
                { id: 'app-quit', label: '退出', action: { type: 'quit' } },
            ],
        },
    ];
}
/** 渲染：MenuItemDef[] + MenuContext → Electron 菜单模板 */
function buildMenuFromDef(def, ctx, options = {}) {
    const omit = new Set(options.omitIds ?? []);
    const walk = (items) => items
        .filter((item) => !omit.has(item.id))
        .map((item) => {
        if (item.type === 'separator') {
            return { type: 'separator' };
        }
        return {
            label: item.label,
            submenu: item.submenu ? walk(item.submenu) : undefined,
            click: item.action ? () => (0, menuActions_1.resolveAction)(item.action, ctx) : undefined,
        };
    });
    return walk(def);
}
//# sourceMappingURL=menuTemplate.js.map