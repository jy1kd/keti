import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TQuoteView } from './TQuoteView'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot } from '@/services/types'

// Mock the options store
const mockFetchOptionChains = vi.fn().mockResolvedValue(undefined)
const mockFetchVolatility = vi.fn().mockResolvedValue(undefined)
const mockSetSelectedUnderlying = vi.fn()
const mockSetSelectedExpireDate = vi.fn()
const mockAvailableUnderlyings = vi.fn(() => ['IF2608', 'IF2609'])
const mockAvailableExpirations = vi.fn(() => ['20260815', '20260915'])
const mockAllStrikes = vi.fn(() => [4700, 4800])

let storeState = {
  optionChains: [] as any[],
  volatility: new Map<string, number>(),
  selectedUnderlying: null as string | null,
  selectedExpireDate: null as string | null,
  loading: false,
  error: null as string | null,
}

function getMockState() {
  return {
    ...storeState,
    fetchOptionChains: mockFetchOptionChains,
    fetchVolatility: mockFetchVolatility,
    setSelectedUnderlying: mockSetSelectedUnderlying,
    setSelectedExpireDate: mockSetSelectedExpireDate,
    availableUnderlyings: mockAvailableUnderlyings,
    availableExpirations: mockAvailableExpirations,
    allStrikes: mockAllStrikes,
  }
}

vi.mock('./store', () => ({
  useOptionsStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector(getMockState())
      }
      return getMockState()
    },
    { getState: () => getMockState() }
  ),
}))

// Use real useMarketStore — no mock, so setState triggers re-renders via zustand

// Mock subscribeMarket and getOptionUnderlyings
const mockSubscribeMarket = vi.fn().mockResolvedValue({ success: true, added: [], alreadySubscribed: [] })
const mockGetOptionUnderlyings = vi.fn().mockResolvedValue({ underlyings: ['IF2608', 'IF2609'] })
vi.mock('@/services/api', () => ({
  subscribeMarket: (...args: any[]) => mockSubscribeMarket(...args),
  getOptionUnderlyings: (...args: any[]) => mockGetOptionUnderlyings(...args),
}))

// Mock TQuoteTable (renders simple div)
vi.mock('./TQuoteTable', () => ({
  TQuoteTable: ({ chain }: { chain: any }) => (
    <div data-testid="tquote-table">{chain.underlying}-{chain.expireDate}</div>
  ),
}))

describe('TQuoteView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState = {
      optionChains: [],
      volatility: new Map(),
      selectedUnderlying: null,
      selectedExpireDate: null,
      loading: false,
      error: null,
    }
  })

  it('renders the options panel container', () => {
    const { container } = render(<TQuoteView />)
    expect(container.firstChild).toBeTruthy()
  })

  it('does not auto-fetch option chains on mount', () => {
    render(<TQuoteView />)
    expect(mockFetchOptionChains).not.toHaveBeenCalled()
  })

  it('shows placeholder text when no underlying selected', () => {
    render(<TQuoteView />)
    expect(screen.getByText(/请先选择标的合约/)).toBeTruthy()
  })

  it('shows placeholder text when underlying selected but no expiry', () => {
    storeState.selectedUnderlying = 'IF2608'
    render(<TQuoteView />)
    // There are two elements with this text: the <option> in dropdown and the <div> placeholder
    const elements = screen.getAllByText(/请选择到期日/)
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading text when loading=true', () => {
    storeState.loading = true
    render(<TQuoteView />)
    // There are two elements with this text: the <option> in dropdown and the <div> content
    const elements = screen.getAllByText(/加载中/)
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows error message when error is set', () => {
    storeState.error = 'Failed to load'
    render(<TQuoteView />)
    expect(screen.getByText(/Failed to load/)).toBeTruthy()
  })

  it('renders TQuoteTable when chain data is available', () => {
    storeState.optionChains = [
      {
        underlying: 'IF2608',
        expireDate: '20260815',
        calls: [],
        puts: [],
      },
    ]
    storeState.selectedUnderlying = 'IF2608'
    storeState.selectedExpireDate = '20260815'
    render(<TQuoteView />)
    expect(screen.getByTestId('tquote-table')).toBeTruthy()
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2608-20260815')
  })

  it('shows underlying selector label', () => {
    render(<TQuoteView />)
    const labels = screen.getAllByText(/标的/)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('shows no match message when selection has no matching chain', () => {
    storeState.selectedUnderlying = 'IF2609'
    storeState.selectedExpireDate = '20261215'
    render(<TQuoteView />)
    expect(screen.getByText(/无匹配/)).toBeTruthy()
  })

  it('renders single table when both underlying and expiry selected', () => {
    storeState.optionChains = [
      { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [] },
      { underlying: 'IF2608', expireDate: '20260915', calls: [], puts: [] },
    ]
    storeState.selectedUnderlying = 'IF2608'
    storeState.selectedExpireDate = '20260815'
    render(<TQuoteView />)
    const tables = screen.getAllByTestId('tquote-table')
    expect(tables).toHaveLength(1)
    expect(tables[0].textContent).toBe('IF2608-20260815')
  })
})

describe('TQuoteView - volatility real-time refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    storeState = {
      optionChains: [
        { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [] },
      ],
      volatility: new Map(),
      selectedUnderlying: 'IF2608',
      selectedExpireDate: '20260815',
      loading: false,
      error: null,
    }
    useMarketStore.setState({ snapshots: new Map() })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refetches volatility when underlying snapshot changes', () => {
    render(<TQuoteView />)
    // Mount: subscribe effect fetchVolatility ×1
    expect(mockFetchVolatility).toHaveBeenCalledTimes(1)

    // Simulate underlying snapshot update via real zustand store
    act(() => {
      useMarketStore.setState({
        snapshots: new Map([
          ['IF2608', { instrumentID: 'IF2608', lastPrice: 4800 } as MarketSnapshot],
        ]),
      })
    })

    // Advance timers to trigger debounce
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(mockFetchVolatility).toHaveBeenCalledTimes(2)
    expect(mockFetchVolatility).toHaveBeenLastCalledWith('IF2608')
  })

  it('debounces rapid snapshot updates (only fetches once)', () => {
    render(<TQuoteView />)
    expect(mockFetchVolatility).toHaveBeenCalledTimes(1)

    // Simulate rapid snapshot updates
    act(() => {
      useMarketStore.setState({
        snapshots: new Map([
          ['IF2608', { instrumentID: 'IF2608', lastPrice: 4800 } as MarketSnapshot],
        ]),
      })
    })
    act(() => {
      useMarketStore.setState({
        snapshots: new Map([
          ['IF2608', { instrumentID: 'IF2608', lastPrice: 4801 } as MarketSnapshot],
        ]),
      })
    })
    act(() => {
      useMarketStore.setState({
        snapshots: new Map([
          ['IF2608', { instrumentID: 'IF2608', lastPrice: 4802 } as MarketSnapshot],
        ]),
      })
    })

    // Only advance past debounce window once
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Should only have fetched once more (debounced), not 3 times
    expect(mockFetchVolatility).toHaveBeenCalledTimes(2)
  })

  it('does not refresh when no underlying is selected', () => {
    storeState.selectedUnderlying = null
    storeState.optionChains = []
    render(<TQuoteView />)
    // No subscribe effect (no chain)
    expect(mockFetchVolatility).not.toHaveBeenCalled()

    act(() => {
      useMarketStore.setState({
        snapshots: new Map([
          ['IF2608', { instrumentID: 'IF2608', lastPrice: 4800 } as MarketSnapshot],
        ]),
      })
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Still no fetch
    expect(mockFetchVolatility).not.toHaveBeenCalled()
  })
})
