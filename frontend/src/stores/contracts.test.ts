import { describe, it, expect, beforeEach } from 'vitest'
import { useContractsStore } from './contracts'

describe('useContractsStore', () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: [], selectedContracts: [] })
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
      { instrumentID: 'au2406', instrumentName: '黄金2406', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2024-06-15', isTrading: true },
    ]
    useContractsStore.getState().setContracts(contracts)
    expect(useContractsStore.getState().contracts).toEqual(contracts)
  })
})
