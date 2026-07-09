import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'

interface ContractsStore {
  contracts: ContractInfo[]
  selectedContracts: string[]
  setContracts: (contracts: ContractInfo[]) => void
  addContract: (instrumentId: string) => void
  removeContract: (instrumentId: string) => void
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
}))
