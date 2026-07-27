import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Position } from './Position'
import { useQueryStore } from './store'

vi.mock('../../services/api', () => ({
  getOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  getTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  getPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  getAccount: vi.fn().mockResolvedValue({ data: null }),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  cancelStopOrder: vi.fn(),
}))

describe('Position', () => {
  beforeEach(() => {
    useQueryStore.setState({ positions: [] })
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
})
