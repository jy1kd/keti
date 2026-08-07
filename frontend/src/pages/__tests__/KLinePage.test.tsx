import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KLinePage } from '../KLinePage';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';
import { useTabStore } from '@/stores/tabs';
import type { MarketSnapshot } from '@/services/types';

// Mock the KLineChart component
vi.mock('@/modules/market/KLineChart', () => ({
  KLineChart: vi.fn().mockImplementation(({ instrument, period, name, latestPrice, onPeriodChange, searchSlot }) => (
    <div data-testid="kline-chart">
      <span data-testid="instrument">{instrument}</span>
      {name && <span data-testid="contract-name">{name}</span>}
      {latestPrice != null && <span data-testid="latest-price">{latestPrice}</span>}
      <span data-testid="period">{period}</span>
      <button data-testid="period-1m" onClick={() => onPeriodChange?.('1m')}>1m</button>
      <button data-testid="period-5m" onClick={() => onPeriodChange?.('5m')}>5m</button>
      {searchSlot}
    </div>
  )),
}));

describe('KLinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up market store with test data
    useMarketStore.setState({
      klineData: new Map(),
      snapshots: new Map(),
      selectedInstrument: 'IF2608',
      currentPeriod: '5m',
      setPeriod: vi.fn(),
      setKlineData: vi.fn(),
    });
    // Set up contracts store with test data
    useContractsStore.setState({
      contracts: [
        {
          instrumentID: 'IF2608',
          instrumentName: '沪深300',
          exchangeID: 'CFFEX',
          productID: 'IF',
          volumeMultiple: 300,
          priceTick: 0.2,
          expireDate: '2026-08-15',
          isTrading: 1,
          productClass: '1',
        },
        {
          instrumentID: 'rb2610',
          instrumentName: 'rb2610',
          exchangeID: 'SHFE',
          productID: 'rb',
          volumeMultiple: 10,
          priceTick: 1,
          expireDate: '2026-10-15',
          isTrading: 1,
          productClass: '1',
        },
      ],
      favorites: [],
      isLoaded: true,
    });
    // Set up tab store：K线标签页
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-kline-IF2608', type: 'kline', title: '📈 K线-IF2608', props: { instrumentID: 'IF2608' }, closable: true },
      ],
      activeTabId: 'tab-kline-IF2608',
    });
  });

  it('should render K-line chart', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByTestId('kline-chart')).toBeDefined();
  });

  it('should display instrument ID', () => {
    render(<KLinePage instrumentID="IF2608" />);
    const instrumentElements = screen.getAllByText('IF2608');
    expect(instrumentElements.length).toBeGreaterThan(0);
  });

  it('should pass contract name to KLineChart header', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByTestId('contract-name').textContent).toBe('沪深300');
  });

  it('should render period selector', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByTestId('period-1m')).toBeDefined();
    expect(screen.getByTestId('period-5m')).toBeDefined();
  });

  it('should pass instrument ID to KLineChart', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByTestId('instrument').textContent).toBe('IF2608');
  });

  it('已删除 24px 拖拽条（drag-handle 上移 KLineChart 标题栏）', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.queryByText(/拖动此栏可转弹窗/)).not.toBeInTheDocument();
    expect(document.querySelector('.kline-page__drag')).toBeNull();
  });

  // ── 单一展示栏（合约信息传入 KLineChart 标题栏） ──

  it('should display instrument ID', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getAllByText('IF2608').length).toBeGreaterThanOrEqual(1);
  });

  it('should display latest price in KLineChart header when snapshot available', () => {
    useMarketStore.setState({
      snapshots: new Map([
        ['IF2608', {
          instrumentID: 'IF2608',
          lastPrice: 4585.6,
          bidPrice1: 0,
          askPrice1: 0,
          openPrice: 0,
          highestPrice: 0,
          lowestPrice: 0,
          preSettlementPrice: 0,
          upperLimitPrice: 0,
          lowerLimitPrice: 0,
          volume: 0,
          openInterest: 0,
        } as MarketSnapshot],
      ]),
    });
    render(<KLinePage instrumentID="IF2608" />);
    // priceTick=0.2 → formatPrice 输出 2 位小数（与 OrderPage 约定一致）
    expect(screen.getByTestId('latest-price').textContent).toBe('4585.60');
  });

  it('should show dash for latest price in KLineChart header when snapshot unavailable', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByTestId('latest-price').textContent).toBe('—');
  });

  // ── 搜索切换 ──

  it('SimNow instrumentName 与代码相同时，标题栏显示产品中文名而非重复代码', () => {
    useContractsStore.setState({
      contracts: [
        {
          instrumentID: 'sc2609',
          instrumentName: 'sc2609', // SimNow 返回与 instrumentID 相同的 instrumentName
          exchangeID: 'INE',
          productID: 'sc',
          volumeMultiple: 1000,
          priceTick: 0.1,
          expireDate: '2026-08-31',
          isTrading: 1,
          productClass: '1',
        },
      ],
      favorites: [],
      isLoaded: true,
    });
    render(<KLinePage instrumentID="sc2609" tabId="tab-kline-IF2608" />);
    // getProductName('sc') = '原油'，不再重复显示 'sc2609'
    expect(screen.getByTestId('contract-name').textContent).toBe('原油');
  });

  it('页内搜索并选择合约时，调用 updateTab 更新所属标签页 props 与 title', () => {
    const updateTabSpy = vi
      .spyOn(useTabStore.getState(), 'updateTab')
      .mockImplementation(() => {});
    try {
      render(<KLinePage instrumentID="IF2608" tabId="tab-kline-IF2608" />);
      const input = screen.getByPlaceholderText('搜索合约...');
      fireEvent.change(input, { target: { value: 'rb' } });
      fireEvent.mouseDown(screen.getByText('rb2610'));
      expect(updateTabSpy).toHaveBeenCalledWith('tab-kline-IF2608', {
        props: { instrumentID: 'rb2610' },
        title: '📈 K线-rb2610',
      });
    } finally {
      updateTabSpy.mockRestore();
    }
  });

  it('无 tabId（如查询面板复用）时不触发切换，仍渲染搜索框', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByPlaceholderText('搜索合约...')).toBeDefined();
    expect(screen.getByTestId('instrument').textContent).toBe('IF2608');
  });

  // ── 边界条件 ──

  it('should show placeholder hint when no instrumentID provided', () => {
    render(<KLinePage />);
    expect(screen.getByText(/请在行情表格中选择合约/)).toBeDefined();
  });
});
