import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderStore } from './store'

describe('OrderStore', () => {
  beforeEach(() => {
    useOrderStore.setState({ selectedInstrument: null })
  })

  it('has null selectedInstrument by default', () => {
    expect(useOrderStore.getState().selectedInstrument).toBeNull()
  })

  it('sets selected instrument from market panel', () => {
    useOrderStore.getState().setSelectedInstrument('au2508')
    expect(useOrderStore.getState().selectedInstrument).toBe('au2508')
  })
})
