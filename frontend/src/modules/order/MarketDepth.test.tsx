import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketDepth } from './MarketDepth'
import type { MarketSnapshot } from '@/services/types'

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
    preSettlementPrice: 4690,
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

describe('MarketDepth（任务#1：骨架 + 数据接入）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染三列表头 买入/价格/卖出', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('卖出')).toBeInTheDocument()
  })

  it('渲染 5 卖档 + 5 买档', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`ask-${i}`)).toBeInTheDocument()
      expect(screen.getByTestId(`bid-${i}`)).toBeInTheDocument()
    }
  })

  it('渲染档位价格与数量：卖档卖出列显示卖量、买档买入列显示买量', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    // 卖一~卖五价格
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(4695 + i))).toBeInTheDocument()
    }
    // 买一~买五价格
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(String(4694 - i))).toBeInTheDocument()
    }
    // 卖档量（卖出列）
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
    // 买档量（买入列）
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('渲染汇总行：委买总量 / 最新价+涨跌 / 委卖总量', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('委买')).toBeInTheDocument()
    expect(screen.getByText('委卖')).toBeInTheDocument()
    // 委买总量 = 10+20+30+40+50
    expect(screen.getByText('150')).toBeInTheDocument()
    // 委卖总量 = 15+25+35+45+55
    expect(screen.getByText('175')).toBeInTheDocument()
    // 最新价
    expect(screen.getByText('4695')).toBeInTheDocument()
    // 涨跌 = 4695 - 4690 = +5.0（tick 0.2 → 1 位小数）
    expect(screen.getByText('+5.0')).toBeInTheDocument()
  })

  it('卖盘在上、买盘在下：从上到下 ask-5 → ask-1 → bid-1 → bid-5', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    const ladder = screen.getByTestId('depth-ladder')
    const rowTestIds = Array.from(
      ladder.querySelectorAll('[data-testid^="ask-"], [data-testid^="bid-"]'),
    ).map((el) => el.getAttribute('data-testid'))
    expect(rowTestIds[0]).toBe('ask-5')
    expect(rowTestIds[4]).toBe('ask-1')
    expect(rowTestIds[5]).toBe('bid-1')
    expect(rowTestIds[9]).toBe('bid-5')
  })

  describe('priceTick 兜底合成五档', () => {
    it('无真实挂单价时以最新价为基准 ± n×priceTick 合成', () => {
      const snap = makeSnapshot({
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
      render(<MarketDepth snapshot={snap} priceTick={0.2} />)
      // 基准回退最新价 4695：买一/卖一 = 4695.0，买二 = 4694.8，卖二 = 4695.2
      expect(screen.getAllByText('4695.0').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('4694.8')).toBeInTheDocument() // 买二
      expect(screen.getByText('4694.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4695.2')).toBeInTheDocument() // 卖二
      expect(screen.getByText('4695.8')).toBeInTheDocument() // 卖五
      // 无真实量 → 档位量显示 --
      expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(10)
    })

    it('以真实买一/卖一为基准向外推档位', () => {
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
      render(<MarketDepth snapshot={snap} priceTick={0.2} />)
      expect(screen.getByText('4694')).toBeInTheDocument() // 买一真实价
      expect(screen.getByText('4693.8')).toBeInTheDocument() // 买二 = 买一 - 0.2
      expect(screen.getByText('4693.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4696')).toBeInTheDocument() // 卖一真实价
      expect(screen.getByText('4696.2')).toBeInTheDocument() // 卖二 = 卖一 + 0.2
      expect(screen.getByText('4696.8')).toBeInTheDocument() // 卖五
    })
  })

  it('空快照显示空态', () => {
    render(<MarketDepth snapshot={null} priceTick={0.2} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })
})
