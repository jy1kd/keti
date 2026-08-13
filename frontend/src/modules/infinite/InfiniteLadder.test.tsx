import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfiniteLadder } from './InfiniteLadder'
import type { MarketSnapshot } from '@/services/types'

vi.mock('@/services/api')
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useInfiniteOrderStore } from './store'
import { useQueryStore } from '../query/store'

function snap(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000, ...overrides,
  } as MarketSnapshot
}

describe('InfiniteLadder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: 'IF2608', volumeTotalOriginal: 1 })
    useQueryStore.setState({ orders: [] })
  })

  it('渲染四列表头 可撤/买入量/价格/卖出量', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    expect(screen.getByText('可撤')).toBeInTheDocument()
    expect(screen.getByText('买入量')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('卖出量')).toBeInTheDocument()
  })

  it('窗口化：仅渲染可视区行，而非全轴', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    // 轴长 51 行，可视区+overscan 应远小于 51
    const rows = screen.getAllByTestId(/^ladder-row-/)
    expect(rows.length).toBeLessThan(51)
  })

  it('点击买入量列弹出确认框', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    fireEvent.click(bidCell)
    expect(screen.getByText('确认报单')).toBeInTheDocument()
  })

  it('涨跌停价无效时显示空态', () => {
    render(<InfiniteLadder snapshot={snap({ upperLimitPrice: 0 })} priceTick={0.2} instrumentID="IF2608" />)
    expect(screen.getByText(/未订阅行情或涨跌停价无效/)).toBeInTheDocument()
  })
})
