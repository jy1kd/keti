import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryPanel } from './QueryPanel'
import { useQueryStore } from './store'

vi.mock('../../services/api', () => ({
  API_BASE: 'http://localhost:8000',
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

describe('QueryPanel', () => {
  beforeEach(() => {
    useQueryStore.setState({
      activeTab: 'orders',
      orders: [],
      trades: [],
      positions: [],
      account: null,
      stopOrders: [],
      isPaused: false,
      isLoading: false,
    })
  })

  it('删除冗余「查询面板」标题，工具栏直接承载 7 个子 Tab', () => {
    render(<QueryPanel />)
    expect(screen.queryByText('查询面板')).not.toBeInTheDocument()
    // 子 Tab 仍在工具栏内
    expect(screen.getByText('报单')).toBeInTheDocument()
    expect(screen.getByText('成交')).toBeInTheDocument()
  })

  it('renders all 6 tab buttons', () => {
    render(<QueryPanel />)
    expect(screen.getByText('报单')).toBeInTheDocument()
    expect(screen.getByText('成交')).toBeInTheDocument()
    expect(screen.getByText('持仓')).toBeInTheDocument()
    expect(screen.getByText('资金')).toBeInTheDocument()
    expect(screen.getByText('止损单')).toBeInTheDocument()
    expect(screen.getByText('合约')).toBeInTheDocument()
  })

  it('defaults to orders tab', () => {
    render(<QueryPanel />)
    expect(screen.getByText('报单')).toHaveClass('active')
  })

  it('switches tab on click', () => {
    render(<QueryPanel />)
    fireEvent.click(screen.getByText('成交'))
    expect(screen.getByText('成交')).toHaveClass('active')
    expect(screen.getByText('报单')).not.toHaveClass('active')
  })

  it('renders pause button', () => {
    render(<QueryPanel />)
    expect(screen.getByText('暂停')).toBeInTheDocument()
  })

  it('toggles pause on click', () => {
    render(<QueryPanel />)
    fireEvent.click(screen.getByText('暂停'))
    expect(screen.getByText('继续')).toBeInTheDocument()
  })

  it('renders refresh button', () => {
    render(<QueryPanel />)
    // Button text may be '刷新' or '刷新中…' depending on loading state
    const btn = screen.getByRole('button', { name: /刷新/ })
    expect(btn).toBeInTheDocument()
  })

  it('renders with query-panel class', () => {
    const { container } = render(<QueryPanel />)
    expect(container.firstChild).toHaveClass('query-panel')
  })

  it('renders OrderFlow when orders tab active', () => {
    render(<QueryPanel />)
    expect(screen.getByText('暂无报单数据')).toBeInTheDocument()
  })

  it('renders TradeFlow when trades tab active', () => {
    useQueryStore.setState({ activeTab: 'trades' })
    render(<QueryPanel />)
    expect(screen.getByText('暂无成交数据')).toBeInTheDocument()
  })

  it('renders Position when positions tab active', () => {
    useQueryStore.setState({ activeTab: 'positions' })
    render(<QueryPanel />)
    expect(screen.getByText('暂无持仓数据')).toBeInTheDocument()
  })

  it('renders AccountQuery when account tab active', () => {
    useQueryStore.setState({ activeTab: 'account' })
    render(<QueryPanel />)
    expect(screen.getByText('暂无资金数据')).toBeInTheDocument()
  })

  it('renders StopOrderList when stop_orders tab active', () => {
    useQueryStore.setState({ activeTab: 'stop_orders' })
    render(<QueryPanel />)
    expect(screen.getByText('暂无止损单')).toBeInTheDocument()
  })
})
