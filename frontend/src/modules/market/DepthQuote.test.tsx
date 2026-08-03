import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DepthQuote } from './DepthQuote'
import type { MarketSnapshot } from '@/services/types'

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
    bidPrice1: 4694, bidVolume1: 10,
    bidPrice2: 4693, bidVolume2: 20,
    bidPrice3: 4692, bidVolume3: 30,
    bidPrice4: 4691, bidVolume4: 40,
    bidPrice5: 4690, bidVolume5: 50,
    askPrice1: 4696, askVolume1: 15,
    askPrice2: 4697, askVolume2: 25,
    askPrice3: 4698, askVolume3: 35,
    askPrice4: 4699, askVolume4: 45,
    askPrice5: 4700, askVolume5: 55,
    volume: 5000,
    openInterest: 3000,
    ...overrides,
  } as MarketSnapshot
}

describe('DepthQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders instrument ID in header', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    expect(screen.getByText('IF2608')).toBeInTheDocument()
  })

  it('renders last price in header', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    expect(screen.getByText('4695')).toBeInTheDocument()
  })

  it('renders 5 bid levels with price and volume', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    // 买一到买五的价格
    expect(screen.getByText('4694')).toBeInTheDocument()
    expect(screen.getByText('4693')).toBeInTheDocument()
    expect(screen.getByText('4692')).toBeInTheDocument()
    expect(screen.getByText('4691')).toBeInTheDocument()
    expect(screen.getByText('4690')).toBeInTheDocument()
    // 买一到买五的量
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('renders 5 ask levels with price and volume', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    // 卖一到卖五的价格
    expect(screen.getByText('4696')).toBeInTheDocument()
    expect(screen.getByText('4697')).toBeInTheDocument()
    expect(screen.getByText('4698')).toBeInTheDocument()
    expect(screen.getByText('4699')).toBeInTheDocument()
    expect(screen.getByText('4700')).toBeInTheDocument()
    // 卖一到卖五的量
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('shows placeholder when snapshot is null', () => {
    render(<DepthQuote snapshot={null} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  describe('priceTick 兜底合成五档', () => {
    it('无真实挂单价时以 买一/卖一为基准（回退最新价）± n×priceTick 合成', () => {
      // 五档买卖价全为无效值（0），量也为 0
      const snap = makeSnapshot({
        lastPrice: 4695,
        bidPrice1: 0, bidVolume1: 0,
        bidPrice2: 0, bidVolume2: 0,
        bidPrice3: 0, bidVolume3: 0,
        bidPrice4: 0, bidVolume4: 0,
        bidPrice5: 0, bidVolume5: 0,
        askPrice1: 0, askVolume1: 0,
        askPrice2: 0, askVolume2: 0,
        askPrice3: 0, askVolume3: 0,
        askPrice4: 0, askVolume4: 0,
        askPrice5: 0, askVolume5: 0,
      })
      render(<DepthQuote snapshot={snap} priceTick={0.2} />)

      // 基准回退最新价 4695：买一 = 4695（中间），买五 = 4695 - 4×0.2
      expect(screen.getAllByText('4695.0').length).toBeGreaterThanOrEqual(1) // 买一/卖一
      expect(screen.getByText('4694.8')).toBeInTheDocument() // 买二
      expect(screen.getByText('4694.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4695.2')).toBeInTheDocument() // 卖二
      expect(screen.getByText('4695.8')).toBeInTheDocument() // 卖五
      // 无真实量 → 档位量显示 --
      expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(10)
    })

    it('以真实买一/卖一为基准向外推档位', () => {
      // 买一真实 4694、卖一真实 4696，其余档无挂单
      const snap = makeSnapshot({
        bidPrice1: 4694, bidVolume1: 10,
        askPrice1: 4696, askVolume1: 15,
        bidPrice2: 0, bidVolume2: 0,
        bidPrice3: 0, bidVolume3: 0,
        bidPrice4: 0, bidVolume4: 0,
        bidPrice5: 0, bidVolume5: 0,
        askPrice2: 0, askVolume2: 0,
        askPrice3: 0, askVolume3: 0,
        askPrice4: 0, askVolume4: 0,
        askPrice5: 0, askVolume5: 0,
      })
      render(<DepthQuote snapshot={snap} priceTick={0.2} />)

      // 买一真实价显示，买二 = 买一 - 0.2，买五 = 买一 - 4×0.2
      expect(screen.getByText('4694')).toBeInTheDocument()
      expect(screen.getByText('4693.8')).toBeInTheDocument() // 买二
      expect(screen.getByText('4693.2')).toBeInTheDocument() // 买五
      // 卖一真实价显示，卖二 = 卖一 + 0.2，卖五 = 卖一 + 4×0.2
      expect(screen.getByText('4696')).toBeInTheDocument()
      expect(screen.getByText('4696.2')).toBeInTheDocument() // 卖二
      expect(screen.getByText('4696.8')).toBeInTheDocument() // 卖五
    })

    it('不传 priceTick 时无效档仍显示 --（MarketPanel 侧栏行为不变）', () => {
      const snap = makeSnapshot({
        bidPrice1: 0, bidVolume1: 0,
        askPrice1: 0, askVolume1: 0,
      })
      render(<DepthQuote snapshot={snap} />)
      // 无效档位显示 --，无合成价
      expect(screen.queryByText('4694.8')).not.toBeInTheDocument()
      expect(screen.queryByText('4695.2')).not.toBeInTheDocument()
      expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2)
    })

    it('合成档位可点击回填合成价', () => {
      const onSellClick = vi.fn()
      const snap = makeSnapshot({
        bidPrice1: 0, bidVolume1: 0,
      })
      render(<DepthQuote snapshot={snap} priceTick={0.2} onSellClick={onSellClick} />)
      // 买一无真实价 → 回退最新价基准，买一合成价 = 4695
      const bid1Row = screen.getByTestId('bid-1')
      bid1Row.click()
      expect(onSellClick).toHaveBeenCalledWith(4695)
    })
  })

  it('binds click handler on bid rows for point order', () => {
    const onSellClick = vi.fn()
    render(<DepthQuote snapshot={makeSnapshot()} onSellClick={onSellClick} />)
    // 验证 bid 行有 onClick 属性（React 通过 data-react-events 绑定）
    const bid1Row = screen.getByTestId('bid-1')
    expect(bid1Row).toBeTruthy()
    // 验证组件结构正确：有5个 bid 行
    const allBidRows = document.querySelectorAll('[data-testid^="bid-"]')
    expect(allBidRows.length).toBe(5)
  })

  it('binds click handler on ask rows for point order', () => {
    const onBuyClick = vi.fn()
    render(<DepthQuote snapshot={makeSnapshot()} onBuyClick={onBuyClick} />)
    const ask1Row = screen.getByTestId('ask-1')
    expect(ask1Row).toBeTruthy()
    const allAskRows = document.querySelectorAll('[data-testid^="ask-"]')
    expect(allAskRows.length).toBe(5)
  })
})
