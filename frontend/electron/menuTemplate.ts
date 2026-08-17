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

export type MarketView = 'all' | 'options';
export type FloatingTab = 'order' | 'kline' | 'infinite' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account' | 'collections';

export type MenuAction =
  | { type: 'market-view'; view: MarketView }
  | { type: 'open-floating'; tab: FloatingTab }
  | { type: 'open-market-window' }
  | { type: 'quit' };

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
export function getAppMenuDef(): MenuItemDef[] {
  return [
    {
      id: 'market',
      label: '行情',
      submenu: [
        { id: 'market-all', label: '📊 期货', action: { type: 'market-view', view: 'all' } },
        { id: 'market-options', label: '📉 期权', action: { type: 'market-view', view: 'options' } },
        { id: 'market-sep1', type: 'separator' },
        { id: 'market-kline', label: '📈 K线', action: { type: 'open-floating', tab: 'kline' } },
        { id: 'market-tquote', label: '📉 T型报价', action: { type: 'open-floating', tab: 'tquote' } },
        { id: 'market-sep2', type: 'separator' },
        { id: 'market-new-window', label: '🪟 在新窗口打开', action: { type: 'open-market-window' } },
      ],
    },
    {
      id: 'collections',
      label: '收藏夹',
      submenu: [
        { id: 'collections-open', label: '📁 打开收藏夹', action: { type: 'open-floating', tab: 'collections' } },
      ],
    },
    {
      id: 'trade',
      label: '交易',
      submenu: [
        { id: 'trade-order', label: '📝 五档下单', action: { type: 'open-floating', tab: 'order' } },
        { id: 'trade-infinite', label: '♾️ 无限下单', action: { type: 'open-floating', tab: 'infinite' } },
      ],
    },
    {
      id: 'query',
      label: '查询',
      submenu: [
        { id: 'query-orders', label: '📋 报单查询', action: { type: 'open-floating', tab: 'query-orders' } },
        { id: 'query-positions', label: '📋 持仓查询', action: { type: 'open-floating', tab: 'query-positions' } },
        { id: 'query-account', label: '💰 资金查询', action: { type: 'open-floating', tab: 'query-account' } },
      ],
    },
    {
      id: 'settings',
      label: '设置',
      submenu: [
        { id: 'settings-main', label: '⚙ 设置', action: { type: 'open-floating', tab: 'settings' } },
        { id: 'settings-sep1', type: 'separator' },
        { id: 'settings-ipc', label: '🔌 网络监控', action: { type: 'open-floating', tab: 'ipc-monitor' } },
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
