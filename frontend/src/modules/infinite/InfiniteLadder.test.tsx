import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfiniteLadder } from './InfiniteLadder'
import type { MarketSnapshot } from '@/services/types'

vi.mock('@/services/api')
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Mock useOrderTrigger：新 describe 块按需 mockReturnValue，现有用例走 store 默认值（single + confirm）
vi.mock('@/hooks/useOrderTrigger', () => ({
  useOrderTrigger: vi.fn(() => ({ triggerMode: 'single', confirmBeforeOrder: true })),
}))

import { useOrderTrigger } from '@/hooks/useOrderTrigger'

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

  it('渲染四列表头 可撤/买入/价格/卖出', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    expect(screen.getByText('可撤')).toBeInTheDocument()
    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('卖出')).toBeInTheDocument()
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

  it('程序化滚动(centerOn)后 scroll 事件同步窗口，行0移出可视区', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    // 挂载 effect 已调用 centerOn(lastIndex=25)：programmaticRef 置位、viewport.scrollTop 被写到最新价附近
    const viewport = screen.getByTestId('infinite-ladder__viewport')
    fireEvent.scroll(viewport)
    // 修复后 onScroll 先 setScrollTop → 窗口移到最新价附近，行0不再渲染
    expect(screen.queryByTestId('ladder-row-0')).toBeNull()
  })
})

describe('InfiniteLadder 盘口下单触发设置（单击/双击 + 二次确认）', () => {
  const UOT = useOrderTrigger as ReturnType<typeof vi.fn>
  const setOrderTrigger = (v: { triggerMode: 'single' | 'double'; confirmBeforeOrder: boolean }) =>
    UOT.mockReturnValue(v)

  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: 'IF2608', volumeTotalOriginal: 1 })
    useQueryStore.setState({ orders: [] })
    setOrderTrigger({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('single + 确认：单击买入列 → 弹确认框（默认行为，回归保护）', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    fireEvent.click(bidCell)
    expect(screen.getByText('确认报单')).toBeInTheDocument()
  })

  it('single + 免确认：单击买入列 → 直接提交，不弹确认框', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'single', confirmBeforeOrder: false })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    fireEvent.click(bidCell)
    await screen.findAllByText('') // let async settle
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('single + 免确认：单击卖出列 → 直接提交', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'single', confirmBeforeOrder: false })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const askCell = screen.getAllByTestId(/^ask-cell-/)[0]
    fireEvent.click(askCell)
    await screen.findAllByText('')
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
    expect(submitSpy).toHaveBeenCalledTimes(1)
  })

  it('double + 确认：单击买入列仅预览（不弹框、不提交），快速双击弹确认框', () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: true })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    // 第一次点击：仅预览，无确认框
    fireEvent.click(bidCell)
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
    // 快速第二次点击（双击窗口内）：弹确认框，仍未提交
    fireEvent.click(bidCell)
    expect(screen.getByText('确认报单')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('double + 免确认：快速双击直接提交，单击不提交', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    // 单击不提交
    fireEvent.click(bidCell)
    expect(submitSpy).not.toHaveBeenCalled()
    // 双击 → 直接提交
    fireEvent.click(bidCell)
    await screen.findAllByText('')
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
  })

  it('double + 确认：单击卖出列仅预览，快速双击弹确认框', () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: true })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const askCell = screen.getAllByTestId(/^ask-cell-/)[0]
    // 第一次点击：仅预览
    fireEvent.click(askCell)
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
    // 双击：弹确认框
    fireEvent.click(askCell)
    expect(screen.getByText('确认报单')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('double + 免确认：双击卖出列直接提交', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useInfiniteOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const askCell = screen.getAllByTestId(/^ask-cell-/)[0]
    fireEvent.click(askCell)
    expect(submitSpy).not.toHaveBeenCalled()
    fireEvent.click(askCell)
    await screen.findAllByText('')
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('确认报单')).not.toBeInTheDocument()
  })
})
