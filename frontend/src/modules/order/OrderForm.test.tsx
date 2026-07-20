import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderForm } from './OrderForm'

// Mutable state that the mock selector reads from
let mockState: Record<string, unknown> = {}

vi.mock('./store', () => ({
  useOrderStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    return selector ? selector(mockState) : mockState
  }),
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
    submitOrder: mockState.submitOrder || vi.fn(),
    resetOrderForm: vi.fn(),
    ...overrides,
  }
}

describe('OrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockState()
  })

  it('renders direction toggle (买/卖)', () => {
    render(<OrderForm />)
    expect(screen.getByText('买')).toBeInTheDocument()
    expect(screen.getByText('卖')).toBeInTheDocument()
  })

  it('renders offset toggle (开/平/平今)', () => {
    render(<OrderForm />)
    expect(screen.getByText('开')).toBeInTheDocument()
    expect(screen.getByText('平')).toBeInTheDocument()
    expect(screen.getByText('平今')).toBeInTheDocument()
  })

  it('renders price type toggle (限价/市价)', () => {
    render(<OrderForm />)
    expect(screen.getByText('限价')).toBeInTheDocument()
    expect(screen.getByText('市价')).toBeInTheDocument()
  })

  it('renders time condition toggle (GFD/FOK/FAK)', () => {
    render(<OrderForm />)
    expect(screen.getByText('GFD')).toBeInTheDocument()
    expect(screen.getByText('FOK')).toBeInTheDocument()
    expect(screen.getByText('FAK')).toBeInTheDocument()
  })

  it('renders price input', () => {
    render(<OrderForm />)
    const priceInput = screen.getByDisplayValue('4800')
    expect(priceInput).toBeInTheDocument()
  })

  it('renders volume input', () => {
    render(<OrderForm />)
    const volumeInput = screen.getByDisplayValue('1')
    expect(volumeInput).toBeInTheDocument()
  })

  it('renders submit button with correct text for buy direction', () => {
    render(<OrderForm />)
    const btn = screen.getByRole('button', { name: /买入 IF2608/ })
    expect(btn).toBeInTheDocument()
  })

  it('renders submit button with 卖出 text for sell direction', () => {
    setMockState({
      orderForm: {
        instrumentID: 'au2508',
        direction: 'sell',
        combOffsetFlag: 'close',
        orderPriceType: 'limit',
        timeCondition: 'gfd',
        limitPrice: 500.0,
        volumeTotalOriginal: 2,
      },
    })

    render(<OrderForm />)
    const btn = screen.getByRole('button', { name: /卖出 au2508/ })
    expect(btn).toBeInTheDocument()
  })

  it('calls submitOrder when submit button clicked', () => {
    const submitOrder = vi.fn()
    setMockState({ submitOrder })

    render(<OrderForm />)
    const btn = screen.getByRole('button', { name: /买入/ })
    fireEvent.click(btn)
    expect(submitOrder).toHaveBeenCalledTimes(1)
  })

  it('disables submit button and shows 提交中 when isSubmitting', () => {
    setMockState({ isSubmitting: true })

    render(<OrderForm />)
    const btn = screen.getByRole('button', { name: /提交中/ })
    expect(btn).toBeDisabled()
  })
})
