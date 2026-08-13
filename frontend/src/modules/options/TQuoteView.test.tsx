import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TQuoteView } from './TQuoteView'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'

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

  it('标底多到期日时默认取首条链（无到期日选择器），只渲染单表', async () => {
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

  it('同标底多到期日乱序时按最早到期日确定选链（不依赖响应顺序）', async () => {
    mockGetOptionChains.mockResolvedValue({
      chains: [
        { underlying: 'IF2608', expireDate: '20260915', calls: [], puts: [], updateTime: '' },
        { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' },
        { underlying: 'IF2608', expireDate: '20261215', calls: [], puts: [], updateTime: '' },
      ],
    })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    const tables = await screen.findAllByTestId('tquote-table')
    expect(tables).toHaveLength(1)
    // 选中最早到期日（20260815），而非响应顺序的首条（20260915）
    expect(tables[0].textContent).toBe('IF2608-20260815')
  })

  it('无到期日选择器（去 到期日 select）', async () => {
    renderChain()
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2608'))
    await screen.findByTestId('tquote-table')
    expect(screen.queryByLabelText(/到期日/)).toBeNull()
    expect(screen.queryByRole('option', { name: /请选择到期日/ })).toBeNull()
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

  it('selectUnderlying 请求竞态：慢响应的旧标底不覆盖新选标底', async () => {
    // 标底 A（IF2608）的请求挂起（慢响应）；标底 B（IF2609）的请求立即返回
    let resolveA: (v: { chains: any[] }) => void
    const slowA = new Promise<{ chains: any[] }>((resolve) => { resolveA = resolve })
    mockGetOptionChains.mockReturnValueOnce(slowA)
    mockGetOptionChains.mockResolvedValue({
      chains: [{ underlying: 'IF2609', expireDate: '20260915', calls: [], puts: [], updateTime: '' }],
    })
    const user = userEvent.setup()
    // 挂载预选 A（IF2608）→ getOptionChains('IF2608') 挂起
    render(<TQuoteView instrumentID="IF2608" />)
    expect(mockGetOptionChains).toHaveBeenCalledWith('IF2608')

    // 切到 B（IF2609）：B 响应先到 → 渲染 B 的表
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    await user.click(screen.getByText('IF2609'))
    expect(await screen.findByTestId('tquote-table')).toBeInTheDocument()
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2609-20260915')

    // A 的慢响应晚到 → 必须被忽略（请求序列守卫），不覆盖为 IF2608
    act(() => {
      resolveA!({ chains: [{ underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' }] })
    })
    await screen.findByTestId('tquote-table')
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2609-20260915')
    const lastProps = mockTQuoteTable.mock.calls[mockTQuoteTable.mock.calls.length - 1]?.[0]
    expect(lastProps.chain.underlying).toBe('IF2609')
  })

  it('窗内切换标底 → updateTab 同步悬浮标签标题与 props（tabId + 新合约）', async () => {
    mockGetOptionUnderlyings.mockResolvedValue({ underlyings: ['IF2608', 'IF2609', 'MA609'] })
    mockGetOptionChains.mockResolvedValue({
      chains: [{ underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '' }],
    })
    const updateTabSpy = vi.spyOn(useTabStore.getState(), 'updateTab')
    try {
      const user = userEvent.setup()
      render(<TQuoteView instrumentID="IF2608" tabId="tab-tquote-IF2608" />)
      await screen.findByTestId('tquote-table')
      // 挂载预选已同步一次标题（IF2608），清掉后只验证「窗内切标底」
      updateTabSpy.mockClear()

      const input = await screen.findByPlaceholderText('输入关键字搜索...')
      await user.click(input)
      await user.click(screen.getByText('MA609'))

      expect(updateTabSpy).toHaveBeenCalledWith('tab-tquote-IF2608', {
        title: '📉 T型报价-MA609',
        props: { instrumentID: 'MA609' },
      })
    } finally {
      updateTabSpy.mockRestore()
    }
  })

  it('shows underlying selector label', async () => {
    render(<TQuoteView />)
    const labels = await screen.findAllByText(/标的/)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('按不区分大小写自然序排序标底下拉（cu2609 在 FG609 前）', async () => {
    mockGetOptionUnderlyings.mockResolvedValue({ underlyings: ['MA609', 'cu2609', 'FG609'] })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    const options = Array.from(document.querySelectorAll('.options-search-option')).map((el) => el?.textContent ?? '')
    expect(options).toEqual(['cu2609', 'FG609', 'MA609'])
  })

  it('标底 a 开头小写排在 FG610 等大写之前（case-insensitive 字典序）', async () => {
    mockGetOptionUnderlyings.mockResolvedValue({ underlyings: ['FG610', 'ad2608', 'MA609'] })
    const user = userEvent.setup()
    render(<TQuoteView />)
    const input = await screen.findByPlaceholderText('输入关键字搜索...')
    await user.click(input)
    const options = Array.from(document.querySelectorAll('.options-search-option')).map((el) => el?.textContent ?? '')
    expect(options).toEqual(['ad2608', 'FG610', 'MA609'])
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
