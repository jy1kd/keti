import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderPanel } from './OrderPanel'

let mockState: Record<string, unknown> = {}

vi.mock('./store', () => ({
  useOrderStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    return selector ? selector(mockState) : mockState
  }),
}))

// Mock API modules used by child components
vi.mock('../../services/api', () => ({
  cancelAllOrders: vi.fn().mockResolvedValue({ success: true, cancelled: 0, failed: 0, errors: [] }),
  reversePosition: vi.fn().mockResolvedValue({ success: true, message: '' }),
  lockPosition: vi.fn().mockResolvedValue({ success: true, message: '' }),
  getOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  getPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  cancelOrder: vi.fn().mockResolvedValue(true),
}))

function setMockState(overrides: Record<string, unknown> = {}) {
  mockState = {
    orderForm: {
      instrumentID: 'IF2608',
      direction: 'buy',
      combOffsetFlag: 'open',
      orderPriceType: 'limit',
      timeCondition: 'gfd',
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    },
    isSubmitting: false,
    setOrderForm: vi.fn(),
    submitOrder: vi.fn(),
    resetOrderForm: vi.fn(),
    ...overrides,
  }
}

describe('OrderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockState()
  })

  it('renders panel title', () => {
    render(<OrderPanel />)
    expect(screen.getByText('报单面板')).toBeInTheDocument()
  })

  it('renders with order-panel class', () => {
    const { container } = render(<OrderPanel />)
    expect(container.firstChild).toHaveClass('order-panel')
  })

  it('renders tab buttons for 报单 and 止损单', () => {
    render(<OrderPanel />)
    expect(screen.getByText('报单')).toBeInTheDocument()
    expect(screen.getByText('止损单')).toBeInTheDocument()
  })

  it('shows OrderForm by default (报单 tab)', () => {
    render(<OrderPanel />)
    expect(screen.getByText('买')).toBeInTheDocument()
    expect(screen.getByText('卖')).toBeInTheDocument()
  })

  it('switches to StopOrderForm when 止损单 tab clicked', () => {
    render(<OrderPanel />)

    fireEvent.click(screen.getByText('止损单'))

    expect(screen.getByText('止损价')).toBeInTheDocument()
  })

  it('triggers setOrderForm(direction=buy) on B key press', () => {
    render(<OrderPanel />)

    fireEvent.keyDown(window, { key: 'b' })

    expect(mockState.setOrderForm).toHaveBeenCalledWith({ direction: 'buy' })
  })

  it('triggers setOrderForm(direction=sell) on S key press', () => {
    render(<OrderPanel />)

    fireEvent.keyDown(window, { key: 's' })

    expect(mockState.setOrderForm).toHaveBeenCalledWith({ direction: 'sell' })
  })

  // ── PR-15: QuickActions integration ─────────────────────────────────

  it('renders QuickActions buttons', () => {
    render(<OrderPanel />)

    expect(screen.getByText('一键反向')).toBeInTheDocument()
    expect(screen.getByText('一键锁仓')).toBeInTheDocument()
    expect(screen.getByText('批量撤单')).toBeInTheDocument()
  })

  it('opens BatchCancel panel when 批量撤单 clicked', () => {
    render(<OrderPanel />)

    fireEvent.click(screen.getByText('批量撤单'))

    // BatchCancel header should appear
    expect(screen.getByText(/批量撤单/)).toBeInTheDocument()
  })
})
