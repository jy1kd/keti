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
  it('返回四组一级菜单：行情/交易/查询/设置', () => {
    const def = getAppMenuDef();
    expect(def.map((d) => d.label)).toEqual(['行情', '交易', '查询', '设置']);
  });

  it('行情子菜单：期货/期权/K线/新窗口', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const labels = market.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📊 期货', '📉 期权', '📈 K线', '🪟 在新窗口打开']);
  });

  it('行情「📈 K线」action 为 open-floating kline（在首个分隔符后）', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const kline = market.submenu!.find((i) => i.id === 'market-kline')!;
    expect(kline.label).toBe('📈 K线');
    expect(kline.action).toEqual({ type: 'open-floating', tab: 'kline' });
    const sep = market.submenu!.find((i) => i.type === 'separator')!;
    expect(market.submenu!.indexOf(kline)).toBeGreaterThan(market.submenu!.indexOf(sep));
  });

  it('行情「在新窗口打开」action 为 open-market-window', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const newWindow = market.submenu!.find((i) => i.id === 'market-new-window')!;
    expect(newWindow.action).toEqual({ type: 'open-market-window' });
  });

  it('交易子菜单：五档下单 / 无限下单', () => {
    const trade = getAppMenuDef().find((d) => d.id === 'trade')!;
    const labels = trade.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📝 五档下单', '♾️ 无限下单']);
  });

  it('交易「无限下单」action 为 open-floating infinite', () => {
    const trade = getAppMenuDef().find((d) => d.id === 'trade')!;
    const infinite = trade.submenu!.find((i) => i.id === 'trade-infinite')!;
    expect(infinite.action).toEqual({ type: 'open-floating', tab: 'infinite' });
  });

  it('查询子菜单：报单查询/持仓查询/资金查询', () => {
    const query = getAppMenuDef().find((d) => d.id === 'query')!;
    const labels = query.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📋 报单查询', '📋 持仓查询', '💰 资金查询']);
  });

  it('设置子菜单：设置/网络监控，无 app-quit', () => {
    const settings = getAppMenuDef().find((d) => d.id === 'settings')!;
    const labels = settings.submenu!.filter((i) => i.type !== 'separator').map((i) => i.label);
    expect(labels).toEqual(['⚙ 设置', '🔌 网络监控']);
    expect(settings.submenu!.some((i) => i.id === 'app-quit')).toBe(false);
  });

  it('菜单不含 FPS 监控 / 性能监控组 / 旧「📋 查询窗口」', () => {
    const all = JSON.stringify(getAppMenuDef());
    expect(all).not.toContain('⚡FPS 监控');
    expect(all).not.toContain('性能监控');
    expect(all).not.toContain('📋 查询窗口');
  });
});

describe('buildMenuFromDef', () => {
  const ctx = { mainWindow: {} as any, windowManager: {} as any };

  it('分隔符渲染为 { type: separator }', () => {
    const def: MenuItemDef[] = [
      { id: 'a', label: 'A', action: { type: 'open-floating', tab: 'order' } },
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
