import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '@/stores/tabs';
import { useFloatingWindowStore } from '@/stores/floatingWindows';
import { useMarketStore } from '@/modules/market/store';
import { openOrderFloating, openKlineFloating, openQueryFloating, openSettingsFloating, openIpcMonitorFloating } from './openFloatingTab';

describe('openFloatingTab helpers — 顶部菜单打开浮动窗', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: '' });
    useFloatingWindowStore.setState({ windows: {} });
    useMarketStore.setState({ selectedInstrument: null });
  });

  const tabByType = (type: string) => useTabStore.getState().tabs.find((t) => t.type === type);

  it('openQueryFloating 打开查询浮动窗', () => {
    openQueryFloating();
    const tab = tabByType('query');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📋 查询');
    expect(useFloatingWindowStore.getState().windows['tab-query']).toBeDefined();
  });

  it('openOrderFloating 无选中合约时打开空白报单窗', () => {
    openOrderFloating();
    const tab = tabByType('order');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📝 报单');
    expect(tab!.props.instrumentID).toBeUndefined();
    expect(useFloatingWindowStore.getState().windows['tab-order']).toBeDefined();
  });

  it('openOrderFloating 有选中合约时定位到该合约', () => {
    useMarketStore.setState({ selectedInstrument: 'IF2608' });
    openOrderFloating();
    const tab = tabByType('order');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('📝 报单-IF2608');
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
});
