import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContractsStore } from './contracts'
import { useUserPrefsStore } from './userPrefs'
import type { ContractInfo } from '@/services/types'

// Mock API modules
vi.mock('@/services/api', () => ({
  getPresetInstruments: vi.fn(),
  getInstrumentsByIds: vi.fn(),
  subscribeMarket: vi.fn(),
  unsubscribeMarket: vi.fn(),
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
    useContractsStore.setState({ contracts: [], selectedContracts: [] })
    useUserPrefsStore.setState({ selectedContracts: [], hotKeys: { buy: 'b', sell: 's', cancel: 'c' } })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('初始状态：合约列表和自选合约均为空', () => {
    const state = useContractsStore.getState()
    expect(state.contracts).toEqual([])
    expect(state.selectedContracts).toEqual([])
  })

  it('addContract 添加合约到自选列表', () => {
    useContractsStore.getState().addContract('au2406')
    expect(useContractsStore.getState().selectedContracts).toEqual(['au2406'])
  })

  it('addContract 重复添加不会产生重复项', () => {
    useContractsStore.getState().addContract('au2406')
    useContractsStore.getState().addContract('au2406')
    expect(useContractsStore.getState().selectedContracts).toEqual(['au2406'])
  })

  it('addContract 可添加多个合约', () => {
    useContractsStore.getState().addContract('au2406')
    useContractsStore.getState().addContract('rb2406')
    expect(useContractsStore.getState().selectedContracts).toEqual(['au2406', 'rb2406'])
  })

  it('removeContract 从自选列表移除合约', () => {
    useContractsStore.getState().addContract('au2406')
    useContractsStore.getState().addContract('rb2406')
    useContractsStore.getState().removeContract('au2406')
    expect(useContractsStore.getState().selectedContracts).toEqual(['rb2406'])
  })

  it('removeContract 移除不存在的合约不报错', () => {
    useContractsStore.getState().removeContract('nonexistent')
    expect(useContractsStore.getState().selectedContracts).toEqual([])
  })

  it('setContracts 批量设置合约列表', () => {
    const contracts = [
      { instrumentID: 'au2406', instrumentName: '黄金2406', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2024-06-15', isTrading: 1, productClass: "1" },
    ]
    useContractsStore.getState().setContracts(contracts)
    expect(useContractsStore.getState().contracts).toEqual(contracts)
  })

  // --- addContractInfo tests ---

  it('addContractInfo 添加完整合约信息到列表', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  it('addContractInfo 重复添加不产生重复', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useContractsStore.getState().contracts).toHaveLength(1)
  })

  it('addContractInfo 同时持久化到 userPrefs', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useUserPrefsStore.getState().selectedContracts).toContain('au2406')
  })

  // --- removeContractById tests ---

  it('removeContractById 从列表移除合约', async () => {
    useContractsStore.setState({ contracts: [mockContract, mockContract2] })
    await useContractsStore.getState().removeContractById('au2406')
    expect(useContractsStore.getState().contracts).toEqual([mockContract2])
  })

  it('removeContractById 同步移除 userPrefs 中的记录', async () => {
    useContractsStore.setState({ contracts: [mockContract] })
    useUserPrefsStore.getState().addSelectedContract('au2406')
    await useContractsStore.getState().removeContractById('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).not.toContain('au2406')
  })

  // --- loadSubscribedContracts tests ---

  it('loadSubscribedContracts 合并预设和用户自选合约', async () => {
    const { getPresetInstruments, getInstrumentsByIds } = await import('@/services/api')
    vi.mocked(getPresetInstruments).mockResolvedValue({ instruments: ['IF2406'], updatedAt: null })
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract, mockContract2], count: 2 })

    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().saveToLocalStorage()

    await useContractsStore.getState().loadSubscribedContracts()

    expect(getInstrumentsByIds).toHaveBeenCalledWith(
      expect.arrayContaining(['IF2406', 'au2406'])
    )
    expect(useContractsStore.getState().contracts).toEqual([mockContract, mockContract2])
  })

  it('loadSubscribedContracts 预设失败时仍加载用户自选', async () => {
    const { getPresetInstruments, getInstrumentsByIds } = await import('@/services/api')
    vi.mocked(getPresetInstruments).mockRejectedValue(new Error('network error'))
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract], count: 1 })

    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().saveToLocalStorage()

    await useContractsStore.getState().loadSubscribedContracts()

    expect(getInstrumentsByIds).toHaveBeenCalledWith(['au2406'])
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  it('loadSubscribedContracts 无合约时不调用API', async () => {
    const { getInstrumentsByIds } = await import('@/services/api')
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [], count: 0 })

    await useContractsStore.getState().loadSubscribedContracts()

    expect(getInstrumentsByIds).not.toHaveBeenCalled()
  })
})
