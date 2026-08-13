import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OrdersQuery } from './OrdersQuery'
import { useQueryStore } from './store'

vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn(),
  refreshTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  refreshPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  refreshAccount: vi.fn().mockResolvedValue(null),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn().mockResolvedValue({ success: true }),
  cancelAllOrders: vi.fn().mockResolvedValue({ success: true, attempted: 3, succeeded: 3, failedRefs: [] }),
  cancelStopOrder: vi.fn().mockResolvedValue({ success: true }),
}))

import { refreshOrders } from '../../services/api'
const mockRefreshOrders = vi.mocked(refreshOrders)

// status: 1003='5' 已撤单, 1002='1' 部分成交(已成交), 1001='2' 未成交(排队)
const mockOrders = [
  { orderRef: '1003', instrumentID: 'IF2609', direction: '1', combOffsetFlag: '0', limitPrice: 4900, volumeTotalOriginal: 2, volumeTraded: 0, orderStatus: '5', statusMsg: '已撤单', insertTime: '09:32:00' },
  { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '1', limitPrice: 4810, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '1', statusMsg: '部分成交', insertTime: '09:31:00' },
  { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '2', statusMsg: '未成交(排队)', insertTime: '09:30:00' },
]

describe('OrdersQuery', () => {
  beforeEach(() => {
    useQueryStore.setState({ orders: [], newOrderRefs: new Set(), isPaused: false })
  })

  it('renders three filter buttons', () => {
    render(<OrdersQuery />)
    expect(screen.getByText('全部报单')).toBeInTheDocument()
    expect(screen.getByText('未成交报单')).toBeInTheDocument()
    expect(screen.getByText('已成交报单')).toBeInTheDocument()
  })

  it('defaults to 全部报单 and shows all rows', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    expect(await screen.findByText('1001')).toBeInTheDocument()
    expect(screen.getByText('1002')).toBeInTheDocument()
    expect(screen.getByText('1003')).toBeInTheDocument()
  })

  it('未成交报单 shows only unfilled (status 2/3), excludes 部分成交 and 已撤单', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    await screen.findByText('1001')
    fireEvent.click(screen.getByText('未成交报单'))
    expect(screen.getByText('1001')).toBeInTheDocument()
    expect(screen.queryByText('1002')).not.toBeInTheDocument()
    expect(screen.queryByText('1003')).not.toBeInTheDocument()
  })

  it('已成交报单 shows filled (status 0/1), includes partial fill', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    await screen.findByText('1001')
    fireEvent.click(screen.getByText('已成交报单'))
    expect(screen.getByText('1002')).toBeInTheDocument()
    expect(screen.queryByText('1001')).not.toBeInTheDocument()
    expect(screen.queryByText('1003')).not.toBeInTheDocument()
  })

  it('shows 无匹配报单 when filter excludes all rows', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: [mockOrders[0]], count: 1 }) // 仅已撤单
    render(<OrdersQuery />)
    await screen.findByText('1003')
    fireEvent.click(screen.getByText('未成交报单'))
    expect(screen.getByText('无匹配报单')).toBeInTheDocument()
  })

  it('C key triggers handleCancelAll', async () => {
    const handleCancelAll = vi.fn().mockResolvedValue(true)
    useQueryStore.setState({ handleCancelAll })
    render(<OrdersQuery />)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'c' })
    })
    expect(handleCancelAll).toHaveBeenCalled()
  })
})
