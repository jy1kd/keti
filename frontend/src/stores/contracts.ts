import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { getInstruments } from '@/services/api'

interface ContractsStore {
  /** 全量合约列表（从 API 加载） */
  contracts: ContractInfo[]
  /** 是否已加载全量合约 */
  isLoaded: boolean
  /** 批量设置合约列表 */
  setContracts: (contracts: ContractInfo[]) => void
  /** 加载全量合约 */
  loadAllInstruments: () => Promise<void>
}

export const useContractsStore = create<ContractsStore>((set) => ({
  contracts: [],
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
}))
