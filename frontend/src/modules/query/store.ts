import { create } from 'zustand'

type QueryTab = 'orders' | 'trades' | 'positions' | 'account'

interface QueryStore {
  activeTab: QueryTab
  setActiveTab: (tab: QueryTab) => void
}

export const useQueryStore = create<QueryStore>((set) => ({
  activeTab: 'orders',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
