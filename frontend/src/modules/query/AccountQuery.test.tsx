import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountQuery } from './AccountQuery'
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

describe('AccountQuery', () => {
  beforeEach(() => {
    useQueryStore.setState({ account: null })
  })

  it('renders empty state when no account data', () => {
    render(<AccountQuery />)
    expect(screen.getByText('暂无资金数据')).toBeInTheDocument()
  })

  it('renders account info fields', () => {
    useQueryStore.setState({
      account: {
        accountID: 'test', balance: 100000, available: 50000, frozenMargin: 10000,
        currMargin: 40000, commission: 100, closeProfit: 500, positionProfit: 200,
        deposit: 0, withdraw: 0, preBalance: 99800, tradingDay: '20260727',
      },
    })
    render(<AccountQuery />)
    expect(screen.getByText('权益')).toBeInTheDocument()
    expect(screen.getByText('可用资金')).toBeInTheDocument()
    expect(screen.getByText('冻结保证金')).toBeInTheDocument()
    expect(screen.getByText('持仓保证金')).toBeInTheDocument()
    expect(screen.getByText('手续费')).toBeInTheDocument()
    expect(screen.getByText('平仓盈亏')).toBeInTheDocument()
    expect(screen.getByText('持仓盈亏')).toBeInTheDocument()
  })

  it('renders account values', () => {
    useQueryStore.setState({
      account: {
        accountID: 'test', balance: 100000, available: 50000, frozenMargin: 10000,
        currMargin: 40000, commission: 100, closeProfit: 500, positionProfit: 200,
        deposit: 0, withdraw: 0, preBalance: 99800, tradingDay: '20260727',
      },
    })
    render(<AccountQuery />)
    expect(screen.getByText('100000.00')).toBeInTheDocument()
    expect(screen.getByText('50000.00')).toBeInTheDocument()
  })

  it('renders with account-query class', () => {
    const { container } = render(<AccountQuery />)
    expect(container.firstChild).toHaveClass('account-query')
  })
})
