import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KLinePage } from '../KLinePage';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';

// Mock the KLineChart component
vi.mock('@/modules/market/KLineChart', () => ({
  KLineChart: vi.fn().mockImplementation(({ instrument, period, onPeriodChange }) => (
    <div data-testid="kline-chart">
      <span data-testid="instrument">{instrument}</span>
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
      presetContracts: [],
      userContracts: [],
      presetIds: [],
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

  it('should display instrument name', () => {
    render(<KLinePage instrumentID="IF2608" />);
    expect(screen.getByText('沪深300')).toBeDefined();
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
});
