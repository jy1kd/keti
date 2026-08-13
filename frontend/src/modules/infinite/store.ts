import { create } from 'zustand'
import { submitOrder as apiSubmitOrder } from '@/services/api'
import { toast } from '@/components/Toast'
import { useContractsStore } from '@/stores/contracts'
import { validateVolumeWithLimit } from '@/utils/validators'
import type { OrderRequestForm } from '@/utils/orderMapping'

export interface InfiniteOrderIntent {
  direction: 'buy' | 'sell'
  price: number
  volume: number
  combOffsetFlag: 'open' | 'close' | 'close_today'
  timeCondition: 'gfd' | 'fok' | 'fak'
}

interface InfiniteOrderState {
  instrumentID: string
  exchangeID: string
  combOffsetFlag: 'open' | 'close' | 'close_today'
  combHedgeFlag: 'speculation' | 'arbitrage' | 'hedge'
  timeCondition: 'gfd' | 'fok' | 'fak'
  volumeTotalOriginal: number
  volumeStep: number
  lastSubmitError: string | null
  setInstrument: (instrumentID: string, exchangeID?: string) => void
  setField: (patch: Partial<Pick<InfiniteOrderState,
    'combOffsetFlag' | 'combHedgeFlag' | 'timeCondition' | 'volumeTotalOriginal' | 'volumeStep'>>) => void
  submitOrder: (intent: InfiniteOrderIntent) => Promise<boolean>
}

export const useInfiniteOrderStore = create<InfiniteOrderState>((set, get) => ({
  instrumentID: '',
  exchangeID: 'CFFEX',
  combOffsetFlag: 'open',
  combHedgeFlag: 'speculation',
  timeCondition: 'gfd',
  volumeTotalOriginal: 1,
  volumeStep: 1,
  lastSubmitError: null,

  setInstrument: (instrumentID, exchangeID) => {
    let exch = exchangeID ?? 'CFFEX'
    if (!exchangeID) {
      const contract = useContractsStore.getState().contracts.find((c) => c.instrumentID === instrumentID)
      if (contract?.exchangeID) exch = contract.exchangeID
    }
    set({ instrumentID, exchangeID: exch })
  },

  setField: (patch) => set(patch),

  submitOrder: async (intent) => {
    const fail = (msg: string): false => {
      set({ lastSubmitError: msg })
      toast.error(`报单失败：${msg}`)
      return false
    }
    set({ lastSubmitError: null })

    const { instrumentID, exchangeID, combHedgeFlag } = get()
    if (!instrumentID) return fail('请选择合约')
    if (!Number.isFinite(intent.price) || intent.price <= 0) return fail('请输入有效价格')

    const contracts = useContractsStore.getState().contracts
    const productClass = contracts.find((c) => c.instrumentID === instrumentID)?.productClass ?? '1'
    const volErr = validateVolumeWithLimit(intent.volume, 'limit', productClass)
    if (volErr) return fail(volErr)

    const form: OrderRequestForm = {
      instrumentID,
      exchangeID,
      direction: intent.direction,
      combOffsetFlag: intent.combOffsetFlag,
      combHedgeFlag,
      orderPriceType: 'limit',
      timeCondition: intent.timeCondition,
      limitPrice: intent.price,
      volumeTotalOriginal: intent.volume,
      productClass,
    }

    try {
      const result = await apiSubmitOrder(form)
      if (result.success) {
        toast.success(`报单成功 ${result.orderRef}`)
        return true
      }
      return fail(result.message || result.error || '未知错误')
    } catch (e) {
      return fail(e instanceof Error ? e.message : '未知错误')
    }
  },
}))
