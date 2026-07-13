import { create } from 'zustand'
import type { MarketSnapshot } from '@/services/types'
import { MOCK_SNAPSHOTS } from './mockData'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
}

/** 开发环境初始化 mock 数据 */
function initMockSnapshots(): Map<string, MarketSnapshot> {
  const map = new Map<string, MarketSnapshot>()
  for (const snap of MOCK_SNAPSHOTS) {
    map.set(snap.instrumentID, snap)
  }
  return map
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  snapshots: import.meta.env.DEV ? initMockSnapshots() : new Map(),
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
}))
