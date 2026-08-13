import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TQuoteView } from './TQuoteView'
import { useMarketStore } from '@/modules/market/store'

// TQuoteView 已自包含：不再依赖 useOptionsStore，直接调用 @/services/api。
// 以下 mock 覆盖 TQuoteView 用到的所有 API 函数（subscribeMarket 保留：@/modules/market/store 仍引入）。
const mockGetOptionUnderlyings = vi.fn().mockResolvedValue({ underlyings: ['IF2608', 'IF2609'] })
const mockGetOptionChains = vi.fn().mockResolvedValue({ chains: [] })
const mockSubscribeMarket = vi.fn().mockResolvedValue({ success: true, added: [], alreadySubscribed: [] })
const mockGetSnapshots = vi.fn().mockResolvedValue({ snapshots: {} })

vi.mock('@/services/api', () => ({
  getOptionUnderlyings: (...args: any[]) => mockGetOptionUnderlyings(...args),
  getOptionChains: (...args: any[]) => mockGetOptionChains(...args),
  subscribeMarket: (...args: any[]) => mockSubscribeMarket(...args),
  getSnapshots: (...args: any[]) => mockGetSnapshots(...args),
}))

// Mock TQuoteTable：捕获 props，用于断言「不再接收 volatility（去 IV）」
const mockTQuoteTable = vi.fn()
vi.mock('./TQuoteTable', () => ({
  TQuoteTable: (props: any) => {
    mockTQuoteTable(props)
    return (
      <div data-testid="tquote-table">
        {props.chain.underlying}-{props.chain.expireDate}
      </div>
    )
  },
}))

function renderChain(underlying = 'IF2608', expireDate = '20260815') {
  mockGetOptionChains.mockResolvedValue({
    chains: [{ underlying, expireDate, calls: [], puts: [], updateTime: '' }],
  })
}

describe('TQuoteView (自包含)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMarketStore.setState({ snapshots: new Map(), lockedContracts: new Map() })
    mockGetOptionUnderlyings.mockResolvedValue({ underlyings: ['IF2608', 'IF2609'] })
    mockGetOptionChains.mockResolvedValue({ chains: [] })
  })

  it('renders the options panel container', () => {
    const { container } = render(<TQuoteView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('无 instrumentID prop 时不自动加载期权链（需窗内自选标的）', () => {
    render(<TQuoteView />)
    expect(mockGetOptionChains).not.toHaveBeenCalled()
  })

  it('shows placeholder text when no underlying selected', async () => {
    render(<TQuoteView />)
    expect(await screen.findByText(/请先选择标的合约/)).toBeTruthy()
  })

  it('shows loading text when loading=true', async () => {
    let resolveChains: (v: { chains: any[] }) => void
    mockGetOptionChains.mockReturnValue(new Promise((resolve) => { resolveChains = resolve }))
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    expect(screen.getAllByText(/加载中/).length).toBeGreaterThanOrEqual(1)
    act(() => {
      resolveChains!({ chains: [] })
    })
  })

  it('shows error message when chain fetch fails', async () => {
    mockGetOptionChains.mockRejectedValue(new Error('Failed to load option chains'))
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    expect(await screen.findByText(/Failed to load option chains/)).toBeTruthy()
  })

  it('renders TQuoteTable when chain data is available', async () => {
    renderChain()
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    expect(await screen.findByTestId('tquote-table')).toBeInTheDocument()
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2608-20260815')
  })

  it('renders single table when both underlying and expiry selected', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [
        { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' },
        { underlying: 'IF2608', expireDate: '20260915', calls: [], puts: [], updateTime: '' },
      ],
    })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    const tables = await screen.findAllByTestId('tquote-table')
    expect(tables).toHaveLength(1)
    expect(tables[0].textContent).toBe('IF2608-20260815')
  })

  it('到期日 select 由 optionChains 派生（标底选中后列出该标底全部到期日）', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [
        { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' },
        { underlying: 'IF2608', expireDate: '20260915', calls: [], puts: [], updateTime: '' },
      ],
    })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    const select = await screen.findByLabelText(/到期日/) as HTMLSelectElement
    const dates = Array.from(select.options).map((o) => o.value).filter(Boolean)
    expect(dates).toEqual(['20260815', '20260915'])
  })

  it('instrumentID prop 预选标底：自动加载该标底期权链并选中', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [{ underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' }],
    })
    render(<TQuoteView instrumentID="IF2608" />)
    expect(await screen.findByTestId('tquote-table')).toBeInTheDocument()
    expect(mockGetOptionChains).toHaveBeenCalledWith('IF2608')
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2608-20260815')
  })

  it('shows underlying selector label', async () => {
    render(<TQuoteView />)
    const labels = await screen.findAllByText(/标的/)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('sorts available underlyings lexicographically in dropdown', async () => {
    mockGetOptionUnderlyings.mockResolvedValue({ underlyings: ['MA609', 'cu2609', 'FG609'] })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    const options = Array.from(document.querySelectorAll('.options-search-option')).map((el) => el?.textContent ?? '')
    expect(options).toEqual(['FG609', 'MA609', 'cu2609'])
  })

  it('不向 TQuoteTable 传递 volatility（去 IV 后无消费方）', async () => {
    renderChain()
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    await screen.findByTestId('tquote-table')
    const calls = mockTQuoteTable.mock.calls
    const props = calls[calls.length - 1]?.[0]
    expect(props.volatility).toBeUndefined()
    expect(props.snapshots).toBeInstanceOf(Map)
  })

  it('选择期权链 → 锁定该链全部合约（进入共享订阅管理器记账）', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [{
        underlying: 'IF2608',
        expireDate: '20260815',
        calls: [{ instrumentID: 'IF2608-C-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        puts: [{ instrumentID: 'IF2608-P-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        updateTime: '',
      }],
    })
    render(<TQuoteView instrumentID="IF2608" />)
    await screen.findByTestId('tquote-table')
    const locked = useMarketStore.getState().lockedContracts
    expect(locked.get('IF2608-C-1300')).toBe(1)
    expect(locked.get('IF2608-P-1300')).toBe(1)
  })

  it('切换期权链 → 解锁旧链并锁定新链（无泄漏叠加）', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [{
        underlying: 'IF2608',
        expireDate: '20260815',
        calls: [{ instrumentID: 'IF2608-C-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        puts: [{ instrumentID: 'IF2608-P-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        updateTime: '',
      }],
    })
    const { rerender } = render(<TQuoteView instrumentID="IF2608" />)
    await screen.findByTestId('tquote-table')
    expect(useMarketStore.getState().lockedContracts.get('IF2608-C-1300')).toBe(1)

    mockGetOptionChains.mockResolvedValue({
      chains: [{
        underlying: 'IF2609',
        expireDate: '20260815',
        calls: [{ instrumentID: 'IF2609-C-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        puts: [{ instrumentID: 'IF2609-P-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        updateTime: '',
      }],
    })
    rerender(<TQuoteView instrumentID="IF2609" />)
    // 新链锁定（React effect cleanup 先于新 effect 运行 → 旧链已解锁）
    await waitFor(() => {
      expect(useMarketStore.getState().lockedContracts.get('IF2609-C-1300')).toBe(1)
    })
    const locked = useMarketStore.getState().lockedContracts
    expect(locked.has('IF2608-C-1300')).toBe(false)
    expect(locked.has('IF2608-P-1300')).toBe(false)
  })

  it('卸载组件 → 解锁该链全部合约（管理器按宽限期优雅退订，列表行不冻结）', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [{
        underlying: 'IF2608',
        expireDate: '20260815',
        calls: [{ instrumentID: 'IF2608-C-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        puts: [{ instrumentID: 'IF2608-P-1300', strikePrice: 1300, lastPrice: 0, bidPrice: 0, askPrice: 0, volume: 0, openInterest: 0, impliedVolatility: 0 }],
        updateTime: '',
      }],
    })
    const { unmount } = render(<TQuoteView instrumentID="IF2608" />)
    await screen.findByTestId('tquote-table')
    expect(useMarketStore.getState().lockedContracts.get('IF2608-C-1300')).toBe(1)
    unmount()
    const locked = useMarketStore.getState().lockedContracts
    expect(locked.has('IF2608-C-1300')).toBe(false)
    expect(locked.has('IF2608-P-1300')).toBe(false)
  })
})
