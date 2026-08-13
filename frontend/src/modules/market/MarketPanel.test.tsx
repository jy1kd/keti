import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarketPanel } from './MarketPanel'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
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

// Mock OptionPanel（T型期权模式切换测试）
vi.mock('@/modules/options/OptionPanel', () => ({
  OptionPanel: () => <div data-testid="option-panel">OptionPanel Mock</div>,
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
    useContractsStore.setState({ contracts: [], favorites: [], isLoaded: false })
    capturedPointOrderOpts = null
    vi.clearAllMocks()
  })

  it('删除冗余「行情面板」标题（合并为单条工具栏）', () => {
    render(<MarketPanel />)
    expect(screen.queryByText('行情面板')).not.toBeInTheDocument()
    // 行情/期权模式切换保留在工具栏内
    expect(screen.getByText('行情')).toBeInTheDocument()
    expect(screen.getByText('T型期权')).toBeInTheDocument()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })

  it('renders 全部 and 自选 tabs', () => {
    render(<MarketPanel />)
    expect(screen.getByText('全部')).toBeInTheDocument()
    expect(screen.getByText('自选')).toBeInTheDocument()
  })

  it('renders 高级搜索按钮（合并搜索入口）', () => {
    render(<MarketPanel />)
    expect(screen.getByTitle('搜索合约')).toBeInTheDocument()
  })

  it('搜索下拉选择合约后：selectedContracts 同步为单选集（锚点守卫通过才能滚动跳转）', async () => {
    vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)
    useContractsStore.setState({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 1, productClass: '1' },
        { instrumentID: 'IF2609', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 1, productClass: '1' },
      ],
      favorites: [],
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

  // --- 状态过滤开关 tests ---

  /** 设置混合合约（交易中 + 已停牌），返回 vtable options 以检查过滤结果 */
  function setupMixedContracts() {
    vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)
    useContractsStore.setState({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 1, productClass: '1' },
        { instrumentID: 'IF9999', instrumentName: '停牌合约', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '99991231', isTrading: 0, productClass: '1' },
      ],
      favorites: [],
      isLoaded: true,
    })
    useMarketStore.setState({
      snapshots: new Map(),
      selectedInstrument: null,
    })
  }

  it('渲染状态过滤开关按钮', () => {
    render(<MarketPanel />)
    expect(screen.getByText('显示全部')).toBeInTheDocument()
  })

  it('默认关闭过滤，显示全部合约（含已停牌）', async () => {
    setupMixedContracts()
    render(<MarketPanel />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const ids = options.records.map((r: any) => r.instrumentID)
    expect(ids).toEqual(['IF2608', 'IF9999'])
  })

  it('点击过滤开关切换为仅显示交易中合约', async () => {
    setupMixedContracts()
    const user = userEvent.setup()
    render(<MarketPanel />)
    // 默认显示全部
    await user.click(screen.getByText('显示全部'))
    expect(screen.getByText('仅交易中')).toBeInTheDocument()
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    // 过滤切换后通过 setRecords 更新表格记录
    const lastRecords = instance.setRecords.mock.calls.at(-1)?.[0] ?? []
    const ids = lastRecords.map((r: any) => r.instrumentID)
    expect(ids).toEqual(['IF2608'])
  })

  it('点击 高级 按钮打开搜索弹窗', async () => {
    const user = userEvent.setup()
    render(<MarketPanel />)
    expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
  })

  it('点击 T型期权 切换到期权模式，行情工具栏保留模式切换', async () => {
    const user = userEvent.setup()
    render(<MarketPanel />)
    expect(screen.queryByTestId('option-panel')).not.toBeInTheDocument()
    await user.click(screen.getByText('T型期权'))
    expect(screen.getByTestId('option-panel')).toBeInTheDocument()
    expect(screen.getByText('行情')).toBeInTheDocument()
    expect(screen.getByText('T型期权')).toBeInTheDocument()
  })

  // --- 标签页打开方式测试 (PR-R13) ---

  /** 设置测试合约数据并阻止 loadAllInstruments/loadFavoriteContracts 覆盖 */
  function setupContracts() {
    vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)
    useContractsStore.setState({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260821', isTrading: 1, productClass: '1' },
      ],
      favorites: [],
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
      title: '📝 报单-IF2608',
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

    // 应该显示上下文菜单
    expect(screen.getByText('打开报单')).toBeInTheDocument()
    expect(screen.getByText('打开K线')).toBeInTheDocument()
  })

  it('右键菜单点击「打开报单」打开报单浮动窗口', async () => {
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

    // 点击「打开报单」
    await user.click(screen.getByText('打开报单'))

    // 应打开报单浮动窗口
    expect(mockOpenFloatingTab).toHaveBeenCalledWith({
      type: 'order',
      title: '📝 报单-IF2608',
      props: { instrumentID: 'IF2608' },
      size: { w: 620, h: 540 },
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

  describe('顶部菜单行情切换（onMarketView）', () => {
    it('在行情主页内切换 全部/自选/T型期权，不新建标签页', () => {
      const onMarketView = vi.fn()
      ;(window as any).electronAPI = { onMarketView }
      render(<MarketPanel />)
      const callback = onMarketView.mock.calls[0][0]

      act(() => {
        callback('options')
      })
      expect(screen.getByTestId('option-panel')).toBeInTheDocument()

      act(() => {
        callback('favorites')
      })
      expect(screen.queryByTestId('option-panel')).toBeNull()
      expect(screen.getByRole('button', { name: '自选' }).classList.contains('active')).toBe(true)

      act(() => {
        callback('all')
      })
      expect(screen.getByRole('button', { name: '全部' }).classList.contains('active')).toBe(true)

      delete (window as any).electronAPI
    })
  })
})
