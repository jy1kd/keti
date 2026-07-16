import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import type { MarketSnapshot } from '@/services/types'

// Mock api module
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn(),
  subscribeMarket: vi.fn(),
  getSnapshots: vi.fn(),
}))

import { getInstruments, subscribeMarket, getSnapshots } from '@/services/api'

describe('MarketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
    vi.mocked(getInstruments).mockReset()
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

describe('MarketStore - fetchInstruments', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
    useContractsStore.setState({ contracts: [] })
    vi.mocked(getInstruments).mockReset()
    vi.mocked(subscribeMarket).mockReset()
    vi.mocked(getSnapshots).mockReset()
  })

  it('fetchInstruments 调用 API 获取合约列表并同步到 contracts store', async () => {
    const mockInstruments = [
      { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260821', isTrading: true },
      { instrumentID: 'IF2609', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260919', isTrading: true },
    ]
    vi.mocked(getInstruments).mockResolvedValue({
      instruments: mockInstruments,
      count: 2,
    })

    await useMarketStore.getState().fetchInstruments()
    expect(getInstruments).toHaveBeenCalled()
    // 验证同步到 contracts store
    expect(useContractsStore.getState().contracts).toEqual(mockInstruments)
  })

  it('fetchInstruments 失败时不影响现有状态', async () => {
    vi.mocked(getInstruments).mockRejectedValue(new Error('network error'))

    await useMarketStore.getState().fetchInstruments()
    // snapshots 不受影响
    expect(useMarketStore.getState().snapshots.size).toBe(0)
  })
})

describe('MarketStore - subscribeInstruments', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
    vi.mocked(getInstruments).mockReset()
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
