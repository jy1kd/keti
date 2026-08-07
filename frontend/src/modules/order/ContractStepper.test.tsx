import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractStepper } from './ContractStepper'
import { useContractsStore } from '@/stores/contracts'
import { useOrderPopupStore } from './popupStore'
import type { ContractInfo } from '@/services/types'

function contract(instrumentID: string): ContractInfo {
  return {
    instrumentID,
    instrumentName: instrumentID,
    exchangeID: 'CFFEX',
    productID: instrumentID.replace(/\d+$/, ''),
    volumeMultiple: 1,
    priceTick: 0.2,
    expireDate: '2026-08-15',
    isTrading: 1,
    productClass: '1',
  }
}

const CONTRACTS: ContractInfo[] = [
  contract('IF2607'),
  contract('IF2608'),
  contract('IF2609'),
  contract('IH2608'),
  contract('IC2608'),
  contract('IM2608'),
]

describe('ContractStepper（P3 合约步进）', () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: CONTRACTS, favorites: [], isLoaded: true })
    useOrderPopupStore.setState({ instrumentID: null })
  })

  function renderStepper(onSelect = vi.fn()) {
    const view = render(<ContractStepper instrumentID="IF2608" onSelect={onSelect} />)
    return { onSelect, ...view }
  }

  it('渲染当前合约代码', () => {
    renderStepper()
    expect(screen.getByTestId('cs-code').textContent).toBe('IF2608')
  })

  it('点击 ‹ → 上一月份合约（IF2607），onSelect 触发', () => {
    const { onSelect } = renderStepper()
    fireEvent.click(screen.getByTestId('cs-prev'))
    expect(onSelect).toHaveBeenCalledWith('IF2607')
  })

  it('点击 › → 下一月份合约（IF2609）', () => {
    const { onSelect } = renderStepper()
    fireEvent.click(screen.getByTestId('cs-next'))
    expect(onSelect).toHaveBeenCalledWith('IF2609')
  })

  it('目标月份合约不存在 → 对应箭头禁用', () => {
    useContractsStore.setState({
      contracts: [contract('IF2608'), contract('IF2609')],
      favorites: [],
      isLoaded: true,
    })
    renderStepper()
    expect(screen.getByTestId('cs-prev')).toBeDisabled() // IF2607 不存在
    expect(screen.getByTestId('cs-next')).not.toBeDisabled()
  })

  it('IF ▲ → 下一品种 IH2608；▼（上一品种，无）禁用', () => {
    const { onSelect } = renderStepper()
    // CFFEX 顺序 IF→IH→IC→IM：IF ▲ 进到下一品种 IH；▼ 上一品种无 → 禁用
    fireEvent.click(screen.getByTestId('cs-up'))
    expect(onSelect).toHaveBeenCalledWith('IH2608')
    expect(screen.getByTestId('cs-down')).toBeDisabled()
  })

  it('品种序列内切换：IC ▲ → IM，IM ▼ → IC', () => {
    const onSelect = vi.fn()
    render(<ContractStepper instrumentID="IC2608" onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('cs-up'))
    expect(onSelect).toHaveBeenCalledWith('IM2608')
    fireEvent.click(screen.getByTestId('cs-down'))
    expect(onSelect).toHaveBeenCalledWith('IH2608')
  })

  it('弹窗打开当前合约时，步进联动 popupStore.instrumentID（标题/订阅随动）', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    renderStepper()
    fireEvent.click(screen.getByTestId('cs-next'))
    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2609')
  })

  it('弹窗未打开（标签页场景）时步进不影响 popupStore', () => {
    renderStepper()
    fireEvent.click(screen.getByTestId('cs-next'))
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('不可解析代码（期权）→ 代码显示 -- 且全部箭头禁用', () => {
    render(<ContractStepper instrumentID="IO2608-C-4700" onSelect={vi.fn()} />)
    expect(screen.getByTestId('cs-code').textContent).toBe('--')
    for (const id of ['cs-up', 'cs-prev', 'cs-next', 'cs-down']) {
      expect(screen.getByTestId(id)).toBeDisabled()
    }
  })
})
