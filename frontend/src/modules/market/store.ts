import { create } from 'zustand'

interface MarketStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
}))
