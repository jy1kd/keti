import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContractsStore } from './contracts'
import { useUserPrefsStore } from './userPrefs'
import type { ContractInfo } from '@/services/types'

// Mock API modules
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn(),
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
    useContractsStore.setState({ contracts: [], favorites: [], isLoaded: false })
    useUserPrefsStore.setState({ selectedContracts: [], hotKeys: { buy: 'b', sell: 's', cancel: 'c', reverse: '', lock: '', batchCancel: 'Escape', openOrder: '', openKline: '', openSettings: '' } })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('初始状态：合约列表为空', () => {
    const state = useContractsStore.getState()
    expect(state.contracts).toEqual([])
    expect(state.favorites).toEqual([])
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

  // --- loadFavoriteContracts tests ---

  it('loadFavoriteContracts 从 localStorage 加载收藏合约（订阅由订阅管理器负责）', async () => {
    const { getInstrumentsByIds, subscribeMarket } = await import('@/services/api')
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract], count: 1 })

    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().saveToLocalStorage()

    await useContractsStore.getState().loadFavoriteContracts()

    expect(getInstrumentsByIds).toHaveBeenCalledWith(['au2406'])
    expect(subscribeMarket).not.toHaveBeenCalled()
    expect(useContractsStore.getState().favorites).toEqual([mockContract])
  })

  it('loadFavoriteContracts 无收藏时不调用 API', async () => {
    const { getInstrumentsByIds } = await import('@/services/api')

    await useContractsStore.getState().loadFavoriteContracts()

    expect(getInstrumentsByIds).not.toHaveBeenCalled()
    expect(useContractsStore.getState().favorites).toEqual([])
  })

  // --- addToFavorites tests ---

  it('addToFavorites 添加到收藏（订阅由订阅管理器负责）', async () => {
    const { subscribeMarket } = await import('@/services/api')

    await useContractsStore.getState().addToFavorites(mockContract)

    expect(useContractsStore.getState().favorites).toEqual([mockContract])
    expect(useUserPrefsStore.getState().selectedContracts).toContain('au2406')
    expect(subscribeMarket).not.toHaveBeenCalled()
  })

  it('addToFavorites 重复添加不产生重复', async () => {
    const { subscribeMarket } = await import('@/services/api')
    vi.mocked(subscribeMarket).mockResolvedValue({ success: true, added: ['au2406'], alreadySubscribed: [] })

    await useContractsStore.getState().addToFavorites(mockContract)
    await useContractsStore.getState().addToFavorites(mockContract)

    expect(useContractsStore.getState().favorites).toHaveLength(1)
  })

  // --- removeFromFavorites tests ---

  it('removeFromFavorites 从收藏移除（退订由订阅管理器负责）', async () => {
    const { unsubscribeMarket } = await import('@/services/api')

    useContractsStore.setState({ favorites: [mockContract] })
    useUserPrefsStore.getState().addSelectedContract('au2406')

    await useContractsStore.getState().removeFromFavorites('au2406')

    expect(useContractsStore.getState().favorites).toEqual([])
    expect(useUserPrefsStore.getState().selectedContracts).not.toContain('au2406')
    expect(unsubscribeMarket).not.toHaveBeenCalled()
  })
})
