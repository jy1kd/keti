/**
 * Shared Menu Template
 *
 * Single source of truth for the application menus.
 * The top app menu and the tray context menu both build from getAppMenuDef(),
 * so adding/removing items in one place keeps both in sync.
 */
import type { MenuItemConstructorOptions } from 'electron';
import type { MenuContext } from './menuActions';
export type MarketView = 'all' | 'options';
export type FloatingTab = 'order' | 'kline' | 'infinite' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account' | 'collections';
export type MenuAction = {
    type: 'market-view';
    view: MarketView;
} | {
    type: 'open-floating';
    tab: FloatingTab;
} | {
    type: 'open-market-window';
} | {
    type: 'quit';
};
export interface MenuItemDef {
    id: string;
    label?: string;
    type?: 'normal' | 'separator';
    action?: MenuAction;
    submenu?: MenuItemDef[];
}
export interface BuildOptions {
    /** 按 id 递归剔除的条目（托盘把「设置」内嵌的退出移到底部） */
    omitIds?: string[];
}
/**
 * 五组原生菜单定义 —— 唯一的菜单真源。
 * 行情 / 收藏夹 / 交易 / 查询 / 设置.
 * 「设置」内不再包含退出；托盘 omitIds 仅保留兼容引用（托盘自带一级底部退出）。
 */
export declare function getAppMenuDef(): MenuItemDef[];
/** 渲染：MenuItemDef[] + MenuContext → Electron 菜单模板 */
export declare function buildMenuFromDef(def: MenuItemDef[], ctx: MenuContext, options?: BuildOptions): MenuItemConstructorOptions[];
//# sourceMappingURL=menuTemplate.d.ts.map