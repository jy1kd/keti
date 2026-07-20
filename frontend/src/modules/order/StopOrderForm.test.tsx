import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StopOrderForm } from './StopOrderForm'

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
      stopPrice: 4790.0,
    },
    isSubmitting: false,
    setOrderForm: vi.fn(),
    submitOrder: vi.fn(),
    resetOrderForm: vi.fn(),
    ...overrides,
  }
}

describe('StopOrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockState()
  })

  it('renders direction toggle', () => {
    render(<StopOrderForm />)
    expect(screen.getByText('买')).toBeInTheDocument()
    expect(screen.getByText('卖')).toBeInTheDocument()
  })

  it('renders offset toggle', () => {
    render(<StopOrderForm />)
    expect(screen.getByText('开')).toBeInTheDocument()
    expect(screen.getByText('平')).toBeInTheDocument()
  })

  it('renders price input', () => {
    render(<StopOrderForm />)
    expect(screen.getByDisplayValue('4800')).toBeInTheDocument()
  })

  it('renders volume input', () => {
    render(<StopOrderForm />)
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
  })

  it('renders stop price input', () => {
    render(<StopOrderForm />)
    expect(screen.getByDisplayValue('4790')).toBeInTheDocument()
  })

  it('renders 止损 label', () => {
    render(<StopOrderForm />)
    expect(screen.getByText('止损价')).toBeInTheDocument()
  })

  it('renders submit button with stop order text', () => {
    render(<StopOrderForm />)
    const btn = screen.getByRole('button', { name: /止损买入/ })
    expect(btn).toBeInTheDocument()
  })
})
