import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarketPanel } from './MarketPanel'
import { futuresSpec } from './futuresSpec'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore } from '@/stores/collections'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { openFloatingTab } from '@/utils/openFloatingTab'
import type { MarketSnapshot } from '@/services/types'

// Mock 统一浮动窗入口（双击/右键「打开报单」现为打开浮动窗口）
vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: vi.fn(),
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
}))

const mockOpenFloatingTab = vi.mocked(openFloatingTab)

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock api module
const mockSubscribeMarket = vi.fn().mockResolvedValue({ success: true, added: [], alreadySubscribed: [] })
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn().mockResolvedValue({ instruments: [], count: 0 }),
  subscribeMarket: (...args: unknown[]) => mockSubscribeMarket(...args),
  getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  getKlineData: vi.fn().mockResolvedValue({ instrumentID: '', period: '', bars: [] }),
  API_BASE: 'http://localhost:8000',
}))

// Mock usePointOrder — capture callbacks for PR-R13 tests
let capturedPointOrderOpts: any = null
vi.mock('@/hooks/usePointOrder', () => ({
  usePointOrder: (opts?: any) => {
    capturedPointOrderOpts = opts
    return {
      handleClick: vi.fn(),
      handleDoubleClick: vi.fn(),
    }
  },
}))

// Mock InstrumentSearchModal
vi.mock('@/components/InstrumentSearchModal', () => ({
  InstrumentSearchModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; onSubscribe: (inst: unknown) => void; subscribedIds: Set<string> }) =>
    isOpen ? (
      <div data-testid="instrument-search-modal">
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null,
}))

// Mock echarts
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

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
    bidPrice1: 4694, bidVolume1: 10,
    bidPrice2: 4693, bidVolume2: 20,
    bidPrice3: 4692, bidVolume3: 30,
    bidPrice4: 4691, bidVolume4: 40,
    bidPrice5: 4690, bidVolume5: 50,
    askPrice1: 4696, askVolume1: 15,
    askPrice2: 4697, askVolume2: 25,
    askPrice3: 4698, askVolume3: 35,
    askPrice4: 4699, askVolume4: 45,
    askPrice5: 4700, askVolume5: 55,
    volume: 5000,
    openInterest: 3000,
    ...overrides,
  } as MarketSnapshot
}

describe('MarketPanel', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
      scrollEndSeq: 0,
    })
    useContractsStore.setState({ contracts: [], isLoaded: false })
    useCollectionsStore.setState({ collections: [], loaded: true })
    useMarketFilterStore.setState({
      futures: { exchanges: [], products: [] },
      options: { exchanges: [], products: [] },
    })
    capturedPointOrderOpts = null
    vi.clearAllMocks()
  })

  it('删除冗余「行情面板」标题；无 行情/T型期权 模式切换按钮（期货/期权为独立固定标签）', () => {
    render(<MarketPanel />)
    expect(screen.queryByText('行情面板')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '行情' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'T型期权' })).toBeNull()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })

  it('已去除 [全部|自选] 内部视图切换按钮', () => {
    render(<MarketPanel />)
    expect(screen.queryByRole('button', { name: '自选' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '全部' })).not.toBeInTheDocument()
  })

  it('renders 高级搜索按钮（合并搜索入口）', () => {
    render(<MarketPanel />)
    expect(screen.getByTitle('搜索合约')).toBeInTheDocument()
  })

  it('搜索下拉选择合约后：selectedContracts 同步为单选集（锚点守卫通过才能滚动跳转）', async () => {
    vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    useContractsStore.setState({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 1, productClass: '1' },
        { instrumentID: 'IF2609', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 1, productClass: '1' },
      ],
      isLoaded: true,
    })
    useMarketStore.setState({
      snapshots: new Map(),
      selectedInstrument: null,
      selectedContracts: new Set(),
    })

    // jsdom 无 scrollIntoView：ContractSearch 高亮项滚动 effect 依赖它
    const scrollIntoViewStub = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewStub

    const user = userEvent.setup()
    render(<MarketPanel />)

    // 输入关键词 → 下拉出现 → 点击结果
    const input = screen.getByPlaceholderText('搜索合约...')
    await user.type(input, 'IF2608')
    await user.click(screen.getByText('IF2608'))

    // 选中合约需同步进 selectedContracts（单选集）——MarketTable 锚点守卫
    // shouldRenderAnchor 要求 selectedInstrument ∈ selectedContracts，否则 selectRow+scroll 被跳过 → 表格不跳转
    expect(useMarketStore.getState().selectedInstrument).toBe('IF2608')
    expect(useMarketStore.getState().selectedContracts.has('IF2608')).toBe(true)
    expect(useMarketStore.getState().selectedContracts.size).toBe(1)
  })

  it('点击 高级 按钮打开搜索弹窗', async () => {
    const user = userEvent.setup()
    render(<MarketPanel />)
    expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
  })

  // --- 标签页打开方式测试 (PR-R13) ---

  /** 设置测试合约数据并阻止 loadAllInstruments 覆盖 */
  function setupContracts() {
    vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    useContractsStore.setState({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260821', isTrading: 1, productClass: '1' },
      ],
      isLoaded: true,
    })
    useMarketStore.setState({
      snapshots: new Map([['IF2608', makeSnapshot()]]),
      selectedInstrument: null,
    })
  }

  it('双击行情表格行打开报单浮动窗口', () => {
    setupContracts()

    render(<MarketPanel />)

    // 通过 capturedPointOrderOpts 模拟双击（包 act 避免异步状态更新警告）
    expect(capturedPointOrderOpts).toBeDefined()
    act(() => {
      capturedPointOrderOpts.onFill({ instrumentID: 'IF2608', price: 4695 })
    })

    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'order',
      title: '📝 五档下单-IF2608',
      props: { instrumentID: 'IF2608' },
      size: { w: 620, h: 540 },
    })
  })

  it('右键行情表格行显示上下文菜单', async () => {
    setupContracts()

    render(<MarketPanel />)

    // 模拟右键菜单事件
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]

    expect(contextmenuHandler).toBeDefined()

    // 触发右键
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })

    // 应该显示上下文菜单（拆为 五档下单 / 无限下单）
    expect(screen.getByText('五档下单')).toBeInTheDocument()
    expect(screen.getByText('无限下单')).toBeInTheDocument()
    expect(screen.getByText('打开K线')).toBeInTheDocument()
  })

  it('右键菜单点击「五档下单」打开五档下单浮动窗口', async () => {
    setupContracts()

    const user = userEvent.setup()
    render(<MarketPanel />)

    // 触发右键菜单
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })

    // 点击「五档下单」
    await user.click(screen.getByText('五档下单'))

    // 应打开五档下单浮动窗口
    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'order',
      title: '📝 五档下单-IF2608',
      props: { instrumentID: 'IF2608' },
      size: { w: 620, h: 540 },
    })
  })

  it('右键菜单点击「无限下单」打开无限下单浮动窗口', async () => {
    setupContracts()

    const user = userEvent.setup()
    render(<MarketPanel />)

    // 触发右键菜单
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })

    // 点击「无限下单」
    await user.click(screen.getByText('无限下单'))

    // 应打开无限下单浮动窗口
    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'infinite',
      title: '♾️ 无限下单-IF2608',
      props: { instrumentID: 'IF2608' },
    })
  })

  it('右键菜单点击「打开K线」打开K线浮动窗口', async () => {
    setupContracts()

    const user = userEvent.setup()
    render(<MarketPanel />)

    // 触发右键菜单
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]
    act(() => {
      contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200, preventDefault: vi.fn() } })
    })

    // 点击「打开K线」
    await user.click(screen.getByText('打开K线'))

    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'kline',
      title: '📈 K线-IF2608',
      props: { instrumentID: 'IF2608' },
    })
  })

  it('⭐ 列点击 → 打开 CollectionPicker（选夹面板）', async () => {
    setupContracts()
    render(<MarketPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
    expect(clickHandler).toBeDefined()
    act(() => {
      clickHandler({ row: 1, col: futuresSpec.columns.length - 1, event: {} })
    })
    // 单选面板标题「收藏到收藏夹」出现（IF2608）
    expect(screen.getByText('收藏到收藏夹')).toBeInTheDocument()
  })

  describe('交易所+品种多选筛选（Task 7）', () => {
    /** 三合约跨两交易所/两品种，用于筛选断言 */
    function setupFilterContracts() {
      useContractsStore.setState({
        contracts: [
          { instrumentID: 'cu2609', instrumentName: '沪铜2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '1' },
          { instrumentID: 'FG609', instrumentName: '玻璃609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
          { instrumentID: 'MA609', instrumentName: '甲醇609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
        ],
        isLoaded: true,
      })
    }

    /** 读取最近一次 setRecords 的合约 ID 序列 */
    function latestRecordIDs(instance: any): string[] {
      const last = instance.setRecords.mock.calls.at(-1)?.[0] ?? []
      return last.map((r: any) => r.instrumentID)
    }

    it('渲染「筛选」按钮，空筛选无徽标', () => {
      render(<MarketPanel />)
      expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
      expect(screen.queryByTestId('contract-filter-badge')).toBeNull()
    })

    it('期货页只展示期货合约：期权合约不进入期货表', async () => {
      useContractsStore.setState({
        contracts: [
          { instrumentID: 'FG609', instrumentName: '玻璃609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
          { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609' },
        ],
        isLoaded: true,
      })
      render(<MarketPanel />)
      const { ListTable } = await import('@visactor/vtable')
      const options = (ListTable as any).mock.calls[0][1]
      const ids = options.records.map((r: any) => r.instrumentID)
      expect(ids).toEqual(['FG609'])
    })

    it('按交易所过滤：勾选 SHFE 后表格只剩 cu2609', async () => {
      setupFilterContracts()
      const user = userEvent.setup()
      render(<MarketPanel />)
      await user.click(screen.getByRole('button', { name: /筛选/ }))
      await user.click(screen.getByRole('checkbox', { name: 'SHFE' }))
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      expect(latestRecordIDs(instance)).toEqual(['cu2609'])
    })

    it('按品种过滤（勾选 玻璃）→ 徽标显示 1 + 表格只剩 FG609；清空恢复全部', async () => {
      setupFilterContracts()
      const user = userEvent.setup()
      render(<MarketPanel />)
      await user.click(screen.getByRole('button', { name: /筛选/ }))
      await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
      expect(screen.getByTestId('contract-filter-badge')).toHaveTextContent('1')
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      expect(latestRecordIDs(instance)).toEqual(['FG609'])

      await user.click(screen.getByRole('button', { name: '清空' }))
      expect(latestRecordIDs(instance)).toEqual(['cu2609', 'FG609', 'MA609'])
    })
  })

  describe('顶部菜单行情切换（onMarketView）', () => {
    /** 期货/期权双固定标签（Task 2 默认态） */
    function setupTabs(activeTabId: string) {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
          { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
        ],
        activeTabId,
      })
    }

    it('view=options → 激活期权标签（tab-options），不切期货页内部视图', () => {
      setupTabs('tab-market')
      const onMarketView = vi.fn()
      ;(window as any).electronAPI = { onMarketView }
      render(<MarketPanel />)
      const callback = onMarketView.mock.calls[0][0]

      act(() => {
        callback('options')
      })
      expect(useTabStore.getState().activeTabId).toBe('tab-options')
      delete (window as any).electronAPI
    })

    it('view=all → 激活期货标签', () => {
      setupTabs('tab-options')
      const onMarketView = vi.fn()
      ;(window as any).electronAPI = { onMarketView }
      render(<MarketPanel />)
      const callback = onMarketView.mock.calls[0][0]

      act(() => {
        callback('all')
      })
      expect(useTabStore.getState().activeTabId).toBe('tab-market')

      delete (window as any).electronAPI
    })
  })

  describe('工具行布局（Task 8：功能靠左、搜索贴右）', () => {
    it('DOM 顺序：筛选 → 收藏夹过滤 → 搜索框', () => {
      // 工具栏收藏按钮已收敛为「选择收藏夹」下拉（CollectionFilterSelect），
      // 与三个查询浮窗语义一致；无收藏夹时不渲染，故此处不直接断言 select 存在。
      const { container } = render(<MarketPanel />)
      const toolbar = container.querySelector('.market-toolbar') as HTMLElement
      const filterBtn = screen.getByRole('button', { name: /筛选/ })
      const searchBox = toolbar.querySelector('.market-toolbar__search') as Element
      const searchInput = toolbar.querySelector('.market-toolbar__search .search-input') as Element

      const follows = (a: Element, b: Element) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

      expect(filterBtn).toBeTruthy()
      expect(searchInput).toBeTruthy()
      expect(follows(filterBtn, searchBox)).toBe(true)
    })

    it('有收藏夹时工具栏渲染收藏夹过滤下拉；选择夹后表格只保留该夹合约', async () => {
      // 注入两个收藏夹：农产品含 cu2609 + FG609，黑色系含 RB2610
      useCollectionsStore.setState({
        collections: [
          { id: 'a', name: '农产品', instrumentIDs: ['cu2609', 'FG609'] },
          { id: 'b', name: '黑色系', instrumentIDs: ['RB2610'] },
        ],
        loaded: true,
      })
      useContractsStore.setState({
        contracts: [
          { instrumentID: 'cu2609', instrumentName: '沪铜2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20260930', isTrading: 1, productClass: '1' },
          { instrumentID: 'FG609', instrumentName: '玻璃609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
          { instrumentID: 'RB2610', instrumentName: '螺纹2610', exchangeID: 'SHFE', productID: 'RB', volumeMultiple: 10, priceTick: 1, expireDate: '20261015', isTrading: 1, productClass: '1' },
        ],
        isLoaded: true,
      })
      const user = userEvent.setup()
      render(<MarketPanel />)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select).toBeInTheDocument()
      // 切到「黑色系」→ 表格只保留 RB2610
      await user.selectOptions(select, 'b')
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      const last = instance.setRecords.mock.calls.at(-1)?.[0] ?? []
      expect(last.map((r: any) => r.instrumentID)).toEqual(['RB2610'])
      // 切回「全部」→ 恢复全量（交易所顺序 SHFE→CZCE，同交易所按品种字典序）
      await user.selectOptions(select, '')
      const lastAfter = instance.setRecords.mock.calls.at(-1)?.[0] ?? []
      expect(lastAfter.map((r: any) => r.instrumentID)).toEqual(['cu2609', 'RB2610', 'FG609'])
    })
  })
})
