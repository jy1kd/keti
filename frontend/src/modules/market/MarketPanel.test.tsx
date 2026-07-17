import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPanel } from './MarketPanel'
import { useMarketStore } from './store'
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
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn().mockResolvedValue({ instruments: [], count: 0 }),
  subscribeMarket: vi.fn().mockResolvedValue({ success: true, added: [], alreadySubscribed: [] }),
  getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  getKlineData: vi.fn().mockResolvedValue({ instrumentID: '', period: '', bars: [] }),
  API_BASE: 'http://localhost:8000',
}))

// Mock useMarketWs
const mockUseMarketWs = vi.fn()
vi.mock('@/hooks/useMarketWs', () => ({
  useMarketWs: (...args: unknown[]) => mockUseMarketWs(...args),
}))

// Mock usePointOrder to avoid side effects
vi.mock('@/hooks/usePointOrder', () => ({
  usePointOrder: () => ({
    handleClick: vi.fn(),
    handleDoubleClick: vi.fn(),
  }),
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
  })

  it('renders panel title', () => {
    render(<MarketPanel />)
    expect(screen.getByText('行情面板')).toBeInTheDocument()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })

  it('启动时调用 fetchInstruments 获取合约列表', () => {
    const fetchSpy = vi.spyOn(useMarketStore.getState(), 'fetchInstruments')
    render(<MarketPanel />)
    expect(fetchSpy).toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('启动时调用 useMarketWs 连接 WebSocket 行情推送', () => {
    render(<MarketPanel />)
    expect(mockUseMarketWs).toHaveBeenCalledWith('ws://localhost:8000', '5m')
  })

  it('renders DepthQuote for selected instrument', () => {
    useMarketStore.setState({
      selectedInstrument: 'IF2608',
      snapshots: new Map([['IF2608', makeSnapshot()]]),
    })
    render(<MarketPanel />)
    // DepthQuote 应显示选中合约的五档行情
    expect(screen.getByTestId('bid-1')).toBeInTheDocument()
    expect(screen.getByTestId('ask-1')).toBeInTheDocument()
  })

  it('renders SpreadDisplay for selected instrument', () => {
    useMarketStore.setState({
      selectedInstrument: 'IF2608',
      snapshots: new Map([['IF2608', makeSnapshot()]]),
    })
    render(<MarketPanel />)
    // SpreadDisplay 应显示价差
    expect(screen.getByText('价差')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // 4696 - 4694
  })

  it('renders resize handle for main/side panel split', () => {
    render(<MarketPanel />)
    const handles = document.querySelectorAll('.resize-handle')
    expect(handles.length).toBeGreaterThanOrEqual(1)
  })
})
