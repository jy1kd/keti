import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Position } from './Position'
import { useQueryStore } from './store'
import { useOrderStore } from '../order/store'
import { useMarketStore } from '../market/store'
import { useTabStore } from '@/stores/tabs'

vi.mock('../../services/api', () => ({
  getOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  getTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  getPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  getAccount: vi.fn().mockResolvedValue({ data: null }),
  refreshOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  refreshTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  refreshPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  refreshAccount: vi.fn().mockResolvedValue(null),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  cancelStopOrder: vi.fn(),
}))

describe('Position', () => {
  beforeEach(() => {
    useQueryStore.setState({ positions: [] })
    // 重置 tabStore：平仓会触发 openTab 副作用，避免用例间顺序依赖
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('renders empty state when no positions', () => {
    render(<Position />)
    expect(screen.getByText('暂无持仓数据')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByText('方向')).toBeInTheDocument()
    expect(screen.getByText('持仓量')).toBeInTheDocument()
    expect(screen.getByText('持仓盈亏')).toBeInTheDocument()
    expect(screen.getByText('开仓成本')).toBeInTheDocument()
    expect(screen.getByText('占用保证金')).toBeInTheDocument()
    expect(screen.getByText('今仓')).toBeInTheDocument()
    expect(screen.getByText('昨仓')).toBeInTheDocument()
  })

  it('renders position rows', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
        { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    expect(screen.getByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('IF2609')).toBeInTheDocument()
  })

  it('shows close button for each position', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    expect(screen.getByText('平仓')).toBeInTheDocument()
  })

  it('renders with position-table-wrap class', () => {
    const { container } = render(<Position />)
    expect(container.firstChild).toHaveClass('position-table-wrap')
  })

  it('uses close_today when todayPosition > 0', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))
    const form = useOrderStore.getState().orderForm
    expect(form.combOffsetFlag).toBe('close_today')
  })

  it('uses close when todayPosition === 0', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))
    const form = useOrderStore.getState().orderForm
    expect(form.combOffsetFlag).toBe('close')
  })

  it('fills limitPrice with askPrice1 when closing long position', () => {
    // 设置行情快照
    useMarketStore.setState({
      snapshots: new Map([
        ['IF2608', { instrumentID: 'IF2608', lastPrice: 4000, bidPrice1: 3999, askPrice1: 4001, bidVolume1: 10, askVolume1: 5 } as any],
      ]),
    })
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))
    const form = useOrderStore.getState().orderForm
    expect(form.limitPrice).toBe(4001) // 平多 → 卖出 → askPrice1
    expect(form.direction).toBe('sell')
  })

  it('fills limitPrice with bidPrice1 when closing short position', () => {
    useMarketStore.setState({
      snapshots: new Map([
        ['IF2609', { instrumentID: 'IF2609', lastPrice: 4000, bidPrice1: 3999, askPrice1: 4001, bidVolume1: 10, askVolume1: 5 } as any],
      ]),
    })
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))
    const form = useOrderStore.getState().orderForm
    expect(form.limitPrice).toBe(3999) // 平空 → 买入 → bidPrice1
    expect(form.direction).toBe('buy')
  })

  it('keeps limitPrice at 0 when no market snapshot', () => {
    useMarketStore.setState({ snapshots: new Map() })
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))
    const form = useOrderStore.getState().orderForm
    expect(form.limitPrice).toBe(0)
  })

  it('opens an order tab with close params when clicking 平仓', () => {
    useQueryStore.setState({
      positions: [
        { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      ],
    })
    render(<Position />)
    fireEvent.click(screen.getByText('平仓'))

    // 平仓参数填充完整（direction/combOffsetFlag/volumeTotalOriginal 锁定在同一用例）
    const form = useOrderStore.getState().orderForm
    expect(form.direction).toBe('sell')
    expect(form.combOffsetFlag).toBe('close_today')
    expect(form.volumeTotalOriginal).toBe(2)

    // 报单标签打开（title/props/activeTab 正确）
    const { tabs, activeTabId } = useTabStore.getState()
    const orderTab = tabs.find((t) => t.type === 'order')
    expect(orderTab).toBeDefined()
    expect(orderTab?.title).toBe('📝 报单-IF2608')
    expect(orderTab?.props.instrumentID).toBe('IF2608')
    expect(activeTabId).toBe('tab-order-IF2608')
  })
})
