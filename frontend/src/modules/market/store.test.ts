import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketStore } from './store'

describe('MarketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({ selectedInstrument: null })
  })

  it('has null selectedInstrument by default', () => {
    expect(useMarketStore.getState().selectedInstrument).toBeNull()
  })

  it('sets selected instrument', () => {
    useMarketStore.getState().setSelectedInstrument('au2508')
    expect(useMarketStore.getState().selectedInstrument).toBe('au2508')
  })

  it('clears selected instrument', () => {
    useMarketStore.getState().setSelectedInstrument('au2508')
    useMarketStore.getState().setSelectedInstrument(null)
    expect(useMarketStore.getState().selectedInstrument).toBeNull()
  })
})
