import { create } from 'zustand'
import { submitOrder as apiSubmitOrder } from '../../services/api'
import { toast } from '../../components/Toast'
import type { OrderRequestForm } from '../../utils/orderMapping'

export const DEFAULT_ORDER_FORM: OrderRequestForm = {
  instrumentID: '',
  direction: 'buy',
  combOffsetFlag: 'open',
  orderPriceType: 'limit',
  timeCondition: 'gfd',
  limitPrice: 0,
  volumeTotalOriginal: 1,
}

interface OrderStore {
  selectedInstrument: string | null
  orderForm: OrderRequestForm
  isSubmitting: boolean
  setSelectedInstrument: (instrument: string | null) => void
  setOrderForm: (partial: Partial<OrderRequestForm>) => void
  resetOrderForm: () => void
  submitOrder: () => Promise<boolean>
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  selectedInstrument: null,
  orderForm: { ...DEFAULT_ORDER_FORM },
  isSubmitting: false,

  setSelectedInstrument: (instrument) => {
    set({
      selectedInstrument: instrument,
      orderForm: { ...get().orderForm, instrumentID: instrument ?? '' },
    })
  },

  setOrderForm: (partial) => {
    set({ orderForm: { ...get().orderForm, ...partial } })
  },

  resetOrderForm: () => {
    set({ orderForm: { ...DEFAULT_ORDER_FORM } })
  },

  submitOrder: async () => {
    set({ isSubmitting: true })
    try {
      const result = await apiSubmitOrder(get().orderForm)
      if (result.success) {
        toast.success(`报单成功 ${result.orderRef}`)
        set({ orderForm: { ...DEFAULT_ORDER_FORM }, isSubmitting: false })
        return true
      } else {
        toast.error(`报单失败：${result.error || '未知错误'}`)
        set({ isSubmitting: false })
        return false
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`报单失败：${message}`)
      set({ isSubmitting: false })
      return false
    }
  },
}))
