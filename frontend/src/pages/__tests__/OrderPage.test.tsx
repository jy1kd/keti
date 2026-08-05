import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderPage } from '../OrderPage';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';
import type { MarketSnapshot } from '@/services/types';

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    useMarketStore.setState({ snapshots: new Map() });
  });

  // ── 正常路径 ──

  it('should render title bar', () => {
    render(<OrderPage />);
    expect(screen.getByText('📝 报单')).toBeDefined();
  });

  it('should display instrument ID in title bar and quote card', () => {
    render(<OrderPage instrumentID="IF2608" />);
    // 标题栏中的合约代码
    const codes = screen.getAllByText('IF2608');
    expect(codes.length).toBeGreaterThanOrEqual(1);
  });

  it('should display contract name in quote card', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText('沪深300')).toBeDefined();
  });

  it('should display latest price in quote card when snapshot available', () => {
    useMarketStore.setState({
      snapshots: new Map([
        ['IF2608', {
          instrumentID: 'IF2608',
          lastPrice: 4585.6,
          bidPrice1: 4585.2,
          askPrice1: 4585.6,
          openPrice: 4573.6,
          highestPrice: 4590.0,
          lowestPrice: 4570.0,
          preSettlementPrice: 4573.6,
          upperLimitPrice: 5029.0,
          lowerLimitPrice: 4118.4,
          volume: 20892,
          openInterest: 45105,
        } as MarketSnapshot],
      ]),
    });
    render(<OrderPage instrumentID="IF2608" />);
    // 最新价在卡片中显示（priceTick=0.2 → 2 位小数）
    const prices = screen.getAllByText('4585.60');
    expect(prices.length).toBeGreaterThanOrEqual(1);
  });

  it('should show exchange ID in quote card', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText('CFFEX')).toBeDefined();
  });

  // ── 表单渲染 ──

  it('should render direction buttons', () => {
    render(<OrderPage />);
    expect(screen.getByText('买')).toBeDefined();
    expect(screen.getByText('卖')).toBeDefined();
  });

  it('should render submit button with instrument ID', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText(/买入 IF2608/)).toBeDefined();
  });

  // ── 边界条件 ──

  it('should show placeholder hint when no instrumentID provided', () => {
    render(<OrderPage />);
    expect(screen.getByText(/请在行情表格中选择合约/)).toBeDefined();
  });

  it('should show instrumentID but not name when contract not found', () => {
    render(<OrderPage instrumentID="IF9999" />);
    // 标题栏和卡片中都显示合约代码
    expect(screen.getAllByText('IF9999').length).toBeGreaterThanOrEqual(1);
    // 不显示已知合约名称
    expect(screen.queryByText('沪深300')).toBeNull();
  });

  it('should show dashes in quote card when snapshot unavailable', () => {
    render(<OrderPage instrumentID="IF2608" />);
    // 快照不存在时，数据网格显示 —
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should show formatted volume and open interest when snapshot available', () => {
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
          preSettlementPrice: 4573.6,
          upperLimitPrice: 0,
          lowerLimitPrice: 0,
          volume: 20892,
          openInterest: 45105,
        } as MarketSnapshot],
      ]),
    });
    render(<OrderPage instrumentID="IF2608" />);
    // 千分位格式化
    expect(screen.getByText('20,892')).toBeDefined();
    expect(screen.getByText('45,105')).toBeDefined();
  });

  // ── 拖拽句柄 ──

  it('标题栏应带 data-drag-handle（可拖为弹窗）', () => {
    const { container } = render(<OrderPage instrumentID="IF2608" />);
    const bar = container.querySelector('.order-page__title-bar');
    expect(bar).toHaveAttribute('data-drag-handle');
  });
});
