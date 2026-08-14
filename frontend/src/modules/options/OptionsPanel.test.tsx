import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionsPanel } from './OptionsPanel'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { openTQuoteFloating } from '@/utils/openFloatingTab'
import type { ContractInfo } from '@/services/types'

// Mock openTQuoteFloating：T型报价已独立为悬浮标签页，标底行双击/右键均入口该函数
vi.mock('@/utils/openFloatingTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/openFloatingTab')>()
  return { ...actual, openTQuoteFloating: vi.fn() }
})

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
    isLoaded: true,
  })
}

function setupFilterContracts() {
  useContractsStore.setState({
    contracts: [fut, optC, optP, futMA, optMA, futCu, optCu],
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
    // 期货/期权双固定标签，默认激活期货 → 期权面板 isActive=false（隐藏）
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
    setupContracts()
    vi.clearAllMocks()
  })

  it('默认视图为 列表（列表表格渲染，无 [列表|T型报价] 切换，无 TQuoteView 分支）', () => {
    const { container } = render(<OptionsPanel />)
    expect(container.querySelector('.market-table-container')).toBeTruthy()
    // T型报价已独立为悬浮标签页：不再有模式切换按钮
    expect(screen.queryByRole('button', { name: 'T型报价' })).toBeNull()
    expect(screen.queryByRole('button', { name: '列表' })).toBeNull()
    expect(screen.queryByTestId('tquote-view')).toBeNull()
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

  it('右键列表行（期权行）：打开单选上下文菜单（打开报单/K线/查询）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    expect(contextmenuHandler).toBeDefined()
    // row 2 = FG609-C-1300（期权行）→ 原单选菜单
    act(() => {
      contextmenuHandler({ row: 2, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    expect(screen.getByText('打开报单')).toBeInTheDocument()
    expect(screen.getByText('打开K线')).toBeInTheDocument()
    expect(screen.getByText('查询')).toBeInTheDocument()
  })

  it('双击标底行 → openTQuoteFloating(标底ID)（T型报价独立悬浮入口）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    // 标底行 vtable row 1 = FG609；两次快速点击触发双击 → onRowDoubleClick → handleRowDoubleClick → openTQuoteFloating
    act(() => {
      clickHandler({ row: 1, col: 1, event: {} })
      clickHandler({ row: 1, col: 1, event: {} })
    })
    expect(openTQuoteFloating).toHaveBeenCalledWith('FG609')
  })

  it('双击期权行 → 仍走原 handleDoubleClick（打开报单浮动窗，不触发 T型报价）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    act(() => {
      clickHandler({ row: 2, col: 1, event: {} }) // vtable row 2 = FG609-C-1300（期权行）
      clickHandler({ row: 2, col: 1, event: {} })
    })
    expect(openTQuoteFloating).not.toHaveBeenCalled()
    // 原 handleDoubleClick → openOrderPopup → openFloatingTab(order) 打开报单浮动窗
    expect(useFloatingWindowStore.getState().windows['tab-order-FG609-C-1300']).toBeDefined()
  })

  it('右键标底行 → 弹「打开T型报价」菜单（仅此项）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    expect(contextmenuHandler).toBeDefined()
    // row 1 = FG609（标底行）
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    // 仅「打开T型报价」一项（不显示 打开报单/K线/查询）
    expect(screen.getByText('打开T型报价')).toBeInTheDocument()
    expect(screen.queryByText('打开报单')).toBeNull()
    expect(screen.queryByText('打开K线')).toBeNull()
    expect(screen.queryByText('查询')).toBeNull()
  })

  it('右键标底行菜单点击「打开T型报价」→ openTQuoteFloating(标底ID)', async () => {
    const user = userEvent.setup()
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    await user.click(screen.getByText('打开T型报价'))
    expect(openTQuoteFloating).toHaveBeenCalledWith('FG609')
    // 点击后菜单关闭
    expect(screen.queryByText('打开T型报价')).toBeNull()
  })

  it('收藏列点击 → 打开 CollectionPicker（选夹面板）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    const favoriteCol = optionsSpec.columns.length - 1
    act(() => {
      clickHandler({ row: 1, col: favoriteCol, event: {} })
    })
    // 单选面板标题「收藏到收藏夹」出现（FG609 标底行）
    expect(screen.getByText('收藏到收藏夹')).toBeInTheDocument()
  })

  it('可见区上报：期权标签激活时挂载后上报可见合约（驱动共享订阅管理器）', async () => {
    // 期权标签激活：QuoteTable isActive=true → 挂载后 setTimeout(notifyVisibleRange,0) 上报可见区
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
        { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
      ],
      activeTabId: 'tab-options',
    })
    render(<OptionsPanel />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const visible = useMarketStore.getState().visibleInstrumentIDs
    expect(visible).toContain('FG609')
    expect(visible).toContain('FG609-C-1300')
    expect(visible).toContain('FG609-P-1300')
  })

  it('可见区上报：期权标签隐藏（期货激活）时挂载不上报，避免覆盖期货可见范围（Critical #1）', async () => {
    // 默认标签态 activeTabId='tab-market' → 期权面板 isActive=false（TabContent display:none 隐藏）
    useMarketStore.setState({ visibleInstrumentIDs: [] })
    render(<OptionsPanel />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(useMarketStore.getState().visibleInstrumentIDs).toEqual([])
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
    it('工具行始终渲染列表集群（筛选/仅交易中/收藏/搜索框），无 [列表|T型] 切换', () => {
      render(<OptionsPanel />)
      expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /仅交易中|显示全部/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '收藏' })).toBeInTheDocument()
      // 无模式切换按钮
      expect(screen.queryByRole('button', { name: 'T型报价' })).toBeNull()
      expect(screen.queryByRole('button', { name: '列表' })).toBeNull()
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

    it('DOM 顺序：全部/自选 → 筛选 → 收藏 → 搜索框（无 [列表|T型] 切换）', () => {
      const { container } = render(<OptionsPanel />)
      const toolbar = container.querySelector('.market-toolbar') as HTMLElement
      expect(toolbar.querySelector('.market-toolbar__mode')).toBeNull()
      const tabs = toolbar.querySelector('.market-toolbar__tabs') as Element
      const filterBtn = screen.getByRole('button', { name: /筛选/ })
      const favoriteBtn = toolbar.querySelector('.btn-favorite') as Element
      const searchInput = toolbar.querySelector('.market-toolbar__search .search-input') as Element

      const follows = (a: Element, b: Element) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

      expect(tabs).toBeTruthy()
      expect(favoriteBtn).toBeTruthy()
      expect(searchInput).toBeTruthy()
      expect(follows(tabs, filterBtn)).toBe(true)
      expect(follows(filterBtn, favoriteBtn)).toBe(true)
      expect(follows(favoriteBtn, searchInput)).toBe(true)
    })
  })

  it('单击标底行（productClass 1，无 lastPrice）不覆盖报单表 limitPrice（Critical #3）', async () => {
    // 预填报单价格，验证标底行单击不会把它归零
    useOrderStore.setState((s) => ({ orderForm: { ...s.orderForm, limitPrice: 1500 } }))
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    act(() => {
      clickHandler({ row: 1, col: 1, event: {} }) // row 1 = FG609（标底行）
    })
    // 选中同步照常，但 limitPrice 保持用户已填值（不被 price=0 覆盖）
    expect(useMarketStore.getState().selectedInstrument).toBe('FG609')
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('FG609')
    expect(useOrderStore.getState().orderForm.limitPrice).toBe(1500)
  })

  it('右键标底行后点击菜单外部 → 关闭标底菜单（Critical #2 外部点击关闭）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    expect(screen.getByText('打开T型报价')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('打开T型报价')).toBeNull()
  })

  it('右键期权行打开单选菜单后，再右键标底行 → 单选菜单关闭，仅剩标底菜单（不叠加，Critical #2）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    // 先右键期权行（row 2 = FG609-C-1300）→ 打开单选菜单（打开报单/K线/查询）
    act(() => {
      contextmenuHandler({ row: 2, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    expect(screen.getByText('打开报单')).toBeInTheDocument()
    // 再右键标底行（row 1 = FG609）→ 单选菜单应关闭，仅剩「打开T型报价」
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 150, clientY: 250, preventDefault: vi.fn() } })
    })
    expect(screen.queryByText('打开报单')).toBeNull()
    expect(screen.queryByText('打开K线')).toBeNull()
    expect(screen.getByText('打开T型报价')).toBeInTheDocument()
  })

  it('右键标底行打开标底菜单后，再右键期权行 → 标底菜单关闭，只显示单选菜单（不叠加，Critical #2）', async () => {
    render(<OptionsPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = instance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })
    expect(screen.getByText('打开T型报价')).toBeInTheDocument()
    act(() => {
      contextmenuHandler({ row: 2, col: 0, event: { clientX: 150, clientY: 250, preventDefault: vi.fn() } })
    })
    expect(screen.queryByText('打开T型报价')).toBeNull()
    expect(screen.getByText('打开报单')).toBeInTheDocument()
  })
})
