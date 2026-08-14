import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTabStore } from '@/stores/tabs';
import { useFloatingWindowStore } from '@/stores/floatingWindows';
import { useMarketStore } from '@/modules/market/store';
import { openFloatingTab, openOrderFloating, openKlineFloating, openAccountQueryFloating, openSettingsFloating, openIpcMonitorFloating, computeAccountWindowHeight, fitAccountWindowToContent } from './openFloatingTab';

describe('openFloatingTab helpers — 顶部菜单打开浮动窗', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: '' });
    useFloatingWindowStore.setState({ windows: {} });
    useMarketStore.setState({ selectedInstrument: null });
  });

  const tabByType = (type: string) => useTabStore.getState().tabs.find((t) => t.type === type);

  it('openAccountQueryFloating 打开资金查询浮动窗', () => {
    openAccountQueryFloating();
    const tab = tabByType('query-account');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('💰 资金查询');
    expect(useFloatingWindowStore.getState().windows['tab-query-account']).toBeDefined();
  });

  it('openOrderFloating 无选中合约时打开空白报单窗', () => {
    openOrderFloating();
    const tab = tabByType('order');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📝 五档下单');
    expect(tab!.props.instrumentID).toBeUndefined();
    expect(useFloatingWindowStore.getState().windows['tab-order']).toBeDefined();
  });

  it('openOrderFloating 有选中合约时定位到该合约', () => {
    useMarketStore.setState({ selectedInstrument: 'IF2608' });
    openOrderFloating();
    const tab = tabByType('order');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📝 五档下单-IF2608');
    expect(tab!.props.instrumentID).toBe('IF2608');
    expect(useFloatingWindowStore.getState().windows['tab-order-IF2608']).toBeDefined();
  });

  it('openKlineFloating 无选中合约时打开通用K线浮动窗', () => {
    openKlineFloating();
    const tab = tabByType('kline');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📈 K线');
    expect(useFloatingWindowStore.getState().windows['tab-kline']).toBeDefined();
  });

  it('openKlineFloating 有选中合约时直接定位', () => {
    useMarketStore.setState({ selectedInstrument: 'au2406' });
    openKlineFloating();
    const tab = tabByType('kline');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📈 K线-au2406');
    expect(tab!.props.instrumentID).toBe('au2406');
    expect(useFloatingWindowStore.getState().windows['tab-kline-au2406']).toBeDefined();
  });

  it('openSettingsFloating 打开设置浮动窗', () => {
    openSettingsFloating();
    const tab = tabByType('settings');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('⚙ 设置');
    expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeDefined();
  });

  it('openIpcMonitorFloating 打开网络监控浮动窗', () => {
    openIpcMonitorFloating();
    const tab = tabByType('ipc-monitor');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📡 网络监控');
    expect(useFloatingWindowStore.getState().windows['tab-ipc-monitor']).toBeDefined();
  });

  it('打开浮动窗后保持原活跃标签（openTab 激活 + detachTabAt 切回 market 后恢复 priorActive）', () => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-options',
    });
    openAccountQueryFloating();
    expect(useTabStore.getState().activeTabId).toBe('tab-options');
    expect(useFloatingWindowStore.getState().windows['tab-query-account']).toBeDefined();
  });

  it('openFloatingTab 支持自定义 position（不再居中）', () => {
    openFloatingTab({ type: 'query-account', title: '💰 资金查询', size: { w: 800, h: 600 }, position: { x: 100, y: 200 } });
    const win = useFloatingWindowStore.getState().windows['tab-query-account'];
    expect(win).toMatchObject({ x: 100, y: 200, w: 800, h: 600 });
  });

  it('openAccountQueryFloating 对齐行情表格（同尺寸同位置）', () => {
    // jsdom 视口 1024×768；表格须在视口内，否则 detachTabAt 会把 x 钳回 0（正确行为）
    const rect = { left: 50, top: 100, width: 900, height: 600, bottom: 700, right: 950 } as DOMRect;
    const el = { getBoundingClientRect: () => rect } as unknown as Element;
    const spy = vi.spyOn(document, 'querySelector').mockImplementation((sel: string) =>
      sel === '.market-table-container' ? el : null
    );
    openAccountQueryFloating();
    const win = useFloatingWindowStore.getState().windows['tab-query-account'];
    expect(win).toMatchObject({ x: 50, y: 100, w: 900, h: 600 });
    spy.mockRestore();
  });

  it('openAccountQueryFloating 无行情表格时回退默认（仍能打开）', () => {
    const spy = vi.spyOn(document, 'querySelector').mockReturnValue(null);
    openAccountQueryFloating();
    expect(useFloatingWindowStore.getState().windows['tab-query-account']).toBeDefined();
    spy.mockRestore();
  });

  it('computeAccountWindowHeight 收缩到刚好容纳卡片（网格 + 内容 padding + 标题条）', () => {
    expect(computeAccountWindowHeight(130, 700)).toBe(178); // 130 + 16 padding + 32 chrome
  });

  it('computeAccountWindowHeight 高度已够则不收缩（避免裁卡）', () => {
    expect(computeAccountWindowHeight(130, 150)).toBeNull();
  });

  it('fitAccountWindowToContent 收缩窗口并保持底部锚定', () => {
    useFloatingWindowStore.setState({
      windows: { 'tab-query-account': { x: 50, y: 100, w: 900, h: 700, z: 1 } },
    });
    const grid = { offsetHeight: 130 } as HTMLElement;
    const spy = vi.spyOn(document, 'querySelector').mockImplementation((sel: string) =>
      sel === '#floating-overlay .account-query .account-grid' ? grid : null
    );
    expect(fitAccountWindowToContent()).toBe(true);
    const win = useFloatingWindowStore.getState().windows['tab-query-account'];
    expect(win).toMatchObject({ x: 50, y: 622, w: 900, h: 178 }); // bottom 800 锚定
    spy.mockRestore();
  });
});
