import { create } from 'zustand'
import type { HotKeyConfig } from '@/services/types'

const STORAGE_KEY = 'simnow-user-prefs'

export const DEFAULT_HOT_KEYS: HotKeyConfig = {
  buy: 'b',
  sell: 's',
  cancel: 'c',
}

interface UserPrefsStore {
  selectedContracts: string[]
  /** User manually subscribed preset contracts (persisted, separate from selectedContracts) */
  manualPresetIds: string[]
  hotKeys: HotKeyConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  addSelectedContract: (instrumentId: string) => void
  removeSelectedContract: (instrumentId: string) => void
  addManualPreset: (instrumentId: string) => void
  removeManualPreset: (instrumentId: string) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useUserPrefsStore = create<UserPrefsStore>((set, get) => ({
  selectedContracts: [],
  manualPresetIds: [],
  hotKeys: { ...DEFAULT_HOT_KEYS },

  setHotKey: (action, key) =>
    set((state) => ({
      hotKeys: { ...state.hotKeys, [action]: key },
    })),

  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),

  addSelectedContract: (instrumentId) =>
    set((state) => {
      if (state.selectedContracts.includes(instrumentId)) return state
      return { selectedContracts: [...state.selectedContracts, instrumentId] }
    }),

  removeSelectedContract: (instrumentId) =>
    set((state) => ({
      selectedContracts: state.selectedContracts.filter((id) => id !== instrumentId),
    })),

  addManualPreset: (instrumentId) =>
    set((state) => {
      if (state.manualPresetIds.includes(instrumentId)) return state
      return { manualPresetIds: [...state.manualPresetIds, instrumentId] }
    }),

  removeManualPreset: (instrumentId) =>
    set((state) => ({
      manualPresetIds: state.manualPresetIds.filter((id) => id !== instrumentId),
    })),

  saveToLocalStorage: () => {
    const { selectedContracts, manualPresetIds, hotKeys } = get()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts, manualPresetIds, hotKeys })
    )
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      set({
        selectedContracts: data.selectedContracts ?? [],
        manualPresetIds: data.manualPresetIds ?? [],
        hotKeys: data.hotKeys ?? { ...DEFAULT_HOT_KEYS },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
