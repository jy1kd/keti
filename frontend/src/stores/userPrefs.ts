import { create } from 'zustand'
import type { HotKeyConfig, QuickTradeConfig } from '@/services/types'
import type { Collection } from './collections'

const STORAGE_KEY = 'simnow-user-prefs'

export const DEFAULT_HOT_KEYS: HotKeyConfig = {
  // 交易快捷键
  buy: 'b',
  sell: 's',
  cancel: 'c',
  reverse: '',
  lock: '',
  batchCancel: 'Escape',
  // 导航快捷键
  openOrder: '',
  openKline: '',
  openSettings: ',',
}

export const DEFAULT_QUICK_TRADE_CONFIG: QuickTradeConfig = {
  lock: {
    priceMode: 'counterparty',
    offsetTicks: 1,
    timeCondition: 'gfd',
  },
  reverse: {
    close: {
      priceMode: 'counterparty',
      offsetTicks: 1,
      timeCondition: 'gfd',
    },
    open: {
      priceMode: 'counterparty',
      offsetTicks: 1,
      timeCondition: 'gfd',
    },
    executionMode: 'serial',
  },
  confirmBeforeExecute: true,
}

interface UserPrefsStore {
  collections: Collection[]
  hotKeys: HotKeyConfig
  quickTradeConfig: QuickTradeConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  setQuickTradeConfig: (config: Partial<QuickTradeConfig>) => void
  setCollections: (collections: Collection[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useUserPrefsStore = create<UserPrefsStore>((set, get) => ({
  collections: [],
  hotKeys: { ...DEFAULT_HOT_KEYS },
  quickTradeConfig: { ...DEFAULT_QUICK_TRADE_CONFIG },

  setHotKey: (action, key) =>
    set((state) => ({ hotKeys: { ...state.hotKeys, [action]: key } })),
  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),
  setQuickTradeConfig: (config) =>
    set((state) => ({ quickTradeConfig: { ...state.quickTradeConfig, ...config } })),
  setCollections: (collections) => set({ collections }),

  saveToLocalStorage: () => {
    const { collections, hotKeys, quickTradeConfig } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collections, hotKeys, quickTradeConfig }))
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      let collections: Collection[] = Array.isArray(data.collections) ? data.collections : []
      // 迁移：旧版 selectedContracts（扁平收藏） → 默认收藏夹（仅当无 collections 时）
      const legacy = Array.isArray(data.selectedContracts) ? data.selectedContracts : []
      if (collections.length === 0 && legacy.length > 0) {
        collections = [{ id: 'coll-default', name: '默认收藏夹', instrumentIDs: legacy }]
      }
      set({
        collections,
        hotKeys: data.hotKeys ?? { ...DEFAULT_HOT_KEYS },
        quickTradeConfig: data.quickTradeConfig ?? { ...DEFAULT_QUICK_TRADE_CONFIG },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
