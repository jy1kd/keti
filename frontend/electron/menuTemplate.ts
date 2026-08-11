/**
 * Shared Menu Template
 *
 * Single source of truth for the application menus.
 * The top app menu and the tray context menu both build from getAppMenuDef(),
 * so adding/removing items in one place keeps both in sync.
 */

import type { MenuItemConstructorOptions } from 'electron';
import { resolveAction } from './menuActions';
import type { MenuContext } from './menuActions';

export type MarketView = 'all' | 'options' | 'favorites';
export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor';

export type MenuAction =
  | { type: 'market-view'; view: MarketView }
  | { type: 'open-floating'; tab: FloatingTab }
  | { type: 'open-market-window' }
  | { type: 'toggle-perf' }
  | { type: 'quit' };

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
export function getAppMenuDef(): MenuItemDef[] {
  return [
    {
      id: 'market',
      label: '行情',
      submenu: [
        { id: 'market-all', label: '📊 全部行情', action: { type: 'market-view', view: 'all' } },
        { id: 'market-options', label: '📉 T型期权', action: { type: 'market-view', view: 'options' } },
        { id: 'market-favorites', label: '⭐ 自选行情', action: { type: 'market-view', view: 'favorites' } },
        { id: 'market-sep1', type: 'separator' },
        { id: 'market-new-window', label: '🪟 在新窗口打开', action: { type: 'open-market-window' } },
      ],
    },
    {
      id: 'function',
      label: '功能',
      submenu: [
        { id: 'func-order', label: '📝 报单窗口', action: { type: 'open-floating', tab: 'order' } },
        { id: 'func-kline', label: '📈 K线窗口', action: { type: 'open-floating', tab: 'kline' } },
        { id: 'func-query', label: '📋 查询窗口', action: { type: 'open-floating', tab: 'query' } },
        { id: 'func-sep1', type: 'separator' },
        { id: 'app-quit', label: '退出', action: { type: 'quit' } },
      ],
    },
    {
      id: 'settings',
      label: '设置',
      submenu: [
        { id: 'settings-main', label: '⚙ 设置', action: { type: 'open-floating', tab: 'settings' } },
      ],
    },
    {
      id: 'performance',
      label: '性能监控',
      submenu: [
        { id: 'perf-fps', label: '⚡FPS 监控', action: { type: 'toggle-perf' } },
        { id: 'perf-ipc', label: '🔌 网络监控', action: { type: 'open-floating', tab: 'ipc-monitor' } },
      ],
    },
  ];
}

/** 渲染：MenuItemDef[] + MenuContext → Electron 菜单模板 */
export function buildMenuFromDef(
  def: MenuItemDef[],
  ctx: MenuContext,
  options: BuildOptions = {},
): MenuItemConstructorOptions[] {
  const omit = new Set(options.omitIds ?? []);
  const walk = (items: MenuItemDef[]): MenuItemConstructorOptions[] =>
    items
      .filter((item) => !omit.has(item.id))
      .map((item): MenuItemConstructorOptions => {
        if (item.type === 'separator') {
          return { type: 'separator' };
        }
        return {
          label: item.label,
          submenu: item.submenu ? walk(item.submenu) : undefined,
          click: item.action ? () => resolveAction(item.action!, ctx) : undefined,
        };
      });
  return walk(def);
}
