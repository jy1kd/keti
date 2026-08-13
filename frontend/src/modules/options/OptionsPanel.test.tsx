import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionsPanel } from './OptionsPanel'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import type { ContractInfo } from '@/services/types'

// Mock TQuoteView（T型报价二级视图依赖链沉重，仅测切换渲染）
vi.mock('./TQuoteView', () => ({
  TQuoteView: () => <div data-testid="tquote-view">TQuoteView Mock</div>,
}))

// Mock echarts（ContextMenu 无关，但部分共享模块可能引用）
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  default: {
    init: vi.fn(() => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optC: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }
const optP: ContractInfo = { instrumentID: 'FG609-P-1300', instrumentName: 'FG609-P-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '2', strikePrice: 1300 }

function setupContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP],
    favorites: [],
    isLoaded: true,
  })
}

describe('OptionsPanel', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
      selectedContracts: new Set(),
      visibleInstrumentIDs: [],
      scrollEndSeq: 0,
    })
    setupContracts()
    vi.clearAllMocks()
  })

  it('默认视图为 列表（列表按钮 active，列表表格渲染，T型报价不渲染）', () => {
    const { container } = render(<OptionsPanel />)
    expect(screen.getByRole('button', { name: '列表' }).classList.contains('active')).toBe(true)
    expect(screen.getByRole('button', { name: 'T型报价' }).classList.contains('active')).toBe(false)
    expect(container.querySelector('.market-table-container')).toBeTruthy()
    expect(screen.queryByTestId('tquote-view')).toBeNull()
  })

  it('点击 T型报价 切换二级视图，再切回 列表', async () => {
    const user = userEvent.setup()
    const { container } = render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: 'T型报价' }))
    expect(screen.getByTestId('tquote-view')).toBeInTheDocument()
    expect(container.querySelector('.market-table-container')).toBeNull()
    expect(screen.getByRole('button', { name: 'T型报价' }).classList.contains('active')).toBe(true)

    await user.click(screen.getByRole('button', { name: '列表' }))
    expect(container.querySelector('.market-table-container')).toBeTruthy()
    expect(screen.queryByTestId('tquote-view')).toBeNull()
    expect(screen.getByRole('button', { name: '列表' }).classList.contains('active')).toBe(true)
  })

  it('分组展平：标底行在前（kind=underlying、类型「标」），期权行随后（C 前 P 后、行权价填充）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const ids = options.records.map((r: any) => r.instrumentID)
    expect(ids).toEqual(['FG609', 'FG609-C-1300', 'FG609-P-1300'])
    expect(options.records[0].kind).toBe('underlying')
    expect(options.records[0].contractType).toBe('标')
    expect(options.records[1].kind).toBe('option')
    expect(options.records[1].contractType).toBe('C')
    expect(options.records[1].strikePrice).toBe(1300)
    expect(options.records[2].contractType).toBe('P')
  })

  it('行单击：同步 selectedInstrument + selectedContracts（单选集），供金色锚点守卫通过', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    act(() => {
      clickHandler({ row: 1, col: 1, event: {} })
    })
    expect(useMarketStore.getState().selectedInstrument).toBe('FG609')
    expect(useMarketStore.getState().selectedContracts.has('FG609')).toBe(true)
    expect(useMarketStore.getState().selectedContracts.size).toBe(1)
  })

  it('右键列表行：打开单选上下文菜单（打开报单/K线/查询）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    expect(contextmenuHandler).toBeDefined()
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    expect(screen.getByText('打开报单')).toBeInTheDocument()
    expect(screen.getByText('打开K线')).toBeInTheDocument()
    expect(screen.getByText('查询')).toBeInTheDocument()
  })

  it('收藏列点击：未收藏 → addToFavorites(inst)', async () => {
    const addSpy = vi.spyOn(useContractsStore.getState(), 'addToFavorites').mockResolvedValue(true)
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    const favoriteCol = optionsSpec.columns.length - 1
    act(() => {
      clickHandler({ row: 1, col: favoriteCol, event: {} })
    })
    expect(addSpy).toHaveBeenCalledWith(fut)
  })

  it('可见区上报：挂载后经 onVisibleRangeChange 上报可见合约（驱动共享订阅管理器）', async () => {
    render(<OptionsPanel />)
    // QuoteTable 挂载后 setTimeout(notifyVisibleRange, 0) 触发一次上报
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const visible = useMarketStore.getState().visibleInstrumentIDs
    expect(visible).toContain('FG609')
    expect(visible).toContain('FG609-C-1300')
    expect(visible).toContain('FG609-P-1300')
  })
})
