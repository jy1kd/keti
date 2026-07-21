import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { useUserPrefsStore } from './userPrefs'
import {
  getPresetInstruments,
  getInstrumentsByIds,
  unsubscribeMarket,
} from '@/services/api'

interface ContractsStore {
  contracts: ContractInfo[]
  selectedContracts: string[]
  setContracts: (contracts: ContractInfo[]) => void
  addContract: (instrumentId: string) => void
  removeContract: (instrumentId: string) => void
  /** Add a contract with full info (from search modal) */
  addContractInfo: (contract: ContractInfo) => void
  /** Remove by instrumentID and unsubscribe from CTP */
  removeContractById: (instrumentId: string) => Promise<void>
  /** Load preset + user subscriptions from localStorage and subscribe */
  loadSubscribedContracts: () => Promise<void>
}

export const useContractsStore = create<ContractsStore>((set) => ({
  contracts: [],
  selectedContracts: [],

  setContracts: (contracts) => set({ contracts }),

  addContract: (instrumentId) =>
    set((state) => {
      if (state.selectedContracts.includes(instrumentId)) return state
      return { selectedContracts: [...state.selectedContracts, instrumentId] }
    }),

  removeContract: (instrumentId) =>
    set((state) => ({
      selectedContracts: state.selectedContracts.filter((id) => id !== instrumentId),
    })),

  addContractInfo: (contract) => {
    set((state) => {
      if (state.contracts.some((c) => c.instrumentID === contract.instrumentID)) return state
      return { contracts: [...state.contracts, contract] }
    })
    // Persist to userPrefs
    const prefs = useUserPrefsStore.getState()
    prefs.addSelectedContract(contract.instrumentID)
    prefs.saveToLocalStorage()
  },

  removeContractById: async (instrumentId) => {
    try {
      await unsubscribeMarket([instrumentId])
    } catch {
      // Silent fail — still remove from local state
    }
    set((state) => ({
      contracts: state.contracts.filter((c) => c.instrumentID !== instrumentId),
    }))
    const prefs = useUserPrefsStore.getState()
    prefs.removeSelectedContract(instrumentId)
    prefs.saveToLocalStorage()
  },

  loadSubscribedContracts: async () => {
    // 1. Load user prefs from localStorage
    const prefs = useUserPrefsStore.getState()
    prefs.loadFromLocalStorage()
    const userSelected = prefs.selectedContracts

    // 2. Get preset instruments
    let presetIds: string[] = []
    try {
      const preset = await getPresetInstruments()
      presetIds = preset.instruments
    } catch {
      // Preset load failed — continue with user selections only
    }

    // 3. Merge and deduplicate
    const allIds = [...new Set([...presetIds, ...userSelected])]

    if (allIds.length === 0) return

    // 4. Get contract details
    try {
      const result = await getInstrumentsByIds(allIds)
      if (result.instruments?.length) {
        set({ contracts: result.instruments })
      }
    } catch {
      console.warn('[ContractsStore] Failed to load contract details')
    }
  },
}))
