import { create } from 'zustand'
import type { MarketSnapshot } from '@/services/types'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
  snapshots: Map<string, MarketSnapshot>
  updateSnapshot: (snapshot: MarketSnapshot) => void
  batchUpdate: (snapshots: MarketSnapshot[]) => void
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
}))
