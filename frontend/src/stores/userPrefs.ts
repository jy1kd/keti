import { create } from 'zustand'
import type { HotKeyConfig, OrderTriggerConfig } from '@/services/types'
import type { Collection } from './collections'

const STORAGE_KEY = 'simnow-user-prefs'

export const DEFAULT_HOT_KEYS: HotKeyConfig = {
  openOrder: 'o',
  openKline: 'k',
  openSettings: ',',
  batchCancel: 'Escape',
}

export const DEFAULT_ORDER_TRIGGER: OrderTriggerConfig = {
  triggerMode: 'single',
  confirmBeforeOrder: true,
}

interface UserPrefsStore {
  collections: Collection[]
  hotKeys: HotKeyConfig
  orderTrigger: OrderTriggerConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  setOrderTrigger: (config: OrderTriggerConfig) => void
  setCollections: (collections: Collection[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useUserPrefsStore = create<UserPrefsStore>((set, get) => ({
  collections: [],
  hotKeys: { ...DEFAULT_HOT_KEYS },
  orderTrigger: { ...DEFAULT_ORDER_TRIGGER },

  setHotKey: (action, key) =>
    set((state) => ({ hotKeys: { ...state.hotKeys, [action]: key } })),
  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),
  setOrderTrigger: (config) => set({ orderTrigger: { ...config } }),
  setCollections: (collections) => set({ collections }),

  saveToLocalStorage: () => {
    const { collections, hotKeys, orderTrigger } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collections, hotKeys, orderTrigger }))
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
        orderTrigger: data.orderTrigger ?? { ...DEFAULT_ORDER_TRIGGER },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
