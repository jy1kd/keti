import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { StopOrderList } from './StopOrderList'
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

describe('StopOrderList', () => {
  beforeEach(() => {
    useQueryStore.setState({ stopOrders: [] })
  })

  it('renders empty state when no stop orders', () => {
    render(<StopOrderList />)
    expect(screen.getByText('暂无止损单')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    useQueryStore.setState({
      stopOrders: [
        { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'pending', createdAt: '09:30:00' },
      ],
    })
    render(<StopOrderList />)
    expect(screen.getByText('止损单号')).toBeInTheDocument()
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByText('方向')).toBeInTheDocument()
    expect(screen.getByText('止损价')).toBeInTheDocument()
    expect(screen.getByText('委托价')).toBeInTheDocument()
    expect(screen.getByText('数量')).toBeInTheDocument()
    expect(screen.getByText('状态')).toBeInTheDocument()
    expect(screen.getByText('创建时间')).toBeInTheDocument()
  })

  it('shows cancel button for pending stop orders', () => {
    useQueryStore.setState({
      stopOrders: [
        { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'pending', createdAt: '09:30:00' },
      ],
    })
    render(<StopOrderList />)
    expect(screen.getByText('取消')).toBeInTheDocument()
  })

  it('does not show cancel button for non-pending stop orders', () => {
    useQueryStore.setState({
      stopOrders: [
        { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'triggered', createdAt: '09:30:00', triggeredAt: '09:35:00' },
      ],
    })
    render(<StopOrderList />)
    expect(screen.queryByText('取消')).not.toBeInTheDocument()
  })

  it('calls handleCancelStopOrder when cancel clicked', async () => {
    useQueryStore.setState({
      stopOrders: [
        { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'pending', createdAt: '09:30:00' },
      ],
    })
    const handleCancel = vi.fn().mockResolvedValue(true)
    useQueryStore.setState({ handleCancelStopOrder: handleCancel })

    render(<StopOrderList />)
    await act(async () => {
      fireEvent.click(screen.getByText('取消'))
    })

    expect(handleCancel).toHaveBeenCalledWith('S001')
  })

  it('renders with stop-order-list class', () => {
    const { container } = render(<StopOrderList />)
    expect(container.firstChild).toHaveClass('stop-order-list')
  })
})
