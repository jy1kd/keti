import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderPage } from '../OrderPage';
import { useOrderStore } from '@/modules/order/store';
import { useContractsStore } from '@/stores/contracts';
import { useMarketStore } from '@/modules/market/store';
import type { MarketSnapshot } from '@/services/types';

// Mock API：AccountBar 挂载即拉取持仓/账户（jsdom 无后端，返回空即静默）
vi.mock('@/services/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/services/api')>();
  return {
    ...mod,
    refreshPositions: vi.fn(),
    refreshAccount: vi.fn(),
  };
});

const IF2608_CONTRACT = {
  instrumentID: 'IF2608',
  instrumentName: '沪深300',
  exchangeID: 'CFFEX',
  productID: 'IF',
  volumeMultiple: 300,
  priceTick: 0.2,
  expireDate: '2026-08-15',
  isTrading: 1,
  productClass: '1',
};

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4585.6,
    bidPrice1: 4585.2, bidVolume1: 45,
    bidPrice2: 4585.0, bidVolume2: 30,
    bidPrice3: 4584.8, bidVolume3: 12,
    bidPrice4: 4584.6, bidVolume4: 8,
    bidPrice5: 4584.4, bidVolume5: 5,
    askPrice1: 4585.6, askVolume1: 40,
    askPrice2: 4585.8, askVolume2: 22,
    askPrice3: 4586.0, askVolume3: 15,
    askPrice4: 4586.2, askVolume4: 9,
    askPrice5: 4586.4, askVolume5: 3,
    volume: 20892,
    openInterest: 45105,
    openPrice: 4573.6,
    highestPrice: 4590.0,
    lowestPrice: 4570.0,
    preSettlementPrice: 4573.6,
    upperLimitPrice: 5029.0,
    lowerLimitPrice: 4118.4,
    ...overrides,
  } as MarketSnapshot;
}

describe('OrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrderStore.getState().resetOrderForm();
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      isLoaded: true,
    });
    useMarketStore.setState({ snapshots: new Map() });
  });

  // ── 正常路径 ──

  it('should render title bar', () => {
    render(<OrderPage />);
    expect(screen.getByText('📝 报单')).toBeDefined();
  });

  it('should display instrument ID in title bar', () => {
    render(<OrderPage instrumentID="IF2608" />);
    const codes = screen.getAllByText('IF2608');
    expect(codes.length).toBeGreaterThanOrEqual(1);
  });

  // ── P1 主体：压缩参数区 + 三列十档盘口（与弹窗 OrderPopup 统一） ──

  it('渲染压缩参数区（开平/投保/有效期下拉 + 手数步进）', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByTestId('tp-volume')).toBeDefined();
    expect(screen.getByLabelText('开平')).toBeDefined();
    expect(screen.getByLabelText('投保')).toBeDefined();
    expect(screen.getByLabelText('有效期')).toBeDefined();
  });

  it('渲染三列十档盘口 + 快捷买卖栏（默认手数 1）', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByTestId('ask-1')).toBeDefined();
    expect(screen.getByTestId('bid-1')).toBeDefined();
    expect(screen.getByTestId('qtb-buy')).toBeDefined();
    expect(screen.getByTestId('qtb-sell')).toBeDefined();
    // 快捷买卖按钮文字随手数联动
    expect(screen.getByText('买入1手')).toBeDefined();
    expect(screen.getByText('卖出1手')).toBeDefined();
  });

  it('快照存在时汇总行显示最新价（priceTick 精度）', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    render(<OrderPage instrumentID="IF2608" />);
    // priceTick=0.2 → 1 位小数（最新价在汇总行与卖一档均显示）
    expect(screen.getAllByText('4585.6').length).toBeGreaterThanOrEqual(1);
  });

  it('快照不存在时盘口显示空态（--）', () => {
    render(<OrderPage instrumentID="IF2608" />);
    expect(screen.getByText('--')).toBeDefined();
  });

  it('should show instrumentID but not name when contract not found', () => {
    render(<OrderPage instrumentID="IF9999" />);
    expect(screen.getAllByText('IF9999').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('沪深300')).toBeNull();
  });

  // ── 点价确认闭环（与弹窗一致：每次必弹确认框；价格列只填改价框） ──

  it('点击盘口卖一档弹出确认框（方向/价格/手数/开平）', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    render(<OrderPage instrumentID="IF2608" />);
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__buy')!);
    const dialog = screen.getByTestId('confirm-dialog');
    expect(dialog).toBeDefined();
  });

  it('点击价格列只填改价框，不弹确认框', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    render(<OrderPage instrumentID="IF2608" />);
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__price')!);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    // 改价框已被填入卖一价
    expect((screen.getByTestId('qtb-price') as HTMLInputElement).value).toBe('4585.6');
  });

  // ── 拖拽句柄 ──

  it('标题栏应带 data-drag-handle（可拖为弹窗）', () => {
    const { container } = render(<OrderPage instrumentID="IF2608" />);
    const bar = container.querySelector('.order-page__title-bar');
    expect(bar).toHaveAttribute('data-drag-handle');
  });

  // ── 浮动窗口模式（报单标签转弹窗，与 OrderPopup 样式统一） ──

  it('浮动模式渲染 P1 主体（TradeParams + MarketDepth，复用 .order-popup__body）', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    const { container } = render(<OrderPage instrumentID="IF2608" floating />);
    expect(container.querySelector('.order-floating')).toBeDefined();
    expect(container.querySelector('.order-popup__body')).toBeDefined();
    expect(container.querySelector('.order-popup__params')).toBeDefined();
    expect(container.querySelector('.order-popup__depth')).toBeDefined();
    expect(screen.getByTestId('tp-volume')).toBeDefined();
    expect(screen.getByTestId('ask-1')).toBeDefined();
  });

  it('无合约停靠模式渲染完整空界面（参数区 + 盘口 -- + 请选择合约，操作按钮禁用）', () => {
    render(<OrderPage />)
    expect(screen.getByText('📝 报单')).toBeDefined()
    expect(screen.getByTestId('tp-volume')).toBeDefined()
    expect(screen.getByText('--')).toBeDefined()
    expect(screen.getByPlaceholderText('请选择合约')).toBeDefined()
    expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull()
    expect(screen.getByTestId('tp-cancel-latest')).toBeDisabled()
    expect(screen.getByTestId('tp-cancel-all')).toBeDisabled()
    expect(screen.getByTestId('tp-flat-net')).toBeDisabled()
  })

  it('无合约浮动模式渲染完整空界面（账户栏 + 参数区 + 盘口 -- + 请选择合约）', () => {
    const { container } = render(<OrderPage floating />)
    expect(container.querySelector('.order-floating')).toBeDefined()
    expect(container.querySelector('.order-popup__body')).toBeDefined()
    expect(screen.getByTestId('tp-volume')).toBeDefined()
    expect(screen.getByPlaceholderText('请选择合约')).toBeDefined()
    expect(screen.queryByText(/请在行情表格中选择合约/)).toBeNull()
  })

  it('非浮动模式同样渲染 P1 主体（标签页与弹窗统一）', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) });
    const { container } = render(<OrderPage instrumentID="IF2608" />);
    expect(container.querySelector('.order-popup__body')).toBeDefined();
    expect(screen.getByTestId('tp-volume')).toBeDefined();
    expect(screen.getByTestId('ask-1')).toBeDefined();
  });
});
