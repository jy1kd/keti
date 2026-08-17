import { create } from 'zustand'
import type { MarketFilter } from '@/modules/market/filter'
import { EMPTY_FILTER } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

type Page = 'futures' | 'options'

interface MarketFilterStore {
  futures: MarketFilter
  options: MarketFilter
  /** 期货页当前选中收藏夹 id；'' = 全部 */
  futuresCollectionId: string
  /** 期权页当前选中收藏夹 id；'' = 全部 */
  optionsCollectionId: string
  setExchanges: (page: Page, exchanges: string[]) => void
  setProducts: (page: Page, products: string[]) => void
  /** 一次 set 同时写入交易所+品种（单一 localStorage 写），ContractFilter onChange 用 */
  setFilter: (page: Page, filter: MarketFilter) => void
  /** 设置指定页的收藏夹过滤（持久化），与 setFilter 平行 */
  setCollectionId: (page: Page, collectionId: string) => void
  reset: (page: Page) => void
  load: () => void
}

/** 形状校验：合法筛选态必须为对象且 exchanges/products 均为数组；任一不满足 → 空筛选 */
function isValidFilter(v: unknown): v is MarketFilter {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as MarketFilter).exchanges) &&
    Array.isArray((v as MarketFilter).products)
  )
}

/** 收藏夹 id 校验：必须是字符串；非字符串视为 ''（不限）。 */
function isValidCollectionId(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export const useMarketFilterStore = create<MarketFilterStore>((set) => ({
  futures: EMPTY_FILTER,
  options: EMPTY_FILTER,
  futuresCollectionId: '',
  optionsCollectionId: '',
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
      next[page] = { exchanges: [...filter.exchanges], products: [...filter.products] }
      return next
    }),
  setCollectionId: (page, collectionId) =>
    set(() =>
      page === 'futures'
        ? { futuresCollectionId: collectionId }
        : { optionsCollectionId: collectionId },
    ),
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
        futuresCollectionId: isValidCollectionId(dataObj.futuresCollectionId),
        optionsCollectionId: isValidCollectionId(dataObj.optionsCollectionId),
      })
    } catch {
      /* 忽略损坏数据 */
    }
  },
}))

// 每次变更持久化（订阅式）
useMarketFilterStore.subscribe((state) => {
  const { futures, options, futuresCollectionId, optionsCollectionId } = state
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ futures, options, futuresCollectionId, optionsCollectionId }),
  )
})
