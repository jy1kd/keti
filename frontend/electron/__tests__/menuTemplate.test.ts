import { describe, it, expect, vi } from 'vitest';

// menuTemplate → menuActions → electron.app，需 mock
vi.mock('electron', () => ({
  app: { quit: vi.fn() },
}));

import { app } from 'electron';
import { getAppMenuDef, buildMenuFromDef } from '../menuTemplate';
import type { MenuItemDef } from '../menuTemplate';

interface TemplateItem {
  label?: string;
  type?: string;
  submenu?: TemplateItem[];
  click?: () => void;
}

describe('getAppMenuDef', () => {
  it('返回四组一级菜单：行情/功能/设置/性能监控', () => {
    const def = getAppMenuDef();
    expect(def.map((d) => d.label)).toEqual(['行情', '功能', '设置', '性能监控']);
  });

  it('行情子菜单完整镜像：期货/期权/自选/T型报价/分隔符/在新窗口打开', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const labels = market.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '📉 T型报价', '🪟 在新窗口打开']);
  });

  it('行情「📉 T型报价」action 为 open-floating tquote（在分隔符前）', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const tquote = market.submenu!.find((i) => i.id === 'market-tquote')!;
    expect(tquote.label).toBe('📉 T型报价');
    expect(tquote.action).toEqual({ type: 'open-floating', tab: 'tquote' });
    const sep = market.submenu!.find((i) => i.type === 'separator')!;
    expect(market.submenu!.indexOf(tquote)).toBeLessThan(market.submenu!.indexOf(sep));
  });

  it('行情「在新窗口打开」action 为 open-market-window', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const newWindow = market.submenu!.find((i) => i.id === 'market-new-window')!;
    expect(newWindow.action).toEqual({ type: 'open-market-window' });
  });

  it('功能子菜单包含报单/K线/报单查询/持仓查询/资金查询/分隔符/退出(app-quit)', () => {
    const fnMenu = getAppMenuDef().find((d) => d.id === 'function')!;
    const labels = fnMenu.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口', '退出']);
    expect(fnMenu.submenu!.some((i) => i.id === 'app-quit')).toBe(true);
  });

  it('设置子菜单仅 ⚙ 设置', () => {
    const settings = getAppMenuDef().find((d) => d.id === 'settings')!;
    expect(settings.submenu!.map((i) => i.label).filter(Boolean)).toEqual(['⚙ 设置']);
  });

  it('性能监控子菜单包含 FPS 监控 与 网络监控', () => {
    const perf = getAppMenuDef().find((d) => d.id === 'performance')!;
    const labels = perf.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['⚡FPS 监控', '🔌 网络监控']);
  });
});

describe('buildMenuFromDef', () => {
  const ctx = { mainWindow: {} as any, windowManager: {} as any };

  it('分隔符渲染为 { type: separator }', () => {
    const def: MenuItemDef[] = [
      { id: 'a', label: 'A', action: { type: 'toggle-perf' } },
      { id: 's', type: 'separator' },
    ];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    expect(tpl[0].label).toBe('A');
    expect(tpl[1]).toEqual({ type: 'separator' });
  });

  it('子菜单递归渲染', () => {
    const def: MenuItemDef[] = [
      { id: 'g', label: 'G', submenu: [{ id: 'c', label: 'C', action: { type: 'quit' } }] },
    ];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    expect(tpl[0].submenu![0].label).toBe('C');
  });

  it('omitIds 递归剔除指定 id 的条目', () => {
    const def: MenuItemDef[] = [
      { id: 'g', label: 'G', submenu: [{ id: 'drop', label: 'D', action: { type: 'quit' } }] },
    ];
    const tpl = buildMenuFromDef(def, ctx, { omitIds: ['drop'] }) as unknown as TemplateItem[];
    expect(tpl[0].submenu!.length).toBe(0);
  });

  it('点击项 click 触发 resolveAction（quit → app.quit）', () => {
    const def: MenuItemDef[] = [{ id: 'q', label: '退出', action: { type: 'quit' } }];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    tpl[0].click!();
    expect(app.quit).toHaveBeenCalled();
  });
});
