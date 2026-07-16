import { create } from 'zustand'
import type { MarketSnapshot, KLineData } from '@/services/types'
import { getInstruments, subscribeMarket } from '@/services/api'
import { useContractsStore } from '@/stores/contracts'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
  fetchInstruments: () => Promise<void>
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
  fetchInstruments: async () => {
    try {
      const data = await getInstruments()
      if (data?.instruments) {
        useContractsStore.getState().setContracts(data.instruments)
      }
    } catch (error) {
      console.warn('[MarketStore] fetchInstruments failed:', error)
    }
  },
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
      next.set(instrument, data)
      return { klineData: next }
    }),
  appendKline: (instrument, candle) =>
    set((state) => {
      const next = new Map(state.klineData)
      const existing = next.get(instrument)
      if (existing && existing.length > 0 && existing[existing.length - 1].timestamp === candle.timestamp) {
        // 同一时间戳 → 更新最后一根 K 线
        existing[existing.length - 1] = candle
        next.set(instrument, [...existing])
      } else {
        next.set(instrument, [...(existing ?? []), candle])
      }
      return { klineData: next }
    }),
}))
