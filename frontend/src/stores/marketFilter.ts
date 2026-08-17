import { create } from 'zustand'
import type { MarketFilter } from '@/modules/market/filter'
import { EMPTY_FILTER } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

type Page = 'futures' | 'options'

interface MarketFilterStore {
  futures: MarketFilter
  options: MarketFilter
  setExchanges: (page: Page, exchanges: string[]) => void
  setProducts: (page: Page, products: string[]) => void
  /** 一次 set 同时写入交易所+品种（单一 localStorage 写），ContractFilter onChange 用 */
  setFilter: (page: Page, filter: MarketFilter) => void
  reset: (page: Page) => void
  load: () => void
}

/** 形状校验：合法筛选态必须为对象且 exchanges/products 均为数组；任一不满足 → 空筛选。
 *  underlyings 可选（旧版本数据无此字段），存在时也须为数组。 */
function isValidFilter(v: unknown): v is MarketFilter {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as MarketFilter).exchanges) &&
    Array.isArray((v as MarketFilter).products) &&
    ((v as MarketFilter).underlyings === undefined ||
      Array.isArray((v as MarketFilter).underlyings))
  )
}

export const useMarketFilterStore = create<MarketFilterStore>((set) => ({
  futures: EMPTY_FILTER,
  options: EMPTY_FILTER,
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
  setFilter: (page, filter) =>
    set((s) => {
      const next = { futures: s.futures, options: s.options }
      next[page] = {
        exchanges: [...filter.exchanges],
        products: [...filter.products],
        underlyings: filter.underlyings ? [...filter.underlyings] : [],
      }
      return next
    }),
  reset: (page) =>
    set((s) => {
      const next = { futures: s.futures, options: s.options }
      next[page] = EMPTY_FILTER
      return next
    }),
  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
      set({
        futures: isValidFilter(dataObj.futures) ? dataObj.futures : EMPTY_FILTER,
        options: isValidFilter(dataObj.options) ? dataObj.options : EMPTY_FILTER,
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
