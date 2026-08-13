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
  | 'query' // 查询（全局账户查询）
  | 'infinite'

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
  'infinite',
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
  /** 固定标签：滚动区置左 + 关闭其他/关闭所有跳过。缺省 = 未固定 */
  pinned?: boolean
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

  /** 关闭除指定标签外的所有可关闭非固定标签；activeTabId 保持 */
  closeOthers: (tabId: string) => void
  /** 关闭所有可关闭非固定标签；activeTabId 指向剩余第一个 */
  closeAll: () => void
  /** 切换固定状态；closable:false 标签（行情/初始页）拒绝 */
  togglePin: (tabId: string) => void

  /** 更新标签页内容（K线页内搜索切换合约）：保持 id 稳定，同步 props 与 title。
   *  若目标合约已被其他标签打开，则激活该标签并关闭当前标签，避免重复。 */
  updateTab: (tabId: string, patch: { props?: Record<string, unknown>; title?: string }) => void

  /** 切换活跃标签页 */
  setActiveTab: (tabId: string) => void

  /** 按 type + props 查找已打开的标签页 */
  getTabByType: (type: TabType, props?: Record<string, unknown>) => Tab | undefined
}

// --- 辅助函数 ---

/** 生成标签页 ID */
export function generateTabId(type: TabType, props?: Record<string, unknown>): string {
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
      // 去重：优先按 id（type+instrumentID）匹配；K线页内切换合约后 tab id 保持稳定，
      // 再按 type+instrumentID 内容匹配。命中时同步 props/title，自愈陈旧内容。
      const existing = state.tabs.find(
        (t) =>
          t.id === tabId ||
          (typeof props.instrumentID === 'string' &&
            t.type === type &&
            t.props.instrumentID === props.instrumentID),
      )
      if (existing) {
        result = true
        return {
          tabs: state.tabs.map((t) => (t.id === existing.id ? { ...t, props, title } : t)),
          activeTabId: existing.id,
        }
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
        pinned: false,
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

  closeOthers: (tabId) => {
    set((state) => {
      const target = state.tabs.find((t) => t.id === tabId)
      if (!target) return state
      // 保留：目标 + 不可关闭（closable:false）+ 固定标签
      const keep = state.tabs.filter((t) => !t.closable || t.pinned || t.id === tabId)
      if (keep.length === state.tabs.length) return state
      return { tabs: keep, activeTabId: tabId }
    })
  },

  closeAll: () => {
    set((state) => {
      const keep = state.tabs.filter((t) => !t.closable || t.pinned)
      if (keep.length === state.tabs.length) return state
      const activeSurvives = keep.some((t) => t.id === state.activeTabId)
      const newActiveId = activeSurvives ? state.activeTabId : (keep[0]?.id ?? state.activeTabId)
      return { tabs: keep, activeTabId: newActiveId }
    })
  },

  togglePin: (tabId) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab || !tab.closable) return state
      return {
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
      }
    })
  },

  updateTab: (tabId, patch) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      const props = patch.props ?? tab.props
      const title = patch.title ?? tab.title
      const instrumentID = props.instrumentID

      // 目标合约已有其他标签打开 → 激活它并关闭当前标签，避免两个标签显示同一合约
      if (typeof instrumentID === 'string') {
        const existing = state.tabs.find(
          (t) => t.id !== tabId && t.type === tab.type && t.props.instrumentID === instrumentID,
        )
        if (existing) {
          return {
            tabs: state.tabs.filter((t) => t.id !== tabId),
            activeTabId: state.activeTabId === tabId ? existing.id : state.activeTabId,
          }
        }
      }

      return {
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, props, title } : t)),
        activeTabId: state.activeTabId === tabId ? tabId : state.activeTabId,
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
