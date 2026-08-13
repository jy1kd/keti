import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInfiniteOrderStore } from './store'
import { useOrderStore } from '../order/store'

vi.mock('@/services/api', () => ({
  submitOrder: vi.fn(),
}))
vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { submitOrder as apiSubmitOrder } from '@/services/api'

const intent = (overrides?: Partial<{ direction: 'buy' | 'sell'; price: number; volume: number; combOffsetFlag: 'open' | 'close' | 'close_today'; timeCondition: 'gfd' | 'fok' | 'fak' }>) => ({
  direction: 'buy' as const,
  price: 4696,
  volume: 1,
  combOffsetFlag: 'open' as const,
  timeCondition: 'gfd' as const,
  ...overrides,
})

describe('useInfiniteOrderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: '', exchangeID: 'CFFEX', lastSubmitError: null })
  })

  it('未选合约时 submitOrder 返回 false', async () => {
    const ok = await useInfiniteOrderStore.getState().submitOrder(intent())
    expect(ok).toBe(false)
    expect(apiSubmitOrder).not.toHaveBeenCalled()
  })

  it('有效参数调用 api submitOrder 并返回 true', async () => {
    vi.mocked(apiSubmitOrder).mockResolvedValue({ success: true, orderRef: 'R1' } as never)
    useInfiniteOrderStore.setState({ instrumentID: 'IF2608' })
    const ok = await useInfiniteOrderStore.getState().submitOrder(intent())
    expect(ok).toBe(true)
    expect(apiSubmitOrder).toHaveBeenCalledWith(expect.objectContaining({
      instrumentID: 'IF2608',
      direction: 'buy',
      limitPrice: 4696,
      volumeTotalOriginal: 1,
      orderPriceType: 'limit',
    }))
  })

  it('不读写 useOrderStore，实现状态隔离', () => {
    const before = useOrderStore.getState().orderForm
    useInfiniteOrderStore.getState().setInstrument('IF2608')
    useInfiniteOrderStore.getState().setField({ volumeTotalOriginal: 7 })
    expect(useOrderStore.getState().orderForm).toEqual(before)
  })
})
