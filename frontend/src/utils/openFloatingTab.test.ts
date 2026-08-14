import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '@/stores/tabs';
import { useFloatingWindowStore } from '@/stores/floatingWindows';
import { useMarketStore } from '@/modules/market/store';
import { openOrderFloating, openKlineFloating, openAccountQueryFloating, openSettingsFloating, openIpcMonitorFloating } from './openFloatingTab';

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
});
