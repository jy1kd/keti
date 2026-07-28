import { create } from 'zustand'
import { submitOrder as apiSubmitOrder, cancelOrder as apiCancelOrder, submitStopOrder as apiSubmitStopOrder } from '../../services/api'
import { toast } from '../../components/Toast'
import { useContractsStore } from '../../stores/contracts'
import { useMarketStore } from '../market/store'
import { validateVolumeWithLimit, validateArbitrage } from '../../utils/validators'
import type { OrderRequestForm } from '../../utils/orderMapping'

export const DEFAULT_ORDER_FORM: OrderRequestForm = {
  instrumentID: '',
  exchangeID: 'CFFEX',
  direction: 'buy',
  combOffsetFlag: 'open',
  orderPriceType: 'limit',
  timeCondition: 'gfd',
  combHedgeFlag: 'speculation',
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
  submitStopOrder: (triggerPriceType?: 'limit' | 'market') => Promise<boolean>
  cancelOrder: (orderRef: string) => Promise<boolean>
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  selectedInstrument: null,
  orderForm: { ...DEFAULT_ORDER_FORM },
  isSubmitting: false,

  // 选中合约时更新 instrumentID 和 exchangeID，保留用户已选择的方向/开平设置
  setSelectedInstrument: (instrument) => {
    const currentForm = get().orderForm
    let exchangeID = currentForm.exchangeID ?? 'CFFEX'

    // 从合约信息中获取 exchangeID
    if (instrument) {
      const contracts = useContractsStore.getState().contracts
      const contract = contracts.find(c => c.instrumentID === instrument)
      if (contract?.exchangeID) {
        exchangeID = contract.exchangeID
      }
    }

    set({
      selectedInstrument: instrument,
      orderForm: { ...currentForm, instrumentID: instrument ?? '', exchangeID },
    })
  },

  setOrderForm: (partial) => {
    set({ orderForm: { ...get().orderForm, ...partial } })
  },

  resetOrderForm: () => {
    set({ orderForm: { ...DEFAULT_ORDER_FORM } })
  },

  submitOrder: async () => {
    const form = get().orderForm

    // 套利合约校验：自动生成 instrumentID
    let submitForm = { ...form }
    if (form.orderPriceType === 'arbitrage') {
      const arbErr = validateArbitrage(form.arbitrageLeg1 ?? '', form.arbitrageLeg2 ?? '')
      if (arbErr) {
        toast.error(`报单失败：${arbErr}`)
        return false
      }
      // 自动生成 SP 格式的 instrumentID
      submitForm = {
        ...form,
        instrumentID: `SP ${form.arbitrageLeg1}&${form.arbitrageLeg2}`,
      }
    }

    // Client-side validation
    if (!submitForm.instrumentID) {
      toast.error('报单失败：请选择合约')
      return false
    }
    if (submitForm.orderPriceType === 'limit' && (!Number.isFinite(submitForm.limitPrice) || submitForm.limitPrice <= 0)) {
      toast.error('报单失败：请输入有效价格')
      return false
    }

    // 市价单保护价校验
    if (submitForm.orderPriceType === 'market' && (!submitForm.stopPrice || submitForm.stopPrice <= 0)) {
      toast.error('报单失败：市价指令必须填写保护价')
      return false
    }

    // 数量有效性校验
    if (!Number.isFinite(submitForm.volumeTotalOriginal) || submitForm.volumeTotalOriginal < 1) {
      toast.error('报单失败：请输入有效数量')
      return false
    }

    // 数量上限校验
    const contracts = useContractsStore.getState().contracts
    const contract = contracts.find(c => c.instrumentID === submitForm.instrumentID)
    const productClass = contract?.productClass ?? '1'
    const volumeErr = validateVolumeWithLimit(submitForm.volumeTotalOriginal, submitForm.orderPriceType, productClass)
    if (volumeErr) {
      toast.error(`报单失败：${volumeErr}`)
      return false
    }

    // 保护价涨跌停校验（市价单）
    if (submitForm.orderPriceType === 'market' && submitForm.stopPrice) {
      const snapshots = useMarketStore.getState().snapshots
      const snap = snapshots.get(submitForm.instrumentID)
      if (snap) {
        if (submitForm.stopPrice > snap.upperLimitPrice) {
          toast.error(`报单失败：保护价不能超过涨停价 ${snap.upperLimitPrice}`)
          return false
        }
        if (submitForm.stopPrice < snap.lowerLimitPrice) {
          toast.error(`报单失败：保护价不能低于跌停价 ${snap.lowerLimitPrice}`)
          return false
        }
      }
    }

    set({ isSubmitting: true })
    try {
      const result = await apiSubmitOrder(submitForm)
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

  submitStopOrder: async (triggerPriceType: 'limit' | 'market' = 'limit') => {
    const form = get().orderForm

    // Client-side validation
    if (!form.instrumentID) {
      toast.error('止损单失败：请选择合约')
      return false
    }
    if (!form.stopPrice || form.stopPrice <= 0) {
      toast.error('止损单失败：请输入有效止损价')
      return false
    }
    if (triggerPriceType === 'limit' && form.limitPrice <= 0) {
      toast.error('止损单失败：请输入有效委托价')
      return false
    }
    // 市价触发时，limitPrice 作为保护价
    if (triggerPriceType === 'market' && (!form.limitPrice || form.limitPrice <= 0)) {
      toast.error('止损单失败：市价触发需填写保护价')
      return false
    }

    // 前端字符串 → CTP 字符码
    const DIRECTION_MAP: Record<string, string> = { buy: '0', sell: '1' }
    const OFFSET_MAP: Record<string, string> = { open: '0', close: '1', close_today: '3' }

    set({ isSubmitting: true })
    try {
      const result = await apiSubmitStopOrder({
        instrumentID: form.instrumentID,
        exchangeID: form.exchangeID,
        direction: DIRECTION_MAP[form.direction] ?? '0',
        offsetFlag: OFFSET_MAP[form.combOffsetFlag] ?? '0',
        limitPrice: form.limitPrice,
        volume: form.volumeTotalOriginal,
        stopPrice: form.stopPrice,
        triggerPriceType: triggerPriceType === 'market' ? '1' : '2',
      })
      if (result.success) {
        toast.success(`止损单已提交 ${result.stopOrderID}`)
        set({ orderForm: { ...DEFAULT_ORDER_FORM }, isSubmitting: false })
        return true
      } else {
        toast.error(`止损单失败：${result.message || '未知错误'}`)
        set({ isSubmitting: false })
        return false
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`止损单失败：${message}`)
      set({ isSubmitting: false })
      return false
    }
  },

  cancelOrder: async (orderRef) => {
    try {
      const result = await apiCancelOrder(orderRef)
      if (result.success) {
        toast.success('撤单成功')
        return true
      } else {
        toast.error(`撤单失败：${result.message || '未知错误'}`)
        return false
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`撤单失败：${message}`)
      return false
    }
  },
}))
