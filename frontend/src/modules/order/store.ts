import { create } from 'zustand'

interface OrderStore {
  selectedInstrument: string | null
  setSelectedInstrument: (instrument: string | null) => void
}

export const useOrderStore = create<OrderStore>((set) => ({
  selectedInstrument: null,
  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
}))
