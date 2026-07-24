import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OptionPanel } from './OptionPanel'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot } from '@/services/types'

// Mock the options store
const mockFetchOptionChains = vi.fn()
const mockSetSelectedUnderlying = vi.fn()
const mockSetSelectedExpireDate = vi.fn()
const mockAvailableUnderlyings = vi.fn(() => ['IF2608', 'IF2609'])
const mockAvailableExpirations = vi.fn(() => ['20260815', '20260915'])
const mockAllStrikes = vi.fn(() => [4700, 4800])

let storeState = {
  optionChains: [] as any[],
  selectedUnderlying: null as string | null,
  selectedExpireDate: null as string | null,
  loading: false,
  error: null as string | null,
}

vi.mock('./store', () => ({
  useOptionsStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector({
        ...storeState,
        fetchOptionChains: mockFetchOptionChains,
        setSelectedUnderlying: mockSetSelectedUnderlying,
        setSelectedExpireDate: mockSetSelectedExpireDate,
        availableUnderlyings: mockAvailableUnderlyings,
        availableExpirations: mockAvailableExpirations,
        allStrikes: mockAllStrikes,
      })
    }
    return {
      ...storeState,
      fetchOptionChains: mockFetchOptionChains,
      setSelectedUnderlying: mockSetSelectedUnderlying,
      setSelectedExpireDate: mockSetSelectedExpireDate,
      availableUnderlyings: mockAvailableUnderlyings,
      availableExpirations: mockAvailableExpirations,
      allStrikes: mockAllStrikes,
    }
  },
}))

// Use real useMarketStore — no mock, so setState triggers re-renders via zustand

// Mock TQuoteTable (renders simple div)
vi.mock('./TQuoteTable', () => ({
  TQuoteTable: ({ chain }: { chain: any }) => (
    <div data-testid="tquote-table">{chain.underlying}-{chain.expireDate}</div>
  ),
}))

describe('OptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState = {
      optionChains: [],
      selectedUnderlying: null,
      selectedExpireDate: null,
      loading: false,
      error: null,
    }
  })

  it('renders the options panel container', () => {
    const { container } = render(<OptionPanel />)
    expect(container.firstChild).toBeTruthy()
  })

  it('fetches option chains on mount (all chains, no filter)', () => {
    render(<OptionPanel />)
    expect(mockFetchOptionChains).toHaveBeenCalled()
  })

  it('does not re-fetch on re-render with same state', () => {
    const { rerender } = render(<OptionPanel />)
    rerender(<OptionPanel />)
    // Only called once from the initial mount effect
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(1)
  })

  it('shows loading text when loading=true', () => {
    storeState.loading = true
    render(<OptionPanel />)
    expect(screen.getByText(/加载中/)).toBeTruthy()
  })

  it('shows error message when error is set', () => {
    storeState.error = 'Failed to load'
    render(<OptionPanel />)
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
    render(<OptionPanel />)
    expect(screen.getByTestId('tquote-table')).toBeTruthy()
    expect(screen.getByTestId('tquote-table').textContent).toBe('IF2608-20260815')
  })

  it('shows empty state when no chains and not loading', () => {
    storeState.optionChains = []
    storeState.loading = false
    storeState.error = null
    render(<OptionPanel />)
    expect(screen.getByText(/暂无期权链数据/)).toBeTruthy()
  })

  it('shows underlying selector label', () => {
    storeState.optionChains = [
      { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '2026-07-24T10:00:00' },
    ]
    render(<OptionPanel />)
    const labels = screen.getAllByText(/标的/)
    expect(labels.length).toBeGreaterThan(0)
  })
})

describe('OptionPanel - volatility real-time refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    storeState = {
      optionChains: [
        { underlying: 'IF2608', expireDate: '20260815', calls: [], puts: [], updateTime: '2026-07-24T10:00:00' },
      ],
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

  it('refetches option chains when underlying snapshot changes', () => {
    render(<OptionPanel />)
    // Initial mount fetch
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(1)

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

    expect(mockFetchOptionChains).toHaveBeenCalledTimes(2)
    expect(mockFetchOptionChains).toHaveBeenLastCalledWith('IF2608', '20260815')
  })

  it('debounces rapid snapshot updates (only fetches once)', () => {
    render(<OptionPanel />)
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(1)

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
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(2)
  })

  it('does not refresh when no underlying is selected', () => {
    storeState.selectedUnderlying = null
    storeState.optionChains = []
    render(<OptionPanel />)
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(1) // mount only

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

    // Still only 1 call (mount)
    expect(mockFetchOptionChains).toHaveBeenCalledTimes(1)
  })
})
