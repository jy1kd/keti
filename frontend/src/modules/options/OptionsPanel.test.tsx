import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionsPanel } from './OptionsPanel'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import type { ContractInfo } from '@/services/types'

// Mock TQuoteView（T型报价二级视图依赖链沉重，仅测切换渲染）
vi.mock('./TQuoteView', () => ({
  TQuoteView: () => <div data-testid="tquote-view">TQuoteView Mock</div>,
}))

// Mock InstrumentSearchModal（放大镜高级搜索弹窗）
vi.mock('@/components/InstrumentSearchModal', () => ({
  InstrumentSearchModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="instrument-search-modal">
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null,
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
const futMA: ContractInfo = { instrumentID: 'MA609', instrumentName: 'MA609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optMA: ContractInfo = { instrumentID: 'MA609-C-1000', instrumentName: 'MA609-C-1000', exchangeID: 'CZCE', productID: 'MAC', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'MA609', optionsType: '1', strikePrice: 1000 }
const futCu: ContractInfo = { instrumentID: 'cu2609', instrumentName: 'cu2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '1' }
const optCu: ContractInfo = { instrumentID: 'cu2609-C-70000', instrumentName: 'cu2609-C-70000', exchangeID: 'SHFE', productID: 'cu_c', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'cu2609', optionsType: '1', strikePrice: 70000 }

function setupContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP],
    favorites: [],
    isLoaded: true,
  })
}

function setupFilterContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP, futMA, optMA, futCu, optCu],
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
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
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

  // --- 交易所+品种多选筛选（Task 7） ---

  /** 读取最近一次 setRecords 的合约 ID 序列 */
  function latestRecordIDs(instance: any): string[] {
    const last = instance.setRecords.mock.calls.at(-1)?.[0] ?? []
    return last.map((r: any) => r.instrumentID)
  }

  it('渲染「筛选」按钮，空筛选无徽标', () => {
    render(<OptionsPanel />)
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(screen.queryByTestId('contract-filter-badge')).toBeNull()
  })

  it('按标底品种过滤：勾选 玻璃 后只保留 FG 组（标底行+期权行），其余组消失', async () => {
    setupFilterContracts()
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    expect(latestRecordIDs(instance)).toEqual(['FG609', 'FG609-C-1300', 'FG609-P-1300'])
  })

  it('按交易所过滤：勾选 SHFE 后只保留 cu 组（标底行+期权行）', async () => {
    setupFilterContracts()
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: 'SHFE' }))
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    expect(latestRecordIDs(instance)).toEqual(['cu2609', 'cu2609-C-70000'])
  })

  it('清空筛选后恢复全量分组', async () => {
    setupFilterContracts()
    const user = userEvent.setup()
    render(<OptionsPanel />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    await user.click(screen.getByRole('button', { name: '清空' }))
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    // 全量：cu < FG < MA 按标底自然序
    expect(latestRecordIDs(instance)).toEqual([
      'cu2609', 'cu2609-C-70000',
      'FG609', 'FG609-C-1300', 'FG609-P-1300',
      'MA609', 'MA609-C-1000',
    ])
  })

  describe('工具行布局与搜索定位（Task 8）', () => {
    it('列表视图渲染搜索框；T型报价视图隐藏列表工具行（筛选/仅交易中/收藏/搜索框）但保留 [列表|T型] 切换', async () => {
      const user = userEvent.setup()
      render(<OptionsPanel />)
      // 列表视图：完整工具行存在
      expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'T型报价' }))

      // T型报价视图：列表工具行隐藏
      expect(screen.queryByPlaceholderText('搜索合约...')).toBeNull()
      expect(screen.queryByRole('button', { name: /筛选/ })).toBeNull()
      expect(screen.queryByRole('button', { name: /仅交易中|显示全部/ })).toBeNull()
      expect(screen.queryByRole('button', { name: '收藏' })).toBeNull()
      // 二级切换保留
      expect(screen.getByRole('button', { name: 'T型报价' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '列表' })).toBeInTheDocument()
    })

    it('搜索选中期权合约 → 定位到其标底分组（selectedInstrument/selectedContracts = 标底 FG609）', async () => {
      // jsdom 无 scrollIntoView：ContractSearch 高亮项滚动 effect 依赖它
      const scrollIntoViewStub = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoViewStub

      const user = userEvent.setup()
      render(<OptionsPanel />)
      const input = screen.getByPlaceholderText('搜索合约...')
      await user.type(input, 'FG609-C')
      await user.click(screen.getByText('FG609-C-1300'))

      expect(useMarketStore.getState().selectedInstrument).toBe('FG609')
      expect(useMarketStore.getState().selectedContracts.has('FG609')).toBe(true)
      expect(useMarketStore.getState().selectedContracts.size).toBe(1)
    })

    it('点击 🔍 打开高级搜索弹窗', async () => {
      const user = userEvent.setup()
      render(<OptionsPanel />)
      expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
      await user.click(screen.getByTitle('搜索合约'))
      expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
    })

    it('DOM 顺序：列表/T型报价 → 全部/自选 → 筛选 → 收藏 → 搜索框', () => {
      const { container } = render(<OptionsPanel />)
      const toolbar = container.querySelector('.market-toolbar') as HTMLElement
      const mode = toolbar.querySelector('.market-toolbar__mode') as Element
      const tabs = toolbar.querySelector('.market-toolbar__tabs') as Element
      const filterBtn = screen.getByRole('button', { name: /筛选/ })
      const favoriteBtn = toolbar.querySelector('.btn-favorite') as Element
      const searchInput = toolbar.querySelector('.market-toolbar__search .search-input') as Element

      const follows = (a: Element, b: Element) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

      expect(mode).toBeTruthy()
      expect(tabs).toBeTruthy()
      expect(favoriteBtn).toBeTruthy()
      expect(searchInput).toBeTruthy()
      expect(follows(mode, tabs)).toBe(true)
      expect(follows(tabs, filterBtn)).toBe(true)
      expect(follows(filterBtn, favoriteBtn)).toBe(true)
      expect(follows(favoriteBtn, searchInput)).toBe(true)
    })
  })
})
