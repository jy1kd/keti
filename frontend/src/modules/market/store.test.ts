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
    // candle.volume 是 CTP 全天累计值（如 10600），新 bar 的 volume 应使用增量而非累计值
    const newCandle: KLineData = { timestamp: 2000, open: 103, high: 108, low: 101, close: 106, volume: 10600, openInterest: 1100 }
    useMarketStore.getState().appendKline('IF2608', newCandle, 600)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(2)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[1]).toEqual({ ...newCandle, volume: 600 })
  })

  it('appendKline updates last candle if timestamp matches', () => {
    const candles: KLineData[] = [
      { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
    ]
    useMarketStore.getState().setKlineData('IF2608', candles)
    const updated: KLineData = { timestamp: 1000, open: 100, high: 110, low: 96, close: 108, volume: 800, openInterest: 1050 }
    // deltaVolume=8 → 同周期内成交量累加增量
    useMarketStore.getState().appendKline('IF2608', updated, 8)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(1)
    // high/low 基于 close 动态计算（CTP high/low 是当天值，非周期值）
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].high).toBe(108)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].low).toBe(98)
    // volume = last.volume + deltaVolume
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0].volume).toBe(508)
  })

  it('appendKline creates new array if no existing data', () => {
    const candle: KLineData = { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 }
    // 首根 bar 的 volume 同样使用增量（默认 0），不使用 CTP 全天累计值
    useMarketStore.getState().appendKline('IF2608', candle)
    expect(useMarketStore.getState().klineData.get('IF2608')?.length).toBe(1)
    expect(useMarketStore.getState().klineData.get('IF2608')?.[0]).toEqual({ ...candle, volume: 0 })
  })
})

describe('MarketStore - currentPeriod', () => {
  beforeEach(() => {
    useMarketStore.setState({
      currentPeriod: '5m',
    })
  })

  it('has default period 5m', () => {
    expect(useMarketStore.getState().currentPeriod).toBe('5m')
  })

  it('setPeriod updates currentPeriod', () => {
    useMarketStore.getState().setPeriod('1m')
    expect(useMarketStore.getState().currentPeriod).toBe('1m')
  })

  it('setPeriod to 1h', () => {
    useMarketStore.getState().setPeriod('1h')
    expect(useMarketStore.getState().currentPeriod).toBe('1h')
  })
})

describe('MarketStore - lockedContracts', () => {
  beforeEach(() => {
    useMarketStore.setState({
      lockedContracts: new Map(),
      visibleInstrumentIDs: [],
    })
  })

  it('has empty lockedContracts by default', () => {
    expect(useMarketStore.getState().lockedContracts.size).toBe(0)
  })

  it('addLockedContract adds contract with count 1', () => {
    useMarketStore.getState().addLockedContract('IF2608')
    expect(useMarketStore.getState().lockedContracts.get('IF2608')).toBe(1)
  })

  it('addLockedContract increments count when called twice (reference counting)', () => {
    useMarketStore.getState().addLockedContract('IF2608')
    useMarketStore.getState().addLockedContract('IF2608')
    expect(useMarketStore.getState().lockedContracts.get('IF2608')).toBe(2)
    expect(useMarketStore.getState().lockedContracts.size).toBe(1)
  })

  it('removeLockedContract decrements count; key remains when count > 1', () => {
    useMarketStore.getState().addLockedContract('IF2608')
    useMarketStore.getState().addLockedContract('IF2608')
    useMarketStore.getState().removeLockedContract('IF2608')
    expect(useMarketStore.getState().lockedContracts.get('IF2608')).toBe(1)
  })

  it('removeLockedContract deletes key when count reaches 0', () => {
    useMarketStore.getState().addLockedContract('IF2608')
    useMarketStore.getState().removeLockedContract('IF2608')
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(false)
    expect(useMarketStore.getState().lockedContracts.size).toBe(0)
  })

  it('removeLockedContract on missing key is safe', () => {
    useMarketStore.getState().removeLockedContract('IF2608')
    expect(useMarketStore.getState().lockedContracts.size).toBe(0)
  })

  it('setVisibleInstrumentIDs updates visible instrument IDs', () => {
    useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508'])
    expect(useMarketStore.getState().visibleInstrumentIDs).toEqual(['IF2608', 'au2508'])
  })
})

describe('MarketStore - selectedContracts', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedContracts: new Set(),
    })
  })

  it('has empty selectedContracts by default', () => {
    expect(useMarketStore.getState().selectedContracts.size).toBe(0)
  })

  it('setSelectedContracts replaces the entire set', () => {
    useMarketStore.getState().setSelectedContracts(new Set(['IF2608', 'au2508']))
    expect(useMarketStore.getState().selectedContracts.size).toBe(2)
    expect(useMarketStore.getState().selectedContracts.has('IF2608')).toBe(true)
    expect(useMarketStore.getState().selectedContracts.has('au2508')).toBe(true)
  })

  it('clearSelection clears all selected contracts', () => {
    useMarketStore.getState().setSelectedContracts(new Set(['IF2608', 'au2508']))
    useMarketStore.getState().clearSelection()
    expect(useMarketStore.getState().selectedContracts.size).toBe(0)
  })

  it('selectAll selects all provided contract IDs', () => {
    useMarketStore.getState().selectAll(['IF2608', 'au2508', 'ag2508'])
    expect(useMarketStore.getState().selectedContracts.size).toBe(3)
    expect(useMarketStore.getState().selectedContracts.has('IF2608')).toBe(true)
    expect(useMarketStore.getState().selectedContracts.has('au2508')).toBe(true)
    expect(useMarketStore.getState().selectedContracts.has('ag2508')).toBe(true)
  })
})

describe('MarketStore - scrollEndSeq', () => {
  beforeEach(() => {
    useMarketStore.setState({
      scrollEndSeq: 0,
    })
  })

  it('markScrollEnd 递增滚动松手信号', () => {
    expect(useMarketStore.getState().scrollEndSeq).toBe(0)
    useMarketStore.getState().markScrollEnd()
    expect(useMarketStore.getState().scrollEndSeq).toBe(1)
    useMarketStore.getState().markScrollEnd()
    expect(useMarketStore.getState().scrollEndSeq).toBe(2)
  })
})

describe('MarketStore - forceResubscribeSeq', () => {
  beforeEach(() => {
    useMarketStore.setState({ forceResubscribeSeq: 0 })
  })

  it('markForceResubscribe 递增强制重订阅信号', () => {
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
    useMarketStore.getState().markForceResubscribe()
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(1)
    useMarketStore.getState().markForceResubscribe()
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(2)
  })
})

