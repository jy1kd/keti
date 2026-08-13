import { create } from 'zustand'
import type { MarketFilter } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

type Page = 'futures' | 'options'

interface MarketFilterStore {
  futures: MarketFilter
  options: MarketFilter
  setExchanges: (page: Page, exchanges: string[]) => void
  setProducts: (page: Page, products: string[]) => void
  reset: (page: Page) => void
  load: () => void
}

export const useMarketFilterStore = create<MarketFilterStore>((set) => ({
  futures: { exchanges: [], products: [] },
  options: { exchanges: [], products: [] },
  setExchanges: (page, exchanges) =>
    set((s) => {
      const next = { futures: s.futures, options: s.options }
      next[page] = { ...s[page], exchanges }
      return next
    }),
  setProducts: (page, products) =>
    set((s) => {
      const next = { futures: s.futures, options: s.options }
      next[page] = { ...s[page], products }
      return next
    }),
  reset: (page) =>
    set((s) => {
      const next = { futures: s.futures, options: s.options }
      next[page] = { exchanges: [], products: [] }
      return next
    }),
  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      set({
        futures: data.futures ?? { exchanges: [], products: [] },
        options: data.options ?? { exchanges: [], products: [] },
      })
    } catch {
      /* 忽略损坏数据 */
    }
  },
}))

// 每次变更持久化（订阅式）
useMarketFilterStore.subscribe((state) => {
  const { futures, options } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ futures, options }))
})
