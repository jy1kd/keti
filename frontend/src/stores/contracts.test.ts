import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContractsStore } from './contracts'
import type { ContractInfo } from '@/services/types'

// Mock API modules
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn(),
}))

const mockContract: ContractInfo = {
  instrumentID: 'au2406',
  instrumentName: '黄金2406',
  exchangeID: 'SHFE',
  productID: 'au',
  volumeMultiple: 1000,
  priceTick: 0.02,
  expireDate: '2024-06-15',
  isTrading: 1,
  productClass: "1",
}

const mockContract2: ContractInfo = {
  instrumentID: 'rb2406',
  instrumentName: '螺纹钢2406',
  exchangeID: 'SHFE',
  productID: 'rb',
  volumeMultiple: 10,
  priceTick: 1,
  expireDate: '2024-06-15',
  isTrading: 1,
  productClass: "1",
}

describe('useContractsStore', () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: [], isLoaded: false })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('初始状态：合约列表为空', () => {
    const state = useContractsStore.getState()
    expect(state.contracts).toEqual([])
    expect(state.isLoaded).toBe(false)
  })

  it('setContracts 批量设置合约列表', () => {
    useContractsStore.getState().setContracts([mockContract])
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  // --- loadAllInstruments tests ---

  it('loadAllInstruments 从 API 加载全量合约', async () => {
    const { getInstruments } = await import('@/services/api')
    vi.mocked(getInstruments).mockResolvedValue({ instruments: [mockContract, mockContract2], count: 2 })

    await useContractsStore.getState().loadAllInstruments()

    expect(getInstruments).toHaveBeenCalled()
    expect(useContractsStore.getState().contracts).toEqual([mockContract, mockContract2])
    expect(useContractsStore.getState().isLoaded).toBe(true)
  })

  it('loadAllInstruments API 失败时不设置 isLoaded', async () => {
    const { getInstruments } = await import('@/services/api')
    vi.mocked(getInstruments).mockRejectedValue(new Error('network error'))

    await useContractsStore.getState().loadAllInstruments()

    expect(useContractsStore.getState().isLoaded).toBe(false)
  })
})
