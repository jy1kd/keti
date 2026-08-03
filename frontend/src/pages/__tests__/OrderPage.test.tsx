import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderPage } from '../OrderPage';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // Reset market store (no snapshots)
    useMarketStore.setState({ snapshots: new Map() });
  });

  it('should render order form', () => {
    render(<OrderPage />);
    expect(screen.getByText('报单')).toBeDefined();
  });

  it('should display instrument ID when provided', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText('IF2608')).toBeDefined();
  });

  it('should display instrument name when contract found', () => {
    render(<OrderPage instrumentID="IF2608" />);
    // 合约名称来自 store 中的 contracts 数据
    expect(screen.getByText('沪深300')).toBeDefined();
  });

  it('should display latest price when snapshot available', () => {
    // 行情快照由 useMarketStore 提供，需预先设置
    useMarketStore.setState({
      snapshots: new Map([
        ['IF2608', { lastPrice: 4585.6, instrumentID: 'IF2608' }],
      ]),
    });
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText(/4585\.6/)).toBeDefined();
  });

  it('should render direction buttons', () => {
    render(<OrderPage />);
    expect(screen.getByText('买')).toBeDefined();
    expect(screen.getByText('卖')).toBeDefined();
  });

  it('should render submit button', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText(/买入 IF2608/)).toBeDefined();
  });

  // --- 边界条件 ---

  it('should show only title when no instrumentID provided', () => {
    render(<OrderPage />);
    expect(screen.getByText('报单')).toBeDefined();
    // 不显示 instrument-info 区域的具体元素
    expect(screen.queryByText(/最新价/)).toBeNull();
    // 提交按钮显示占位文本（无合约代码）
    expect(screen.getByText(/买入\s/)).toBeDefined();
  });

  it('should show instrumentID but not name/price when contract not found', () => {
    render(<OrderPage instrumentID="IF9999" />);
    // 显示合约代码
    expect(screen.getByText('IF9999')).toBeDefined();
    // 不显示合约名称（contract 为 undefined）
    expect(screen.queryByText('沪深300')).toBeNull();
    // 不显示最新价（snapshot 为 null）
    expect(screen.queryByText(/最新价/)).toBeNull();
  });

  it('should show ID and name but not price when snapshot unavailable', () => {
    render(<OrderPage instrumentID="IF2608" />);
    // 显示合约代码和名称（contract 存在）
    expect(screen.getByText('IF2608')).toBeDefined();
    expect(screen.getByText('沪深300')).toBeDefined();
    // 不显示最新价（snapshot 为 null，beforeEach 清空了 snapshots）
    expect(screen.queryByText(/最新价/)).toBeNull();
  });
});
