import { create } from 'zustand'

interface ConnectionStore {
  mdConnected: boolean
  tdConnected: boolean
  setMdConnected: (connected: boolean) => void
  setTdConnected: (connected: boolean) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  mdConnected: false,
  tdConnected: false,
  setMdConnected: (connected) => set({ mdConnected: connected }),
  setTdConnected: (connected) => set({ tdConnected: connected }),
}))
