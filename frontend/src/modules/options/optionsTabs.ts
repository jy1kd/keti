import type { ContractInfo } from '@/services/types'

/** 期权页筛选 Tab 的系列（= 该品种下的具体标底合约，如 FG609/FG610），空数组 = 全部系列 */
export interface OptionsTab {
  product: string
  series: string[]
}

/**
 * 期权页筛选状态（交易所 → 品种 Tab 条 → 每 tab 的系列多选）。
 * 语义：表格只展示「激活 tab」的品种合约（activeIndex 指向谁过滤谁）；
 * 无 tab 时 = 不限（展示全量期权）；exchange 仅用于驱动品种选择，本身不过滤表格。
 */
export interface OptionsTabsState {
  /** 当前选中交易所（'' = 未选，此时品种面板不可用） */
  exchange: string
  tabs: OptionsTab[]
  /** 激活 tab 下标；越界时按最后一个 tab 兜底（见 filterByOptionsTabs） */
  activeIndex: number
}

export const EMPTY_OPTIONS_TABS: OptionsTabsState = { exchange: '', tabs: [], activeIndex: 0 }

/** 追加一个品种 tab 并激活之；重复品种不重复添加，仅激活已存在的 tab */
export function addOptionsTab(state: OptionsTabsState, product: string): OptionsTabsState {
  const existing = state.tabs.findIndex((t) => t.product === product)
  if (existing >= 0) return { ...state, activeIndex: existing }
  return {
    ...state,
    tabs: [...state.tabs, { product, series: [] }],
    activeIndex: state.tabs.length,
  }
}

/** 移除指定位置的 tab；移除激活 tab 时回落到前一个，空后 activeIndex=0（exchange 保留） */
export function removeOptionsTab(state: OptionsTabsState, index: number): OptionsTabsState {
  if (index < 0 || index >= state.tabs.length) return state
  const tabs = state.tabs.filter((_, i) => i !== index)
  let activeIndex = state.activeIndex
  if (tabs.length === 0) {
    activeIndex = 0
  } else if (index < activeIndex) {
    activeIndex -= 1
  } else if (index === activeIndex) {
    activeIndex = Math.min(activeIndex, tabs.length - 1)
  }
  return { ...state, tabs, activeIndex }
}

/** 切换激活 tab；越界不改动 */
export function setActiveOptionsTab(state: OptionsTabsState, index: number): OptionsTabsState {
  if (index < 0 || index >= state.tabs.length) return state
  return { ...state, activeIndex: index }
}

/** 更新指定 tab 的系列多选（只动该 tab，不影响其它 tab 与激活态） */
export function setOptionsTabSeries(state: OptionsTabsState, index: number, series: string[]): OptionsTabsState {
  if (index < 0 || index >= state.tabs.length) return state
  const tabs = state.tabs.map((t, i) => (i === index ? { ...t, series: [...series] } : t))
  return { ...state, tabs }
}

/** 清空交易所与全部 tab（回到不限状态） */
export function clearOptionsTabs(_state: OptionsTabsState): OptionsTabsState {
  return { ...EMPTY_OPTIONS_TABS }
}

/** 激活 tab（activeIndex 越界时兜底为最后一个 tab） */
export function activeOptionsTab(state: OptionsTabsState): OptionsTab | null {
  if (state.tabs.length === 0) return null
  const index = Math.min(Math.max(state.activeIndex, 0), state.tabs.length - 1)
  return state.tabs[index] ?? null
}

/**
 * 期权页数据管道第一级：按筛选 Tab 过滤。
 * - 无 tab → 返回全量（不限）
 * - 有激活 tab → 只保留该品种合约；series 非空时再收窄到选中系列（标底合约）
 */
export function filterByOptionsTabs(
  contracts: ContractInfo[],
  state: OptionsTabsState,
  getProduct: (c: ContractInfo) => string,
): ContractInfo[] {
  const active = activeOptionsTab(state)
  if (!active) return contracts
  const seriesSet = active.series.length ? new Set(active.series) : null
  return contracts.filter((c) => {
    if (getProduct(c) !== active.product) return false
    if (seriesSet && !seriesSet.has(c.underlyingInstrID ?? '')) return false
    return true
  })
}