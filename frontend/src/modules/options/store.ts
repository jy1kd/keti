import { create } from 'zustand'
import type { OptionChain } from '@/services/types'
import { getOptionChains, getVolatility } from '@/services/api'

interface OptionsStore {
  // T型报价数据
  optionChains: OptionChain[]
  // 隐含波动率（instrumentID → IV），来自 /api/market/volatility
  volatility: Map<string, number>
  // UI 状态
  selectedUnderlying: string | null
  selectedExpireDate: string | null
  loading: boolean
  error: string | null
  // Actions
  setSelectedUnderlying: (underlying: string | null) => void
  setSelectedExpireDate: (expireDate: string | null) => void
  fetchOptionChains: (underlying?: string, expireDate?: string) => Promise<void>
  fetchVolatility: (underlying?: string) => Promise<void>
  clearError: () => void
  // Computed helpers
  availableUnderlyings: () => string[]
  availableExpirations: () => string[]
  allStrikes: () => number[]
}

export const useOptionsStore = create<OptionsStore>((set, getState) => ({
  optionChains: [],
  volatility: new Map(),
  selectedUnderlying: null,
  selectedExpireDate: null,
  loading: false,
  error: null,

  setSelectedUnderlying: (underlying) => set({ selectedUnderlying: underlying }),

  setSelectedExpireDate: (expireDate) => set({ selectedExpireDate: expireDate }),

  clearError: () => set({ error: null }),

  fetchOptionChains: async (underlying?, expireDate?) => {
    set({ loading: true, error: null })
    try {
      const res = await getOptionChains(underlying, expireDate)
      set({ optionChains: res.chains ?? [], loading: false })
    } catch (err) {
      console.error('[OptionsStore] fetchOptionChains failed:', err)
      set({ loading: false, error: 'Failed to load option chains' })
    }
  },

  fetchVolatility: async (underlying?) => {
    try {
      const res = await getVolatility(underlying)
      const map = new Map<string, number>()
      for (const v of res.volatility ?? []) {
        map.set(v.instrumentID, v.impliedVolatility)
      }
      set({ volatility: map })
    } catch (err) {
      console.error('[OptionsStore] fetchVolatility failed:', err)
    }
  },

  availableUnderlyings: () => {
    const chains = getState().optionChains
    const underlyings = [...new Set(chains.map((c) => c.underlying))]
    return underlyings.sort()
  },

  availableExpirations: () => {
    const chains = getState().optionChains
    const dates = [...new Set(chains.map((c) => c.expireDate))]
    return dates.sort()
  },

  allStrikes: () => {
    const chains = getState().optionChains
    if (chains.length === 0) return []
    const strikes = new Set<number>()
    for (const chain of chains) {
      for (const call of chain.calls) strikes.add(call.strikePrice)
      for (const put of chain.puts) strikes.add(put.strikePrice)
    }
    return [...strikes].sort((a, b) => a - b)
  },
}))
