import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketStore } from './store'
import type { MarketSnapshot } from '@/services/types'

describe('MarketStore', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
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

  it('has empty snapshots map by default', () => {
    expect(useMarketStore.getState().snapshots.size).toBe(0)
  })

  it('updates a single snapshot', () => {
    const snapshot = {
      instrumentID: 'au2508',
      lastPrice: 480.5,
      bidPrice1: 480.4,
      askPrice1: 480.6,
      volume: 1000,
      openInterest: 5000,
    } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snapshot)
    expect(useMarketStore.getState().snapshots.get('au2508')).toEqual(snapshot)
  })

  it('updates existing snapshot replaces it', () => {
    const snap1 = {
      instrumentID: 'au2508',
      lastPrice: 480.5,
      volume: 1000,
    } as MarketSnapshot

    const snap2 = {
      instrumentID: 'au2508',
      lastPrice: 481.0,
      volume: 1200,
    } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snap1)
    useMarketStore.getState().updateSnapshot(snap2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(481.0)
    expect(useMarketStore.getState().snapshots.get('au2508')?.volume).toBe(1200)
  })

  it('stores multiple instruments', () => {
    const snap1 = { instrumentID: 'au2508', lastPrice: 480.5 } as MarketSnapshot
    const snap2 = { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot

    useMarketStore.getState().updateSnapshot(snap1)
    useMarketStore.getState().updateSnapshot(snap2)
    expect(useMarketStore.getState().snapshots.size).toBe(2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(480.5)
    expect(useMarketStore.getState().snapshots.get('ag2508')?.lastPrice).toBe(6500)
  })

  it('batchUpdate merges multiple snapshots at once', () => {
    const snaps = [
      { instrumentID: 'au2508', lastPrice: 480.5 } as MarketSnapshot,
      { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot,
      { instrumentID: 'cu2508', lastPrice: 72000 } as MarketSnapshot,
    ]

    useMarketStore.getState().batchUpdate(snaps)
    expect(useMarketStore.getState().snapshots.size).toBe(3)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(480.5)
    expect(useMarketStore.getState().snapshots.get('ag2508')?.lastPrice).toBe(6500)
    expect(useMarketStore.getState().snapshots.get('cu2508')?.lastPrice).toBe(72000)
  })

  it('batchUpdate updates existing snapshots', () => {
    useMarketStore.getState().updateSnapshot({
      instrumentID: 'au2508',
      lastPrice: 480.5,
    } as MarketSnapshot)

    useMarketStore.getState().batchUpdate([
      { instrumentID: 'au2508', lastPrice: 481.0 } as MarketSnapshot,
      { instrumentID: 'ag2508', lastPrice: 6500 } as MarketSnapshot,
    ])

    expect(useMarketStore.getState().snapshots.size).toBe(2)
    expect(useMarketStore.getState().snapshots.get('au2508')?.lastPrice).toBe(481.0)
  })
})
