import { create } from 'zustand'
import type { MarketSnapshot, KLineData } from '@/services/types'
import { subscribeMarket } from '@/services/api'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
  subscribeInstruments: (instruments: string[]) => Promise<void>
  klineData: Map<string, KLineData[]>
  setKlineData: (instrument: string, data: KLineData[]) => void
  appendKline: (instrument: string, candle: KLineData, deltaVolume?: number) => void
  currentPeriod: string
  setPeriod: (period: string) => void
  /** 当前可见的合约 ID 列表 */
  visibleInstrumentIDs: string[]
  setVisibleInstrumentIDs: (ids: string[]) => void
  /** 锁定的合约（打开标签的合约，永不退订） */
  lockedContracts: Set<string>
  addLockedContract: (instrumentID: string) => void
  removeLockedContract: (instrumentID: string) => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  snapshots: new Map(),
  updateSnapshot: (snapshot) =>
    set((state) => {
      const next = new Map(state.snapshots)
      next.set(snapshot.instrumentID, snapshot)
      return { snapshots: next }
    }),
  batchUpdate: (updates) =>
    set((state) => {
      const next = new Map(state.snapshots)
      for (const snap of updates) {
        next.set(snap.instrumentID, snap)
      }
      return { snapshots: next }
    }),
  subscribeInstruments: async (instruments: string[]) => {
    try {
      await subscribeMarket(instruments)
      // 不立即 getSnapshots —— CTP 回调尚未推送数据，缓存为空。
      // 数据将通过 WebSocket market_data 消息自然填充。
    } catch (error) {
      console.warn('[MarketStore] subscribeInstruments failed:', error)
    }
  },
  klineData: new Map(),
  setKlineData: (instrument, data) =>
    set((state) => {
      const next = new Map(state.klineData)
      // 按时间戳排序，确保蜡烛顺序正确
      const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
      next.set(instrument, sorted)
      return { klineData: next }
    }),
  appendKline: (instrument, candle, deltaVolume = 0) =>
    set((state) => {
      const next = new Map(state.klineData)
      const existing = next.get(instrument)
      // candle.volume 是 CTP 全天累计值，不能直接用作新 bar 的量；
      // 新 bar 的成交量一律使用增量 deltaVolume（首个 tick 无历史累计，增量为 0）
      if (!existing || existing.length === 0) {
        next.set(instrument, [{ ...candle, volume: deltaVolume }])
        return { klineData: next }
      }

      const last = existing[existing.length - 1]
      let updated: typeof existing

      if (candle.timestamp === last.timestamp) {
        // 同一周期 → 更新最后一根蜡烛，成交量累加增量
        updated = [...existing]
        updated[updated.length - 1] = {
          ...last,
          high: Math.max(last.high, candle.close),
          low: Math.min(last.low, candle.close),
          close: candle.close,
          volume: last.volume + deltaVolume,
          openInterest: candle.openInterest,
        }
      } else if (candle.timestamp > last.timestamp) {
        // 新周期 → 追加（volume 用增量，非全天累计值），保留最近200根
        updated = [...existing, { ...candle, volume: deltaVolume }].slice(-200)
      } else {
        // 旧数据 → 忽略（避免打乱顺序）
        return state
      }

      next.set(instrument, updated)
      return { klineData: next }
    }),
  currentPeriod: '5m',
  setPeriod: (period) => set({ currentPeriod: period }),
  visibleInstrumentIDs: [],
  setVisibleInstrumentIDs: (ids) => set({ visibleInstrumentIDs: ids }),
  lockedContracts: new Set(),
  addLockedContract: (instrumentID) =>
    set((state) => {
      const next = new Set(state.lockedContracts)
      next.add(instrumentID)
      return { lockedContracts: next }
    }),
  removeLockedContract: (instrumentID) =>
    set((state) => {
      const next = new Set(state.lockedContracts)
      next.delete(instrumentID)
      return { lockedContracts: next }
    }),
}))
