import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BatchCancel } from './index'

const mockOrders = [
  {
    orderRef: 'ORD-001',
    instrumentID: 'IF2608',
    direction: 'buy',
    combOffsetFlag: 'open',
    limitPrice: 4800.0,
    volumeTotalOriginal: 2,
    orderStatus: 'no_traded',
  },
  {
    orderRef: 'ORD-002',
    instrumentID: 'IF2609',
    direction: 'sell',
    combOffsetFlag: 'close',
    limitPrice: 4850.0,
    volumeTotalOriginal: 1,
    orderStatus: 'partial',
  },
  {
    orderRef: 'ORD-003',
    instrumentID: 'IF2608',
    direction: 'buy',
    combOffsetFlag: 'open',
    limitPrice: 4790.0,
    volumeTotalOriginal: 3,
    orderStatus: 'no_traded',
  },
]

describe('BatchCancel', () => {
  const onCancelOrder = vi.fn<[string], Promise<boolean>>()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    onCancelOrder.mockResolvedValue(true)
  })

  it('renders order list with checkboxes', () => {
    render(<BatchCancel orders={mockOrders} onCancelOrder={onCancelOrder} />)

    expect(screen.getByText('ORD-001')).toBeDefined()
    expect(screen.getByText('ORD-002')).toBeDefined()
    expect(screen.getByText('ORD-003')).toBeDefined()

    const checkboxes = screen.getAllByRole('checkbox')
    // 3 order checkboxes (select-all is a button, not a checkbox)
    expect(checkboxes.length).toBe(3)
  })

  it('renders empty state when no orders', () => {
    render(<BatchCancel orders={[]} onCancelOrder={onCancelOrder} />)

    expect(screen.getByText(/没有可撤销的报单/)).toBeDefined()
  })

  it('select all / deselect all works', async () => {
    render(<BatchCancel orders={mockOrders} onCancelOrder={onCancelOrder} />)

    // "Select All" button
    const selectAllBtn = screen.getByText('全选')
    fireEvent.click(selectAllBtn)

    const checkboxes = screen.getAllByRole('checkbox')
    // All should be checked
    checkboxes.forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(true)
    })

    // "Deselect All" should appear after selecting
    const deselectAllBtn = screen.getByText('取消全选')
    fireEvent.click(deselectAllBtn)

    // All should be unchecked
    const checkboxesAfter = screen.getAllByRole('checkbox')
    checkboxesAfter.forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(false)
    })
  })

  it('cancels selected orders', async () => {
    render(<BatchCancel orders={mockOrders} onCancelOrder={onCancelOrder} />)

    // Select first two orders (checkboxes are per-order only)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]!)
    fireEvent.click(checkboxes[1]!)

    // Click "Cancel Selected"
    const cancelBtn = screen.getByText(/撤销选中/).closest('button')!
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(onCancelOrder).toHaveBeenCalledTimes(2)
      expect(onCancelOrder).toHaveBeenCalledWith('ORD-001')
      expect(onCancelOrder).toHaveBeenCalledWith('ORD-002')
    })
  })

  it('shows success count after cancellation', async () => {
    render(<BatchCancel orders={mockOrders.slice(0, 1)} onCancelOrder={onCancelOrder} />)

    // Select the only order
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]!)

    const cancelBtn = screen.getByText(/撤销选中/).closest('button')!
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.getByText(/成功 1/)).toBeDefined()
    })
  })

  it('shows failure count when cancel fails', async () => {
    onCancelOrder.mockRejectedValue(new Error('Cancel rejected'))

    render(<BatchCancel orders={mockOrders.slice(0, 1)} onCancelOrder={onCancelOrder} />)

    // Select the order
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]!)

    const cancelBtn = screen.getByText(/撤销选中/).closest('button')!
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.getByText(/失败 1/)).toBeDefined()
    })
  })

  it('calls onClose when close button is clicked', () => {
    render(<BatchCancel orders={mockOrders} onCancelOrder={onCancelOrder} onClose={onClose} />)

    const closeBtn = screen.getByText('关闭')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables cancel button while cancellation is in progress', async () => {
    onCancelOrder.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100)))

    render(<BatchCancel orders={mockOrders.slice(0, 1)} onCancelOrder={onCancelOrder} />)

    // Select the order
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]!)

    const cancelBtn = screen.getByText(/撤销选中/).closest('button')!
    fireEvent.click(cancelBtn)

    // Button should be disabled during cancellation
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true)

    await waitFor(() => {
      expect(onCancelOrder).toHaveBeenCalled()
    })
  })

  it('disables cancel button when no orders selected', () => {
    render(<BatchCancel orders={mockOrders} onCancelOrder={onCancelOrder} />)

    const cancelBtn = screen.getByText(/撤销选中/).closest('button')!
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true)
  })
})
