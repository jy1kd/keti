import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOrderStore, DEFAULT_ORDER_FORM } from './store'

// Mock the API module
vi.mock('../../services/api', () => ({
  submitOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))

// Mock toast
vi.mock('../../components/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { submitOrder as mockSubmitOrder, cancelOrder as mockCancelOrder } from '../../services/api'
import { toast } from '../../components/Toast'

describe('OrderStore', () => {
  beforeEach(() => {
    useOrderStore.setState({
      selectedInstrument: null,
      orderForm: { ...DEFAULT_ORDER_FORM },
      isSubmitting: false,
    })
    vi.clearAllMocks()
  })

  // --- existing tests ---

  it('has null selectedInstrument by default', () => {
    expect(useOrderStore.getState().selectedInstrument).toBeNull()
  })

  it('sets selected instrument from market panel', () => {
    useOrderStore.getState().setSelectedInstrument('au2508')
    expect(useOrderStore.getState().selectedInstrument).toBe('au2508')
  })

  // --- new: orderForm ---

  it('has default order form values', () => {
    const form = useOrderStore.getState().orderForm
    expect(form.instrumentID).toBe('')
    expect(form.direction).toBe('buy')
    expect(form.combOffsetFlag).toBe('open')
    expect(form.orderPriceType).toBe('limit')
    expect(form.timeCondition).toBe('gfd')
    expect(form.combHedgeFlag).toBe('speculation')
    expect(form.limitPrice).toBe(0)
    expect(form.volumeTotalOriginal).toBe(1)
  })

  it('setOrderForm updates a single field', () => {
    useOrderStore.getState().setOrderForm({ direction: 'sell' })
    expect(useOrderStore.getState().orderForm.direction).toBe('sell')
    // other fields unchanged
    expect(useOrderStore.getState().orderForm.combOffsetFlag).toBe('open')
  })

  it('setOrderForm updates multiple fields', () => {
    useOrderStore.getState().setOrderForm({
      instrumentID: 'IF2608',
      limitPrice: 4800,
      volumeTotalOriginal: 3,
    })
    const form = useOrderStore.getState().orderForm
    expect(form.instrumentID).toBe('IF2608')
    expect(form.limitPrice).toBe(4800)
    expect(form.volumeTotalOriginal).toBe(3)
  })

  it('resetOrderForm restores defaults', () => {
    useOrderStore.getState().setOrderForm({
      instrumentID: 'au2508',
      direction: 'sell',
      limitPrice: 500,
    })
    useOrderStore.getState().resetOrderForm()
    const form = useOrderStore.getState().orderForm
    expect(form.instrumentID).toBe('')
    expect(form.direction).toBe('buy')
    expect(form.limitPrice).toBe(0)
  })

  it('setSelectedInstrument also updates orderForm.instrumentID', () => {
    useOrderStore.getState().setSelectedInstrument('IF2608')
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2608')
  })

  // --- submitOrder ---

  it('submitOrder calls API and shows success toast', async () => {
    vi.mocked(mockSubmitOrder).mockResolvedValue({ success: true, orderRef: 'ORD-001' })

    useOrderStore.getState().setOrderForm({
      instrumentID: 'IF2608',
      direction: 'buy',
      limitPrice: 4800,
    })

    const result = await useOrderStore.getState().submitOrder()

    expect(result).toBe(true)
    expect(mockSubmitOrder).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('报单成功 ORD-001')

    // form should reset after success
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('')
  })

  it('submitOrder shows error toast on failure', async () => {
    vi.mocked(mockSubmitOrder).mockResolvedValue({
      success: false,
      orderRef: '',
      error: '资金不足',
    })

    useOrderStore.getState().setOrderForm({
      instrumentID: 'IF2608',
      direction: 'buy',
      limitPrice: 4800,
    })

    const result = await useOrderStore.getState().submitOrder()

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('报单失败：资金不足')
    // form should NOT reset on failure
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2608')
  })

  it('submitOrder shows error toast on network error', async () => {
    vi.mocked(mockSubmitOrder).mockRejectedValue(new Error('网络异常'))

    useOrderStore.getState().setOrderForm({
      instrumentID: 'IF2608',
      direction: 'buy',
      limitPrice: 4800,
    })

    const result = await useOrderStore.getState().submitOrder()

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('报单失败：网络异常')
  })

  it('sets isSubmitting to true during submit and resets after', async () => {
    vi.mocked(mockSubmitOrder).mockResolvedValue({ success: true, orderRef: 'X' })

    useOrderStore.getState().setOrderForm({
      instrumentID: 'IF2608',
      limitPrice: 4800,
    })

    const state = useOrderStore.getState()
    const promise = state.submitOrder()
    expect(useOrderStore.getState().isSubmitting).toBe(true)

    await promise
    expect(useOrderStore.getState().isSubmitting).toBe(false)
  })

  // --- submitOrder validation ---

  it('submitOrder shows error when instrumentID is empty', async () => {
    // reset to defaults (instrumentID is '') then submit
    useOrderStore.getState().resetOrderForm()
    const result = await useOrderStore.getState().submitOrder()

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('报单失败：请选择合约')
    expect(mockSubmitOrder).not.toHaveBeenCalled()
  })

  it('submitOrder shows error when limit order has zero price', async () => {
    // Reset to get limitPrice=0, orderPriceType='limit', then set valid instrumentID
    useOrderStore.getState().resetOrderForm()
    useOrderStore.getState().setOrderForm({ instrumentID: 'IF2608' })

    const result = await useOrderStore.getState().submitOrder()

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('报单失败：请输入有效价格')
    expect(mockSubmitOrder).not.toHaveBeenCalled()
  })

  // --- cancelOrder ---

  it('cancelOrder calls API and shows success toast', async () => {
    vi.mocked(mockCancelOrder).mockResolvedValue({ success: true })

    const result = await useOrderStore.getState().cancelOrder('ORD-001')

    expect(result).toBe(true)
    expect(mockCancelOrder).toHaveBeenCalledWith('ORD-001')
    expect(toast.success).toHaveBeenCalledWith('撤单成功')
  })

  it('cancelOrder shows error toast on failure', async () => {
    vi.mocked(mockCancelOrder).mockResolvedValue({
      success: false,
      message: '报单状态不允许撤单',
    })

    const result = await useOrderStore.getState().cancelOrder('ORD-001')

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('撤单失败：报单状态不允许撤单')
  })

  it('cancelOrder shows error toast on network error', async () => {
    vi.mocked(mockCancelOrder).mockRejectedValue(new Error('网络异常'))

    const result = await useOrderStore.getState().cancelOrder('ORD-001')

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('撤单失败：网络异常')
  })
})
