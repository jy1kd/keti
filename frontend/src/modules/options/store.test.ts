import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOptionsStore } from './store'
import type { OptionChain, OptionQuote } from '@/services/types'

// Mock API module
vi.mock('@/services/api', () => ({
  get: vi.fn(),
}))

import { get } from '@/services/api'

function makeQuote(overrides: Partial<OptionQuote> = {}): OptionQuote {
  return {
    instrumentID: 'IF2608-C-4800',
    strikePrice: 4800,
    lastPrice: 120.5,
    bidPrice: 120.0,
    askPrice: 121.0,
    volume: 500,
    openInterest: 3000,
    impliedVolatility: 0.25,
    ...overrides,
  }
}

function makeChain(overrides: Partial<OptionChain> = {}): OptionChain {
  return {
    underlying: 'IF2608',
    expireDate: '20260815',
    calls: [
      makeQuote({ instrumentID: 'IF2608-C-4700', strikePrice: 4700, lastPrice: 180.0 }),
      makeQuote({ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5 }),
    ],
    puts: [
      makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, lastPrice: 80.0 }),
      makeQuote({ instrumentID: 'IF2608-P-4800', strikePrice: 4800, lastPrice: 130.0 }),
    ],
    ...overrides,
  }
}

describe('OptionsStore', () => {
  beforeEach(() => {
    useOptionsStore.setState({
      optionChains: [],
      selectedUnderlying: null,
      selectedExpireDate: null,
      loading: false,
      error: null,
    })
    vi.mocked(get).mockReset()
  })

  // --- initial state ---

  it('has empty optionChains by default', () => {
    expect(useOptionsStore.getState().optionChains).toEqual([])
  })

  it('has null selectedUnderlying by default', () => {
    expect(useOptionsStore.getState().selectedUnderlying).toBeNull()
  })

  it('has null selectedExpireDate by default', () => {
    expect(useOptionsStore.getState().selectedExpireDate).toBeNull()
  })

  it('has loading=false by default', () => {
    expect(useOptionsStore.getState().loading).toBe(false)
  })

  it('has null error by default', () => {
    expect(useOptionsStore.getState().error).toBeNull()
  })

  // --- selectors ---

  it('setSelectedUnderlying updates underlying', () => {
    useOptionsStore.getState().setSelectedUnderlying('IF2608')
    expect(useOptionsStore.getState().selectedUnderlying).toBe('IF2608')
  })

  it('setSelectedUnderlying clears underlying with null', () => {
    useOptionsStore.getState().setSelectedUnderlying('IF2608')
    useOptionsStore.getState().setSelectedUnderlying(null)
    expect(useOptionsStore.getState().selectedUnderlying).toBeNull()
  })

  it('setSelectedExpireDate updates expireDate', () => {
    useOptionsStore.getState().setSelectedExpireDate('20260815')
    expect(useOptionsStore.getState().selectedExpireDate).toBe('20260815')
  })

  it('clearError resets error to null', () => {
    useOptionsStore.setState({ error: 'some error' })
    useOptionsStore.getState().clearError()
    expect(useOptionsStore.getState().error).toBeNull()
  })

  // --- fetchOptionChains ---

  it('fetchOptionChains calls API and stores chains', async () => {
    const chains = [makeChain()]
    vi.mocked(get).mockResolvedValue({ chains })

    await useOptionsStore.getState().fetchOptionChains('IF2608')

    expect(get).toHaveBeenCalledWith('/api/market/option_chain', {
      underlying: 'IF2608',
      expire_date: undefined,
    })
    expect(useOptionsStore.getState().optionChains).toEqual(chains)
    expect(useOptionsStore.getState().loading).toBe(false)
  })

  it('fetchOptionChains passes expire_date when provided', async () => {
    vi.mocked(get).mockResolvedValue({ chains: [] })

    await useOptionsStore.getState().fetchOptionChains('IF2608', '20260815')

    expect(get).toHaveBeenCalledWith('/api/market/option_chain', {
      underlying: 'IF2608',
      expire_date: '20260815',
    })
  })

  it('fetchOptionChains fetches all chains when no underlying provided', async () => {
    vi.mocked(get).mockResolvedValue({ chains: [] })

    await useOptionsStore.getState().fetchOptionChains()

    expect(get).toHaveBeenCalledWith('/api/market/option_chain', {
      underlying: undefined,
      expire_date: undefined,
    })
  })

  it('fetchOptionChains sets loading=true during fetch', async () => {
    let resolvePromise: (value: unknown) => void
    const promise = new Promise((resolve) => { resolvePromise = resolve })
    vi.mocked(get).mockReturnValue(promise as Promise<unknown>)

    const fetchPromise = useOptionsStore.getState().fetchOptionChains('IF2608')
    expect(useOptionsStore.getState().loading).toBe(true)

    resolvePromise!({ chains: [makeChain()] })
    await fetchPromise
    expect(useOptionsStore.getState().loading).toBe(false)
  })

  it('fetchOptionChains sets error on API failure', async () => {
    vi.mocked(get).mockRejectedValue(new Error('Network error'))

    await useOptionsStore.getState().fetchOptionChains('IF2608')

    expect(useOptionsStore.getState().error).toBe('Failed to load option chains')
    expect(useOptionsStore.getState().loading).toBe(false)
  })

  it('fetchOptionChains preserves existing chains on error', async () => {
    const existingChain = makeChain()
    useOptionsStore.setState({ optionChains: [existingChain] })
    vi.mocked(get).mockRejectedValue(new Error('fail'))

    await useOptionsStore.getState().fetchOptionChains('IF2608')

    expect(useOptionsStore.getState().optionChains).toEqual([existingChain])
  })

  // --- available expirations ---

  it('availableExpirations returns unique sorted dates from all chains', () => {
    const chain1 = makeChain({ expireDate: '20260915' })
    const chain2 = makeChain({ underlying: 'IF2609', expireDate: '20260815' })
    useOptionsStore.setState({ optionChains: [chain1, chain2] })

    const dates = useOptionsStore.getState().availableExpirations()
    expect(dates).toEqual(['20260815', '20260915'])
  })

  it('availableExpirations returns empty when no chains', () => {
    expect(useOptionsStore.getState().availableExpirations()).toEqual([])
  })

  // --- available underlyings ---

  it('availableUnderlyings returns unique underlyings sorted', () => {
    useOptionsStore.setState({
      optionChains: [
        makeChain({ underlying: 'IF2609' }),
        makeChain({ underlying: 'IF2608' }),
      ],
    })

    const underlyings = useOptionsStore.getState().availableUnderlyings()
    expect(underlyings).toEqual(['IF2608', 'IF2609'])
  })

  it('availableUnderlyings returns empty when no chains', () => {
    expect(useOptionsStore.getState().availableUnderlyings()).toEqual([])
  })

  // --- strikes ---

  it('allStrikes returns unique sorted strike prices from calls and puts', () => {
    useOptionsStore.setState({
      optionChains: [makeChain()],
    })

    const strikes = useOptionsStore.getState().allStrikes()
    expect(strikes).toEqual([4700, 4800])
  })

  it('allStrikes returns empty when no chains', () => {
    expect(useOptionsStore.getState().allStrikes()).toEqual([])
  })
})
