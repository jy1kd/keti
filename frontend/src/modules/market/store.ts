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
  appendKline: (instrument: string, candle: KLineData) => void
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
  appendKline: (instrument, candle) =>
    set((state) => {
      const next = new Map(state.klineData)
      const existing = next.get(instrument)
      if (!existing || existing.length === 0) {
        next.set(instrument, [candle])
        return { klineData: next }
      }

      const last = existing[existing.length - 1]
      let updated: typeof existing

      if (candle.timestamp === last.timestamp) {
        // 同一周期 → 更新最后一根蜡烛
        updated = [...existing]
        updated[updated.length - 1] = candle
      } else if (candle.timestamp > last.timestamp) {
        // 新周期 → 追加，保留最近200根
        updated = [...existing, candle].slice(-200)
      } else {
        // 旧数据 → 忽略（避免打乱顺序）
        return state
      }

      next.set(instrument, updated)
      return { klineData: next }
    }),
}))
