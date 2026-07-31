import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { useUserPrefsStore } from './userPrefs'
import {
  getInstruments,
  getInstrumentsByIds,
  subscribeMarket,
  unsubscribeMarket,
} from '@/services/api'

interface ContractsStore {
  /** 全量合约列表（从 API 加载） */
  contracts: ContractInfo[]
  /** 收藏合约列表（用户管理，自动订阅） */
  favorites: ContractInfo[]
  /** 是否已加载全量合约 */
  isLoaded: boolean
  /** 批量设置合约列表 */
  setContracts: (contracts: ContractInfo[]) => void
  /** 加载全量合约 */
  loadAllInstruments: () => Promise<void>
  /** 加载收藏合约并订阅 */
  loadFavoriteContracts: () => Promise<void>
  /** 添加收藏并订阅 */
  addToFavorites: (contract: ContractInfo) => Promise<void>
  /** 移除收藏并取消订阅 */
  removeFromFavorites: (instrumentId: string) => Promise<void>
  /** 从合约列表中移除 */
  removeContractById: (instrumentId: string) => void
}

export const useContractsStore = create<ContractsStore>((set, get) => ({
  contracts: [],
  favorites: [],
  isLoaded: false,

  setContracts: (contracts) => set({ contracts }),

  /** 从 API 加载全量合约 */
  loadAllInstruments: async () => {
    try {
      const result = await getInstruments()
      set({ contracts: result.instruments, isLoaded: true })
    } catch (err) {
      console.error('[contracts] Failed to load all instruments:', err)
    }
  },

  /** 从 localStorage 加载收藏合约并订阅 */
  loadFavoriteContracts: async () => {
    const prefs = useUserPrefsStore.getState()
    prefs.loadFromLocalStorage()
    const selectedIds = useUserPrefsStore.getState().selectedContracts

    if (selectedIds.length === 0) {
      set({ favorites: [] })
      return
    }

    try {
      const result = await getInstrumentsByIds(selectedIds)
      if (result.instruments?.length) {
        set({ favorites: result.instruments })
        // 订阅收藏合约
        const ids = result.instruments.map((c) => c.instrumentID)
        await subscribeMarket(ids)
      }
    } catch (err) {
      console.error('[contracts] Failed to load favorite contracts:', err)
    }
  },

  /** 添加收藏并订阅 */
  addToFavorites: async (contract) => {
    const { favorites } = get()
    if (favorites.some((c) => c.instrumentID === contract.instrumentID)) return

    // 持久化到 userPrefs
    const prefs = useUserPrefsStore.getState()
    prefs.addSelectedContract(contract.instrumentID)
    prefs.saveToLocalStorage()

    // 订阅
    try {
      await subscribeMarket([contract.instrumentID])
    } catch {
      // Silent fail
    }

    set({ favorites: [...favorites, contract] })
  },

  /** 移除收藏并取消订阅 */
  removeFromFavorites: async (instrumentId) => {
    // 从 userPrefs 移除
    const prefs = useUserPrefsStore.getState()
    prefs.removeSelectedContract(instrumentId)
    prefs.saveToLocalStorage()

    // 取消订阅
    try {
      await unsubscribeMarket([instrumentId])
    } catch {
      // Silent fail
    }

    const { favorites } = get()
    set({ favorites: favorites.filter((c) => c.instrumentID !== instrumentId) })
  },

  /** 从合约列表中移除 */
  removeContractById: (instrumentId) => {
    const { contracts } = get()
    set({ contracts: contracts.filter((c) => c.instrumentID !== instrumentId) })
  },
}))
