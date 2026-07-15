import { create } from 'zustand'
import type { MarketSnapshot } from '@/services/types'
import { getInstruments, subscribeMarket, getSnapshots } from '@/services/api'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
  fetchInstruments: () => Promise<void>
  subscribeInstruments: (instruments: string[]) => Promise<void>
}

export const useMarketStore = create<MarketStore>((set, get) => ({
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
      await getInstruments()
    } catch {
      // 网络失败不影响现有状态
    }
  },
  subscribeInstruments: async (instruments: string[]) => {
    try {
      await subscribeMarket(instruments)
      // 订阅成功后获取初始快照
      const snapData = await getSnapshots(instruments)
      if (snapData?.snapshots) {
        const current = get().snapshots
        const next = new Map(current)
        for (const [id, snap] of Object.entries(snapData.snapshots)) {
          next.set(id, snap as MarketSnapshot)
        }
        set({ snapshots: next })
      }
    } catch {
      // 网络失败不影响现有状态
    }
  },
}))
