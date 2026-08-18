import { create } from 'zustand'
import type { MarketFilter } from '@/modules/market/filter'
import { EMPTY_FILTER } from '@/modules/market/filter'
import type { OptionsTabsState } from '@/modules/options/optionsTabs'
import { EMPTY_OPTIONS_TABS } from '@/modules/options/optionsTabs'

const STORAGE_KEY = 'simnow-market-filter'

type Page = 'futures' | 'options'

interface MarketFilterStore {
  futures: MarketFilter
  options: MarketFilter
  /** 期货页当前选中收藏夹 id；'' = 全部 */
  futuresCollectionId: string
  /** 期权页当前选中收藏夹 id；'' = 全部 */
  optionsCollectionId: string
  /**
   * 期权页筛选 Tab 态（重构后的交互：交易所 → 品种 Tab 条 → 每 tab 系列多选）。
   * 取代旧 options: MarketFilter 在期权页的用法（旧字段保留以兼容旧 localStorage 数据，
   * 期权页不再读写它）。见 modules/options/optionsTabs.ts。
   */
  optionsTabs: OptionsTabsState
  setExchanges: (page: Page, exchanges: string[]) => void
  setProducts: (page: Page, products: string[]) => void
  /** 一次 set 同时写入交易所+品种（单一 localStorage 写），ContractFilter onChange 用 */
  setFilter: (page: Page, filter: MarketFilter) => void
  /** 设置指定页的收藏夹过滤（持久化），与 setFilter 平行 */
  setCollectionId: (page: Page, collectionId: string) => void
  /** 整体写入期权页筛选 Tab 态（OptionsFilterBar onChange 用，单一 localStorage 写） */
  setOptionsTabs: (state: OptionsTabsState) => void
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

/** 收藏夹 id 校验：必须是字符串；非字符串视为 ''（不限）。 */
function isValidCollectionId(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** 期权页筛选 Tab 态校验：exchange/tabs/activeIndex 形状合法才恢复，否则回退默认 */
function isValidOptionsTabs(v: unknown): v is OptionsTabsState {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.exchange === 'string' &&
    Array.isArray(o.tabs) &&
    o.tabs.every(
      (t) =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as Record<string, unknown>).product === 'string' &&
        Array.isArray((t as Record<string, unknown>).series) &&
        ((t as Record<string, unknown>).series as unknown[]).every((s) => typeof s === 'string'),
    ) &&
    typeof o.activeIndex === 'number'
  )
}

export const useMarketFilterStore = create<MarketFilterStore>((set) => ({
  futures: EMPTY_FILTER,
  options: EMPTY_FILTER,
  futuresCollectionId: '',
  optionsCollectionId: '',
  optionsTabs: { ...EMPTY_OPTIONS_TABS },
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
  setCollectionId: (page, collectionId) =>
    set(() =>
      page === 'futures'
        ? { futuresCollectionId: collectionId }
        : { optionsCollectionId: collectionId },
    ),
  setOptionsTabs: (state) =>
    set(() => ({
      optionsTabs: {
        exchange: state.exchange,
        tabs: state.tabs.map((t) => ({ product: t.product, series: [...t.series] })),
        activeIndex: state.activeIndex,
      },
    })),
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
        optionsTabs: isValidOptionsTabs(dataObj.optionsTabs)
          ? {
              exchange: dataObj.optionsTabs.exchange,
              tabs: dataObj.optionsTabs.tabs.map((t) => ({ product: t.product, series: [...t.series] })),
              activeIndex: dataObj.optionsTabs.activeIndex,
            }
          : { ...EMPTY_OPTIONS_TABS },
      })
    } catch {
      /* 忽略损坏数据 */
    }
  },
}))

// 每次变更持久化（订阅式）
useMarketFilterStore.subscribe((state) => {
  const { futures, options, futuresCollectionId, optionsCollectionId, optionsTabs } = state
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ futures, options, futuresCollectionId, optionsCollectionId, optionsTabs }),
  )
})
