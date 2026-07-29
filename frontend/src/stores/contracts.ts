import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { useUserPrefsStore } from './userPrefs'
import {
  getPresetInstruments,
  getInstrumentsByIds,
  subscribeMarket,
  unsubscribeMarket,
} from '@/services/api'

interface ContractsStore {
  /** Preset contracts (system-managed, subscribed on load, can be removed by退订) */
  presetContracts: ContractInfo[]
  /** User-favorited contracts (user-managed, no CTP subscribe needed) */
  userContracts: ContractInfo[]
  /** Preset instrument IDs (auto-detected front-month contracts) */
  presetIds: string[]
  /** Combined contracts for backward compatibility (OrderForm, order store) */
  contracts: ContractInfo[]
  setContracts: (contracts: ContractInfo[]) => void
  /** Add a contract to userContracts (no CTP call — already subscribed via preset or modal) */
  addContractInfo: (contract: ContractInfo) => void
  /** Remove from userContracts only (no CTP call) */
  removeFromFavorites: (instrumentId: string) => void
  /** Subscribe to CTP + add to presetContracts (for new contracts from modal) */
  subscribeAndAddToPreset: (contract: ContractInfo) => Promise<void>
  /** CTP unsubscribe + remove from both presetContracts and userContracts */
  removeContractById: (instrumentId: string) => Promise<void>
  /** Load preset + user subscriptions from localStorage and subscribe */
  loadSubscribedContracts: () => Promise<void>
}

/** Helper: recompute combined contracts from preset + user */
function buildCombinedContracts(presetContracts: ContractInfo[], userContracts: ContractInfo[]): ContractInfo[] {
  const map = new Map<string, ContractInfo>()
  for (const c of presetContracts) map.set(c.instrumentID, c)
  for (const c of userContracts) map.set(c.instrumentID, c)
  return Array.from(map.values())
}

export const useContractsStore = create<ContractsStore>((set, get) => ({
  presetContracts: [],
  userContracts: [],
  presetIds: [],
  contracts: [],

  setContracts: (contracts) => set({ contracts }),

  /** 加入自选：只操作 userContracts + localStorage，不调 CTP */
  addContractInfo: (contract) => {
    const { presetContracts, userContracts } = get()
    if (userContracts.some((c) => c.instrumentID === contract.instrumentID)) return
    const newUserContracts = [...userContracts, contract]
    set({
      userContracts: newUserContracts,
      contracts: buildCombinedContracts(presetContracts, newUserContracts),
    })
    const prefs = useUserPrefsStore.getState()
    prefs.addSelectedContract(contract.instrumentID)
    prefs.saveToLocalStorage()
  },

  /** 移除收藏：只从 userContracts 移除，不调 CTP */
  removeFromFavorites: (instrumentId) => {
    const { presetContracts, userContracts } = get()
    const newUserContracts = userContracts.filter((c) => c.instrumentID !== instrumentId)
    set({
      userContracts: newUserContracts,
      contracts: buildCombinedContracts(presetContracts, newUserContracts),
    })
    const prefs = useUserPrefsStore.getState()
    prefs.removeSelectedContract(instrumentId)
    prefs.saveToLocalStorage()
  },

  /** 订阅新合约：CTP 订阅 + 加入预设表格 + 写入 localStorage */
  subscribeAndAddToPreset: async (contract) => {
    const { presetContracts, presetIds, userContracts } = get()
    if (presetContracts.some((c) => c.instrumentID === contract.instrumentID)) return
    try {
      await subscribeMarket([contract.instrumentID])
    } catch {
      // Silent fail
    }
    const newPresetContracts = [...presetContracts, contract]
    const newPresetIds = [...presetIds, contract.instrumentID]
    set({
      presetContracts: newPresetContracts,
      presetIds: newPresetIds,
      contracts: buildCombinedContracts(newPresetContracts, userContracts),
    })
    // 写入 localStorage，刷新后能恢复
    const prefs = useUserPrefsStore.getState()
    prefs.addSelectedContract(contract.instrumentID)
    prefs.saveToLocalStorage()
  },

  /** 退订：CTP 退订 + 从预设/自选中移除 */
  removeContractById: async (instrumentId) => {
    try {
      await unsubscribeMarket([instrumentId])
    } catch {
      // Silent fail
    }
    const { presetContracts, userContracts, presetIds } = get()
    const newPresetContracts = presetContracts.filter((c) => c.instrumentID !== instrumentId)
    const newUserContracts = userContracts.filter((c) => c.instrumentID !== instrumentId)
    const newPresetIds = presetIds.filter((id) => id !== instrumentId)
    set({
      presetContracts: newPresetContracts,
      presetIds: newPresetIds,
      userContracts: newUserContracts,
      contracts: buildCombinedContracts(newPresetContracts, newUserContracts),
    })
    const prefs = useUserPrefsStore.getState()
    prefs.removeSelectedContract(instrumentId)
    prefs.saveToLocalStorage()
  },

  loadSubscribedContracts: async () => {
    const prefs = useUserPrefsStore.getState()
    prefs.loadFromLocalStorage()
    const userSelected = useUserPrefsStore.getState().selectedContracts

    let presetIds: string[] = []
    try {
      const preset = await getPresetInstruments()
      presetIds = preset.instruments
    } catch {
      // Preset load failed
    }

    // userIds 包含所有用户收藏的合约（包括同时是预设的合约）
    const allIds = [...new Set([...presetIds, ...userSelected])]

    if (allIds.length === 0) {
      set({ presetIds, presetContracts: [], userContracts: [], contracts: [] })
      return
    }

    try {
      const result = await getInstrumentsByIds(allIds)
      if (result.instruments?.length) {
        const idToContract = new Map(result.instruments.map((c) => [c.instrumentID, c]))
        const presetContracts = presetIds
          .map((id) => idToContract.get(id))
          .filter((c): c is ContractInfo => c != null)
        const userContracts = userSelected
          .map((id) => idToContract.get(id))
          .filter((c): c is ContractInfo => c != null)
        set({
          presetContracts,
          userContracts,
          contracts: buildCombinedContracts(presetContracts, userContracts),
          presetIds,
        })
      }
    } catch {
      console.warn('[ContractsStore] Failed to load contract details')
    }
  },
}))
