import { create } from 'zustand'

interface ConnectionStore {
  md_connected: boolean
  td_connected: boolean
  setMdConnected: (connected: boolean) => void
  setTdConnected: (connected: boolean) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  md_connected: false,
  td_connected: false,
  setMdConnected: (connected) => set({ md_connected: connected }),
  setTdConnected: (connected) => set({ td_connected: connected }),
}))
