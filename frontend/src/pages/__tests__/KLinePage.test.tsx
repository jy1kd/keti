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
    expect(screen.getByTestId('latest-price').textContent).toBe('--');
  });

  // ── 搜索切换 ──

  it('标题栏合约代码区由搜索框替代：不再渲染静态合约名，搜索框回显合约代码', () => {
    render(<KLinePage instrumentID="IF2608" tabId="tab-kline-IF2608" />);
    // name prop 已移除，静态合约名不再渲染
    expect(screen.queryByTestId('contract-name')).toBeNull();
    // 搜索框回显当前合约代码（initialQuery）
    expect(screen.getByDisplayValue('IF2608')).toBeDefined();
  });

  it('搜索控件声明 data-no-drag：可关闭标签页中点击下拉结果不触发拖拽脱离（修复鼠标选择失效）', () => {
    render(<KLinePage instrumentID="IF2608" tabId="tab-kline-IF2608" />);
    const search = document.querySelector('.contract-search');
    expect(search).not.toBeNull();
    expect(search).toHaveAttribute('data-no-drag');
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

  it('无合约时渲染空态K线图（-- 最新价 + 请选择合约搜索框）', () => {
    render(<KLinePage />);
    expect(screen.getByTestId('kline-chart')).toBeDefined();
    expect(screen.getByTestId('latest-price').textContent).toBe('--');
    expect(screen.getByPlaceholderText('请选择合约')).toBeDefined();
    expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull();
  });
});
