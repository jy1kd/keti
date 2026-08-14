/**
 * Shared Menu Template
 *
 * Single source of truth for the application menus.
 * The top app menu and the tray context menu both build from getAppMenuDef(),
 * so adding/removing items in one place keeps both in sync.
 */
import type { MenuItemConstructorOptions } from 'electron';
import type { MenuContext } from './menuActions';
export type MarketView = 'all' | 'options' | 'favorites';
export type FloatingTab = 'order' | 'kline' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account';
export type MenuAction = {
    type: 'market-view';
    view: MarketView;
} | {
    type: 'open-floating';
    tab: FloatingTab;
} | {
    type: 'open-market-window';
} | {
    type: 'toggle-perf';
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
    /** 按 id 递归剔除的条目（托盘把「功能」内嵌的退出移到底部） */
    omitIds?: string[];
}
/**
 * 四组原生菜单定义 —— 唯一的菜单真源。
 * 「功能」子菜单末尾的退出（id 'app-quit'）仅顶部菜单保留；托盘 omitIds: ['app-quit'] 剔除并放到一级底部。
 */
export declare function getAppMenuDef(): MenuItemDef[];
/** 渲染：MenuItemDef[] + MenuContext → Electron 菜单模板 */
export declare function buildMenuFromDef(def: MenuItemDef[], ctx: MenuContext, options?: BuildOptions): MenuItemConstructorOptions[];
//# sourceMappingURL=menuTemplate.d.ts.map