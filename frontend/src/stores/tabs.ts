import { create } from 'zustand'

// --- 类型定义 ---

/** 标签页类型 */
export type TabType =
  | 'market'
  | 'favorites'
  | 'order'
  | 'kline'
  | 'options'
  | 'ipc-monitor'
  | 'settings'
  | 'query' // 新增：查询（全局账户查询，放大自 QueryPopup）

/** 所有标签页类型 */
export const TAB_TYPES: TabType[] = [
  'market',
  'favorites',
  'order',
  'kline',
  'options',
  'ipc-monitor',
  'settings',
  'query',
]

/** 固定标签页类型（始终存在，不可关闭） */
export const PINNED_TAB_TYPE: TabType = 'market'

/** 标签页数量上限 */
export const MAX_TABS = 15

/** 标签页实例 */
export interface Tab {
  id: string
  type: TabType
  title: string
  props: Record<string, unknown>
  closable: boolean
}

// --- 默认状态 ---

const DEFAULT_TAB: Tab = {
  id: 'tab-market',
  type: 'market',
  title: '📊 行情',
  props: {},
  closable: false,
}

interface TabStore {
  tabs: Tab[]
  activeTabId: string

  /** 打开标签页；相同 type+instrumentID 去重，超上限拒绝。返回 true 表示成功打开/激活 */
  openTab: (options: { type: TabType; title: string; props?: Record<string, unknown>; closable?: boolean }) => boolean

  /** 关闭标签页；固定标签不可关闭 */
  closeTab: (tabId: string) => void

  /** 切换活跃标签页 */
  setActiveTab: (tabId: string) => void

  /** 按 type + props 查找已打开的标签页 */
  getTabByType: (type: TabType, props?: Record<string, unknown>) => Tab | undefined
}

// --- 辅助函数 ---

/** 生成标签页 ID */
function generateTabId(type: TabType, props?: Record<string, unknown>): string {
  const suffix = props?.instrumentID ? `-${props.instrumentID}` : ''
  return `tab-${type}${suffix}`
}

// --- Store ---

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [DEFAULT_TAB],
  activeTabId: DEFAULT_TAB.id,

  openTab: ({ type, title, props = {}, closable = true }) => {
    const tabId = generateTabId(type, props)
    let result = false

    set((state) => {
      // 去重：相同 type + instrumentID 直接激活
      const existing = state.tabs.find((t) => t.id === tabId)
      if (existing) {
        result = true
        return { activeTabId: existing.id }
      }

      // 数量限制
      if (state.tabs.length >= MAX_TABS) {
        result = false
        return state
      }

      const newTab: Tab = {
        id: tabId,
        type,
        title,
        props,
        closable,
      }

      result = true
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      }
    })

    return result
  },

  closeTab: (tabId) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab || !tab.closable) return state

      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId

      // 关闭活跃标签页时激活相邻标签页
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.indexOf(tab)
        // 优先激活后一个，否则前一个
        const nextTab = newTabs[closedIndex] ?? newTabs[closedIndex - 1]
        newActiveId = nextTab?.id ?? DEFAULT_TAB.id
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      }
    })
  },

  setActiveTab: (tabId) => {
    set((state) => {
      const exists = state.tabs.some((t) => t.id === tabId)
      if (!exists) return state
      return { activeTabId: tabId }
    })
  },

  getTabByType: (type, props) => {
    const { tabs } = get()
    if (props) {
      const tabId = generateTabId(type, props)
      return tabs.find((t) => t.id === tabId)
    }
    return tabs.find((t) => t.type === type)
  },
}))
