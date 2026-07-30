import { create } from 'zustand'
import type { HotKeyConfig, QuickTradeConfig } from '@/services/types'

const STORAGE_KEY = 'simnow-user-prefs'

export const DEFAULT_HOT_KEYS: HotKeyConfig = {
  buy: 'b',
  sell: 's',
  cancel: 'c',
  reverse: '',
  lock: '',
  batchCancel: 'Escape',
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
  selectedContracts: string[]
  /** User manually subscribed preset contracts (persisted, separate from selectedContracts) */
  manualPresetIds: string[]
  hotKeys: HotKeyConfig
  quickTradeConfig: QuickTradeConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  setQuickTradeConfig: (config: Partial<QuickTradeConfig>) => void
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
  quickTradeConfig: { ...DEFAULT_QUICK_TRADE_CONFIG },

  setHotKey: (action, key) =>
    set((state) => ({
      hotKeys: { ...state.hotKeys, [action]: key },
    })),

  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),

  setQuickTradeConfig: (config) =>
    set((state) => ({
      quickTradeConfig: { ...state.quickTradeConfig, ...config },
    })),

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
    const { selectedContracts, manualPresetIds, hotKeys, quickTradeConfig } = get()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts, manualPresetIds, hotKeys, quickTradeConfig })
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
        quickTradeConfig: data.quickTradeConfig ?? { ...DEFAULT_QUICK_TRADE_CONFIG },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
