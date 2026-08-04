import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KLinePage } from '../KLinePage';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';
import type { MarketSnapshot } from '@/services/types';

// Mock the KLineChart component
vi.mock('@/modules/market/KLineChart', () => ({
  KLineChart: vi.fn().mockImplementation(({ instrument, period, name, latestPrice, onPeriodChange }) => (
    <div data-testid="kline-chart">
      <span data-testid="instrument">{instrument}</span>
      {name && <span data-testid="contract-name">{name}</span>}
      {latestPrice != null && <span data-testid="latest-price">{latestPrice}</span>}
      <span data-testid="period">{period}</span>
      <button data-testid="period-1m" onClick={() => onPeriodChange?.('1m')}>1m</button>
      <button data-testid="period-5m" onClick={() => onPeriodChange?.('5m')}>5m</button>
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
      ],
      favorites: [],
      isLoaded: true,
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

  // ── 边界条件 ──

  it('should show placeholder hint when no instrumentID provided', () => {
    render(<KLinePage />);
    expect(screen.getByText(/请在行情表格中选择合约/)).toBeDefined();
  });
});
