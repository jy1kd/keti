import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradeFlow } from './TradeFlow'
import { useQueryStore } from './store'

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

describe('TradeFlow', () => {
  beforeEach(() => {
    useQueryStore.setState({ trades: [], newTradeIDs: new Set() })
  })

  it('renders empty state when no trades', () => {
    render(<TradeFlow />)
    expect(screen.getByText('暂无成交数据')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    useQueryStore.setState({
      trades: [
        { tradeID: 'T001', orderRef: '1001', instrumentID: 'IF2608', direction: '0', offsetFlag: '0', price: 4800, volume: 1, tradeTime: '09:30:01' },
      ],
    })
    render(<TradeFlow />)
    expect(screen.getByText('成交号')).toBeInTheDocument()
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByText('买卖')).toBeInTheDocument()
    expect(screen.getByText('开平')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('数量')).toBeInTheDocument()
    expect(screen.getByText('时间')).toBeInTheDocument()
  })

  it('renders trade rows', () => {
    useQueryStore.setState({
      trades: [
        { tradeID: 'T001', orderRef: '1001', instrumentID: 'IF2608', direction: '0', offsetFlag: '0', price: 4800, volume: 1, tradeTime: '09:30:01' },
        { tradeID: 'T002', orderRef: '1002', instrumentID: 'IF2609', direction: '1', offsetFlag: '1', price: 4900, volume: 2, tradeTime: '09:31:00' },
      ],
    })
    render(<TradeFlow />)
    expect(screen.getByText('T001')).toBeInTheDocument()
    expect(screen.getByText('T002')).toBeInTheDocument()
  })

  it('applies highlight class to new trades', () => {
    useQueryStore.setState({
      trades: [
        { tradeID: 'T001', orderRef: '1001', instrumentID: 'IF2608', direction: '0', offsetFlag: '0', price: 4800, volume: 1, tradeTime: '09:30:01' },
      ],
      newTradeIDs: new Set(['T001']),
    })
    const { container } = render(<TradeFlow />)
    expect(container.querySelector('.row-new')).toBeInTheDocument()
  })

  it('renders with trade-flow class', () => {
    const { container } = render(<TradeFlow />)
    expect(container.firstChild).toHaveClass('trade-flow')
  })
})
