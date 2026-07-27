import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, API_BASE, getInstruments, subscribeMarket, getSnapshots, getKlineData, submitOrder, cancelOrder, refreshInstruments, cancelAllOrders, reversePosition, lockPosition, getPositions, getOrders, getOptionChains, getVolatility } from './api'

describe('api (Axios 实例)', () => {
  it('API_BASE 有值', () => {
    expect(API_BASE).toBeTruthy()
  })

  it('api 实例存在且为 Axios 实例', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('api.defaults.baseURL 已配置', () => {
    expect(api.defaults.baseURL).toBeTruthy()
  })

  it('api.defaults.timeout 已配置', () => {
    expect(api.defaults.timeout).toBe(10000)
  })

  it('api.defaults.headers 包含 Content-Type: application/json', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})

describe('getInstruments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('调用 GET /api/market/instruments 并返回合约列表', async () => {
    const mockData = {
      instruments: [{ instrumentID: 'IF2608', instrumentName: '沪深300' }],
      count: 1,
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getInstruments()
    expect(api.get).toHaveBeenCalledWith('/api/market/instruments', { params: undefined })
    expect(result).toEqual(mockData)
  })

  it('支持 keyword 参数进行模糊搜索', async () => {
    const mockData = { instruments: [], count: 0 }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getInstruments('IF')
    expect(api.get).toHaveBeenCalledWith('/api/market/instruments', { params: { keyword: 'IF' } })
  })
})

describe('subscribeMarket', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('调用 POST /api/market/subscribe 并返回结果', async () => {
    const mockData = { success: true, added: ['IF2608'], alreadySubscribed: [] }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await subscribeMarket(['IF2608'])
    expect(api.post).toHaveBeenCalledWith('/api/market/subscribe', { instruments: ['IF2608'] })
    expect(result).toEqual(mockData)
  })
})

describe('getSnapshots', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('调用 GET /api/market/snapshots 并返回行情快照', async () => {
    const mockData = {
      snapshots: {
        IF2608: { instrumentID: 'IF2608', lastPrice: 4120.0 },
      },
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getSnapshots(['IF2608'])
    expect(api.get).toHaveBeenCalledWith('/api/market/snapshots', { params: { instruments: 'IF2608' } })
    expect(result).toEqual(mockData)
  })

  it('多个合约用逗号分隔', async () => {
    const mockData = { snapshots: {} }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getSnapshots(['IF2608', 'IF2609'])
    expect(api.get).toHaveBeenCalledWith('/api/market/snapshots', { params: { instruments: 'IF2608,IF2609' } })
  })

  it('不传参数时获取全部快照', async () => {
    const mockData = { snapshots: {} }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getSnapshots()
    expect(api.get).toHaveBeenCalledWith('/api/market/snapshots', { params: undefined })
  })
})

describe('getKlineData', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('调用 GET /api/market/kline 并返回K线数据', async () => {
    const mockData = {
      instrumentID: 'IF2608',
      period: '5m',
      bars: [
        { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
      ],
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getKlineData('IF2608', '5m', 100)
    expect(api.get).toHaveBeenCalledWith('/api/market/kline', { params: { instrument: 'IF2608', period: '5m', count: 100 } })
    expect(result).toEqual(mockData)
  })

  it('支持不同周期参数', async () => {
    const mockData = { instrumentID: 'au2508', period: '1d', bars: [] }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getKlineData('au2508', '1d')
    expect(api.get).toHaveBeenCalledWith('/api/market/kline', { params: { instrument: 'au2508', period: '1d', count: undefined } })
  })
})

describe('submitOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/order/insert with converted CTP fields', async () => {
    const mockData = { success: true, orderRef: 'ORD-001' }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const order = {
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    }

    const result = await submitOrder(order)

    expect(api.post).toHaveBeenCalledWith('/api/order/insert', {
      instrumentID: 'IF2608',
      direction: '0',
      offsetFlag: '0',
      priceType: '2',
      timeCondition: '3',
      volumeCondition: '1',
      hedgeFlag: '1',
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    })
    expect(result).toEqual(mockData)
  })
})

describe('cancelOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/order/cancel with orderRef', async () => {
    const mockData = { success: true }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await cancelOrder('ORD-001')

    expect(api.post).toHaveBeenCalledWith('/api/order/cancel', { orderRef: 'ORD-001' })
    expect(result).toEqual(mockData)
  })
})

describe('refreshInstruments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/market/instruments/refresh and returns started status', async () => {
    const mockData = { status: 'started' }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await refreshInstruments()

    expect(api.post).toHaveBeenCalledWith('/api/market/instruments/refresh')
    expect(result).toEqual(mockData)
  })

  it('returns the status string when API responds', async () => {
    const mockData = { status: 'already_running' }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await refreshInstruments()

    expect(result.status).toBe('already_running')
  })
})

// ── PR-15: 快捷功能 API ────────────────────────────────────────────────

describe('cancelAllOrders', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/order/cancel_all and returns result', async () => {
    const mockData = { success: true, cancelled: 3, failed: 0, errors: [] }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await cancelAllOrders()

    expect(api.post).toHaveBeenCalledWith('/api/order/cancel_all')
    expect(result).toEqual(mockData)
  })

  it('returns partial failure info when some orders fail', async () => {
    const mockData = { success: true, cancelled: 1, failed: 2, errors: ['ORD-002: rejected', 'ORD-003: rejected'] }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await cancelAllOrders()

    expect(result.cancelled).toBe(1)
    expect(result.failed).toBe(2)
  })
})

describe('reversePosition', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/order/reverse with instrumentID', async () => {
    const mockData = { success: true, message: 'Position reversed' }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await reversePosition('IF2608')

    expect(api.post).toHaveBeenCalledWith('/api/order/reverse', { instrumentID: 'IF2608' })
    expect(result).toEqual(mockData)
  })

  it('handles 501 not implemented gracefully', async () => {
    const error = Object.assign(new Error('Request failed with status code 501'), {
      response: { status: 501, data: { detail: 'Not implemented' } },
    })
    vi.spyOn(api, 'post').mockRejectedValue(error)

    await expect(reversePosition('IF2608')).rejects.toThrow()
  })
})

describe('lockPosition', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /api/order/lock with instrumentID', async () => {
    const mockData = { success: true, message: 'Position locked' }
    vi.spyOn(api, 'post').mockResolvedValue({ data: mockData })

    const result = await lockPosition('IF2608')

    expect(api.post).toHaveBeenCalledWith('/api/order/lock', { instrumentID: 'IF2608' })
    expect(result).toEqual(mockData)
  })

  it('handles 501 not implemented gracefully', async () => {
    const error = Object.assign(new Error('Request failed with status code 501'), {
      response: { status: 501, data: { detail: 'Not implemented' } },
    })
    vi.spyOn(api, 'post').mockRejectedValue(error)

    await expect(lockPosition('IF2608')).rejects.toThrow()
  })
})

describe('getPositions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/query/positions and returns position list', async () => {
    const mockData = {
      positions: [
        { instrumentID: 'IF2608', posiDirection: 'long', position: 2, positionProfit: 1200.0 },
      ],
      count: 1,
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getPositions()

    expect(api.get).toHaveBeenCalledWith('/api/query/positions')
    expect(result).toEqual(mockData)
  })

  it('returns empty positions array when no positions', async () => {
    const mockData = { positions: [], count: 0 }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getPositions()

    expect(result.positions).toEqual([])
    expect(result.count).toBe(0)
  })
})

describe('getOrders', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/query/orders and returns order list', async () => {
    const mockData = {
      orders: [
        { orderRef: 'ORD-001', instrumentID: 'IF2608', direction: 'buy', orderStatus: 'no_traded' },
      ],
      count: 1,
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getOrders()

    expect(api.get).toHaveBeenCalledWith('/api/query/orders')
    expect(result).toEqual(mockData)
  })

  it('returns empty orders array when no orders', async () => {
    const mockData = { orders: [], count: 0 }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getOrders()

    expect(result.orders).toEqual([])
    expect(result.count).toBe(0)
  })
})

// ── PR-14: 期权 API ────────────────────────────────────────────────────

describe('getOptionChains', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/market/option_chain and returns chains', async () => {
    const mockData = {
      chains: [
        {
          underlying: 'IF2608',
          expireDate: '20260815',
          calls: [{ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5 }],
          puts: [{ instrumentID: 'IF2608-P-4800', strikePrice: 4800, lastPrice: 130.0 }],
        },
      ],
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getOptionChains('IF2608')

    expect(api.get).toHaveBeenCalledWith('/api/market/option_chain', {
      params: { underlying: 'IF2608', expire_date: undefined },
    })
    expect(result).toEqual(mockData)
  })

  it('supports expire_date filter', async () => {
    const mockData = { chains: [] }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getOptionChains('IF2608', '20260815')

    expect(api.get).toHaveBeenCalledWith('/api/market/option_chain', {
      params: { underlying: 'IF2608', expire_date: '20260815' },
    })
  })

  it('fetches all chains when no params provided', async () => {
    const mockData = { chains: [] }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getOptionChains()

    expect(api.get).toHaveBeenCalledWith('/api/market/option_chain', {
      params: { underlying: undefined, expire_date: undefined },
    })
  })
})

describe('getVolatility', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/market/volatility with underlying filter', async () => {
    const mockData = {
      volatility: [
        { instrumentID: 'IF2608-C-4800', impliedVolatility: 0.25, underlyingPrice: 4800, strikePrice: 4800, timeToExpiry: 0.06, riskFreeRate: 0.03, optionType: '1' },
      ],
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    const result = await getVolatility('IF2608')

    expect(api.get).toHaveBeenCalledWith('/api/market/volatility', {
      params: { underlying: 'IF2608' },
    })
    expect(result).toEqual(mockData)
  })

  it('fetches all volatility data when no underlying provided', async () => {
    const mockData = { volatility: [] }
    vi.spyOn(api, 'get').mockResolvedValue({ data: mockData })

    await getVolatility()

    expect(api.get).toHaveBeenCalledWith('/api/market/volatility', {
      params: undefined,
    })
  })
})
