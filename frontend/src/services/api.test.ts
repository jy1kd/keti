import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, API_BASE, getInstruments, subscribeMarket, getSnapshots, getKlineData, submitOrder, cancelOrder } from './api'

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
      timeCondition: '1',
      volumeCondition: '1',
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
