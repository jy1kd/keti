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
    useContractsStore.setState({ contracts: [], presetContracts: [], userContracts: [], presetIds: [] })
    useUserPrefsStore.setState({ selectedContracts: [], hotKeys: { buy: 'b', sell: 's', cancel: 'c', reverse: '', lock: '', batchCancel: 'Escape' } })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('初始状态：合约列表为空', () => {
    const state = useContractsStore.getState()
    expect(state.contracts).toEqual([])
    expect(state.presetContracts).toEqual([])
    expect(state.userContracts).toEqual([])
  })

  it('setContracts 批量设置合约列表', () => {
    useContractsStore.getState().setContracts([mockContract])
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  // --- addContractInfo tests ---

  it('addContractInfo 添加合约到 userContracts', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useContractsStore.getState().userContracts).toEqual([mockContract])
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  it('addContractInfo 重复添加不产生重复', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useContractsStore.getState().userContracts).toHaveLength(1)
  })

  it('addContractInfo 同时持久化到 userPrefs', () => {
    useContractsStore.getState().addContractInfo(mockContract)
    expect(useUserPrefsStore.getState().selectedContracts).toContain('au2406')
  })

  // --- removeFromFavorites tests ---

  it('removeFromFavorites 从 userContracts 移除但保留 presetContracts', () => {
    useContractsStore.setState({ presetContracts: [mockContract], userContracts: [mockContract], contracts: [mockContract] })
    useContractsStore.getState().removeFromFavorites('au2406')
    expect(useContractsStore.getState().userContracts).toEqual([])
    expect(useContractsStore.getState().presetContracts).toEqual([mockContract])
    expect(useContractsStore.getState().contracts).toEqual([mockContract])
  })

  it('removeFromFavorites 同步移除 userPrefs 中的记录', () => {
    useContractsStore.setState({ presetContracts: [], userContracts: [mockContract], contracts: [mockContract] })
    useUserPrefsStore.getState().addSelectedContract('au2406')
    useContractsStore.getState().removeFromFavorites('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).not.toContain('au2406')
  })

  // --- removeContractById tests ---

  it('removeContractById 从 userContracts 和 presetContracts 中移除', async () => {
    useContractsStore.setState({ presetContracts: [mockContract, mockContract2], userContracts: [mockContract], contracts: [mockContract, mockContract2] })
    await useContractsStore.getState().removeContractById('au2406')
    expect(useContractsStore.getState().presetContracts).toEqual([mockContract2])
    expect(useContractsStore.getState().userContracts).toEqual([])
    expect(useContractsStore.getState().contracts).toEqual([mockContract2])
  })

  it('removeContractById 同步移除 userPrefs 中的记录', async () => {
    useContractsStore.setState({ presetContracts: [], userContracts: [mockContract], contracts: [mockContract] })
    useUserPrefsStore.getState().addSelectedContract('au2406')
    await useContractsStore.getState().removeContractById('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).not.toContain('au2406')
  })

  // --- loadSubscribedContracts tests ---

  it('loadSubscribedContracts 分别加载预设和用户自选合约', async () => {
    const { getPresetInstruments, getInstrumentsByIds } = await import('@/services/api')
    vi.mocked(getPresetInstruments).mockResolvedValue({ instruments: ['au2406'], updatedAt: null })
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract, mockContract2], count: 2 })

    // au2406 是预设同时也是用户收藏，rb2406 仅用户收藏
    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().addSelectedContract('rb2406')
    useUserPrefsStore.getState().saveToLocalStorage()

    await useContractsStore.getState().loadSubscribedContracts()

    expect(getInstrumentsByIds).toHaveBeenCalledWith(
      expect.arrayContaining(['au2406', 'rb2406'])
    )
    expect(useContractsStore.getState().presetContracts).toEqual([mockContract])
    // userContracts 包含所有用户收藏的合约（包括同时是预设的）
    expect(useContractsStore.getState().userContracts).toEqual([mockContract, mockContract2])
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
    expect(useContractsStore.getState().userContracts).toEqual([mockContract])
  })

  it('loadSubscribedContracts 无合约时不调用API', async () => {
    const { getInstrumentsByIds } = await import('@/services/api')
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [], count: 0 })

    await useContractsStore.getState().loadSubscribedContracts()

    expect(getInstrumentsByIds).not.toHaveBeenCalled()
  })
})
