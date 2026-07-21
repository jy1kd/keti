import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMarketStore } from './store'
import type { MarketSnapshot, KLineData } from '@/services/types'

// Mock api module
vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn(),
  getSnapshots: vi.fn(),
}))

import { subscribeMarket, getSnapshots } from '@/services/api'

describe('MarketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
    vi.mocked(subscribeMarket).mockReset()
    vi.mocked(getSnapshots).mockReset()
  })

  it('has null selectedInstrument by default', () => {
    expect(useMarketStore.getState().selectedInstrument).toBeNull()
  })

  it('sets selected instrument', () => {
    useMarketStore.getState().setSelectedInstrument('au2508')
    expect(useMarketStore.getState().selectedInstrument).toBe('au2508')
  })

  it('clears selected instrument', () => {
    useMarketStore.getState().setSelectedInstrument('au2508')
    useMarketStore.getState().setSelectedInstrument(null)
    expect(useMarketStore.getState().selectedInstrument).toBeNull()
  })

  it('has empty snapshots map by default', () => {
    expect(useMarketStore.getState().snapshots.size).toBe(0)
  })

  it('updates a single snapshot', () => {
    const snapshot = {
      instrumentID: 'au2508',
      lastPrice: 480.5,
      bidPrice1: 480.4,
      askPrice1: 480.6,
      volume: 1000,
      openInterest: 5000,
    } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snapshot)
    expect(useMarketStore.getState().snapshots.get('au2508')).toEqual(snapshot)
  })

  it('updates existing snapshot replaces it', () => {
    const snap1 = {
      instrumentID: 'au2508',
      lastPrice: 480.5,
      volume: 1000,
    } as MarketSnapshot

    const snap2 = {
      instrumentID: 'au2508',
      lastPrice: 481.0,
      volume: 1200,
    } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snap1)
    useMarketStore.getState().updateSnapshot(snap2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(481.0)
    expect(useMarketStore.getState().snapshots.get('au2508')?.volume).toBe(1200)
  })

  it('stores multiple instruments', () => {
    const snap1 = { instrumentID: 'au2508', lastPrice: 480.5 } as MarketSnapshot
    const snap2 = { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snap1)
    useMarketStore.getState().updateSnapshot(snap2)
    expect(useMarketStore.getState().snapshots.size).toBe(2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(480.5)
    expect(useMarketStore.getState().snapshots.get('ag2508')?.lastPrice).toBe(6500)
  })

  it('batchUpdate merges multiple snapshots at once', () => {
    const snaps = [
      { instrumentID: 'au2508', lastPrice: 480.5 } as MarketSnapshot,
      { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot,
      { instrumentID: 'cu2508', lastPrice: 72000 } as MarketSnapshot,
    ]

    useMarketStore.getState().batchUpdate(snaps)
    expect(useMarketStore.getState().snapshots.size).toBe(3)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(480.5)
    expect(useMarketStore.getState().snapshots.get('ag2508')?.lastPrice).toBe(6500)
    expect(useMarketStore.getState().snapshots.get('cu2508')?.lastPrice).toBe(72000)
  })

  it('batchUpdate updates existing snapshots', () => {
    useMarketStore.getState().updateSnapshot({
      instrumentID: 'au2508',
      lastPrice: 480.5,
    } as MarketSnapshot)

    useMarketStore.getState().batchUpdate([
      { instrumentID: 'au2508', lastPrice: 481.0 } as MarketSnapshot,
      { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot,
    ])

    expect(useMarketStore.getState().snapshots.size).toBe(2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(481.0)
  })
})

describe('MarketStore - subscribeInstruments', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
    vi.mocked(subscribeMarket).mockReset()
    vi.mocked(getSnapshots).mockReset()
  })

  it('subscribeInstruments 调用 API 订阅行情', async () => {
    vi.mocked(subscribeMarket).mockResolvedValue({
      success: true,
      added: ['IF2608'],
      alreadySubscribed: [],
    })

    await useMarketStore.getState().subscribeInstruments(['IF2608'])
    expect(subscribeMarket).toHaveBeenCalledWith(['IF2608'])
  })

  it('subscribeInstruments 订阅后不立即获取快照（依赖 WebSocket 推送）', async () => {
    vi.mocked(subscribeMarket).mockResolvedValue({
      success: true,
      added: ['IF2608'],
      alreadySubscribed: [],
    })

    await useMarketStore.getState().subscribeInstruments(['IF2608'])
    expect(subscribeMarket).toHaveBeenCalledWith(['IF2608'])
    // 不调用 getSnapshots — 数据通过 WebSocket market_data 消息自然填充
    expect(getSnapshots).not.toHaveBeenCalled()
  })
})

describe('MarketStore - klineData', () => {
  beforeEach(() => {
    useMarketStore.setState({
      klineData: new Map(),
    })
  })

  it('has empty klineData map by default', () => {
    expect(useMarketStore.getState().klineData.size).toBe(0)
  })

  it('setKlineData stores kline array for an instrument', () => {
    const candles: KLineData[] = [
      { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
      { timestamp: 2000, open: 103, high: 108, low: 101, close: 106, volume: 600, openInterest: 1100 },
    ]
    useMarketStore.getState().setKlineData('IF2608', candles)
    expect(useMarketStore.getState().klineData.get('IF2608')).toEqual(candles)
  })

  it('setKlineData replaces existing data for same instrument', () => {
    const candles1: KLineData[] = [
      { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
    ]
    const candles2: KLineData[] = [
      { timestamp: 2000, open: 103, high: 108, low: 101, close: 106, volume: 600, openInterest: 1100 },
    ]
    useMarketStore.getState().setKlineData('IF2608', candles1)
    useMarketStore.getState().setKlineData('IF2608', candles2)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(1)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].timestamp).toBe(2000)
  })

  it('appendKline adds a new candle to existing data', () => {
    const candles: KLineData[] = [
      { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
    ]
    useMarketStore.getState().setKlineData('IF2608', candles)
    const newCandle: KLineData = { timestamp: 2000, open: 103, high: 108, low: 101, close: 106, volume: 600, openInterest: 1100 }
    useMarketStore.getState().appendKline('IF2608', newCandle)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(2)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[1]).toEqual(newCandle)
  })

  it('appendKline updates last candle if timestamp matches', () => {
    const candles: KLineData[] = [
      { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
    ]
    useMarketStore.getState().setKlineData('IF2608', candles)
    const updated: KLineData = { timestamp: 1000, open: 100, high: 110, low: 96, close: 108, volume: 800, openInterest: 1050 }
    useMarketStore.getState().appendKline('IF2608', updated)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(1)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].high).toBe(110)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].volume).toBe(800)
  })

  it('appendKline creates new array if no existing data', () => {
    const candle: KLineData = { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 }
    useMarketStore.getState().appendKline('IF2608', candle)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(1)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0]).toEqual(candle)
  })
})

