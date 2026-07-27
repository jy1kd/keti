import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OrderFlow } from './OrderFlow'
import { useQueryStore } from './store'

vi.mock('../../services/api', () => ({
  getOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  getTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  getPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  getAccount: vi.fn().mockResolvedValue({ data: null }),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn().mockResolvedValue({ success: true }),
  cancelAllOrders: vi.fn().mockResolvedValue({ success: true, cancelled: 0, failed: 0, errors: [] }),
  cancelStopOrder: vi.fn().mockResolvedValue({ success: true }),
}))

const mockOrders = [
  { orderRef: '1003', instrumentID: 'IF2609', direction: '1', combOffsetFlag: '0', limitPrice: 4900, volumeTotalOriginal: 2, volumeTraded: 0, orderStatus: '5', statusMsg: '已撤单', insertTime: '09:32:00' },
  { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '1', limitPrice: 4810, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '3', statusMsg: '全部成交', insertTime: '09:31:00' },
  { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '已提交', insertTime: '09:30:00' },
]

describe('OrderFlow', () => {
  beforeEach(() => {
    useQueryStore.setState({
      orders: [],
      newOrderRefs: new Set(),
      isPaused: false,
    })
  })

  it('renders empty state when no orders', () => {
    render(<OrderFlow />)
    expect(screen.getByText('暂无报单数据')).toBeInTheDocument()
  })

  it('renders order rows', () => {
    useQueryStore.setState({ orders: mockOrders })
    render(<OrderFlow />)
    expect(screen.getByText('1001')).toBeInTheDocument()
    expect(screen.getByText('1002')).toBeInTheDocument()
    expect(screen.getByText('1003')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })
    render(<OrderFlow />)
    expect(screen.getByText('报单号')).toBeInTheDocument()
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByText('买卖')).toBeInTheDocument()
    expect(screen.getByText('开平')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('委托量')).toBeInTheDocument()
    expect(screen.getByText('成交量')).toBeInTheDocument()
    expect(screen.getByText('状态')).toBeInTheDocument()
    expect(screen.getByText('时间')).toBeInTheDocument()
  })

  it('shows cancel button for active orders (status 0 or 1)', () => {
    useQueryStore.setState({ orders: mockOrders })
    render(<OrderFlow />)
    // Order 1001 has status '0' (submitted) — should show cancel button
    const cancelBtns = screen.getAllByText('撤单')
    // Order 1001 is active, 1002 is all_traded(3), 1003 is canceled(5)
    expect(cancelBtns).toHaveLength(1)
  })

  it('does not show cancel button for completed/canceled orders', () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4810, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '3', statusMsg: '', insertTime: '09:31:00' },
        { orderRef: '1003', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4900, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '5', statusMsg: '', insertTime: '09:32:00' },
      ],
    })
    render(<OrderFlow />)
    expect(screen.queryByText('撤单')).not.toBeInTheDocument()
  })

  it('calls handleCancelOrder when cancel button clicked', async () => {
    const handleCancelOrder = vi.fn().mockResolvedValue(true)
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
      handleCancelOrder,
    })

    render(<OrderFlow />)
    await act(async () => {
      fireEvent.click(screen.getByText('撤单'))
    })

    expect(handleCancelOrder).toHaveBeenCalledWith('1001')
  })

  it('renders cancel-all button', () => {
    render(<OrderFlow />)
    expect(screen.getByText('撤销全部')).toBeInTheDocument()
  })

  it('cancel-all button is disabled when no orders', () => {
    render(<OrderFlow />)
    expect(screen.getByText('撤销全部')).toBeDisabled()
  })

  it('calls handleCancelAll when cancel-all button clicked', async () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })
    const handleCancelAll = vi.fn().mockResolvedValue(true)
    useQueryStore.setState({ handleCancelAll })

    render(<OrderFlow />)

    await act(async () => {
      fireEvent.click(screen.getByText('撤销全部'))
    })

    expect(handleCancelAll).toHaveBeenCalled()
  })

  it('applies highlight class to new orders', () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
      newOrderRefs: new Set(['1001']),
    })
    const { container } = render(<OrderFlow />)
    expect(container.querySelector('.row-new')).toBeInTheDocument()
  })

  it('renders with order-flow class', () => {
    const { container } = render(<OrderFlow />)
    expect(container.firstChild).toHaveClass('order-flow')
  })
})
