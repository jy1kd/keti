import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarketPanel } from './MarketPanel'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import type { MarketSnapshot } from '@/services/types'

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock react-resizable-panels
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

// Mock useMarketWs
const mockUseMarketWs = vi.fn()
vi.mock('@/hooks/useMarketWs', () => ({
  useMarketWs: (...args: unknown[]) => mockUseMarketWs(...args),
  PERIOD_MS: { '5m': 300000 },
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
    })
    useContractsStore.setState({ contracts: [], favorites: [], isLoaded: false })
    capturedPointOrderOpts = null
    vi.clearAllMocks()
  })

  it('renders panel title', () => {
    render(<MarketPanel />)
    expect(screen.getByText('行情面板')).toBeInTheDocument()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })

  it('启动时调用 loadAllInstruments 和 loadFavoriteContracts 加载合约', () => {
    const loadAllSpy = vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
    const loadFavSpy = vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)
    render(<MarketPanel />)
    expect(loadAllSpy).toHaveBeenCalled()
    expect(loadFavSpy).toHaveBeenCalled()
    loadAllSpy.mockRestore()
    loadFavSpy.mockRestore()
  })

  it('启动时调用 useMarketWs 连接 WebSocket 行情推送', () => {
    render(<MarketPanel />)
    expect(mockUseMarketWs).toHaveBeenCalledWith('ws://localhost:8000')
  })

  it('renders DepthQuote for selected instrument', () => {
    useMarketStore.setState({
      selectedInstrument: 'IF2608',
      snapshots: new Map([['IF2608', makeSnapshot()]]),
    })
    render(<MarketPanel />)
    expect(screen.getByTestId('bid-1')).toBeInTheDocument()
    expect(screen.getByTestId('ask-1')).toBeInTheDocument()
  })

  it('renders resize handle for main/side panel split', () => {
    render(<MarketPanel />)
    const handles = document.querySelectorAll('.resize-handle')
    expect(handles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders 全部合约 and 自选合约 tabs', () => {
    render(<MarketPanel />)
    expect(screen.getByText('全部合约')).toBeInTheDocument()
    expect(screen.getByText('自选合约')).toBeInTheDocument()
  })

  it('renders 搜索合约 button', () => {
    render(<MarketPanel />)
    expect(screen.getByText('搜索合约')).toBeInTheDocument()
  })

  it('点击 搜索合约 按钮打开搜索弹窗', async () => {
    const user = userEvent.setup()
    render(<MarketPanel />)
    expect(screen.queryByTestId('instrument-search-modal')).not.toBeInTheDocument()
    await user.click(screen.getByText('搜索合约'))
    expect(screen.getByTestId('instrument-search-modal')).toBeInTheDocument()
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

  it('双击行情表格行打开报单标签', () => {
    setupContracts()

    render(<MarketPanel />)

    // 通过 capturedPointOrderOpts 模拟双击（包 act 避免异步状态更新警告）
    expect(capturedPointOrderOpts).toBeDefined()
    act(() => {
      capturedPointOrderOpts.onFill({ instrumentID: 'IF2608', price: 4695 })
    })

    const tabs = useTabStore.getState().tabs
    const orderTab = tabs.find(t => t.type === 'order' && t.props?.instrumentID === 'IF2608')
    expect(orderTab).toBeDefined()
    expect(orderTab?.title).toBe('📝 报单-IF2608')
    expect(useTabStore.getState().activeTabId).toBe(orderTab?.id)
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

  it('右键菜单点击「打开报单」打开报单标签', async () => {
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

    const tabs = useTabStore.getState().tabs
    const orderTab = tabs.find(t => t.type === 'order' && t.props?.instrumentID === 'IF2608')
    expect(orderTab).toBeDefined()
    expect(useTabStore.getState().activeTabId).toBe(orderTab?.id)
  })

  it('右键菜单点击「打开K线」打开K线标签', async () => {
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

    const tabs = useTabStore.getState().tabs
    const klineTab = tabs.find(t => t.type === 'kline' && t.props?.instrumentID === 'IF2608')
    expect(klineTab).toBeDefined()
    expect(useTabStore.getState().activeTabId).toBe(klineTab?.id)
  })
})
