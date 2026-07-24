import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { TQuoteTable } from './TQuoteTable'
import type { OptionChain, OptionQuote } from '@/services/types'

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

describe('TQuoteTable', () => {
  const chain: OptionChain = {
    underlying: 'IF2608',
    expireDate: '20260815',
    calls: [
      makeQuote({ instrumentID: 'IF2608-C-4700', strikePrice: 4700, lastPrice: 180.0, impliedVolatility: 0.22 }),
      makeQuote({ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5, impliedVolatility: 0.25 }),
    ],
    puts: [
      makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, lastPrice: 80.0, impliedVolatility: 0.20 }),
      makeQuote({ instrumentID: 'IF2608-P-4800', strikePrice: 4800, lastPrice: 130.0, impliedVolatility: 0.28 }),
    ],
    updateTime: '2026-07-24T10:00:00',
  }

  const chainWithGaps: OptionChain = {
    underlying: 'IF2608',
    expireDate: '20260815',
    calls: [
      makeQuote({ instrumentID: 'IF2608-C-4800', strikePrice: 4800, lastPrice: 120.5 }),
    ],
    puts: [
      makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, lastPrice: 80.0 }),
    ],
    updateTime: '2026-07-24T10:00:00',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a container element', () => {
    const { container } = render(<TQuoteTable chain={chain} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('creates ListTable with correct options', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    expect(ListTable).toHaveBeenCalledTimes(1)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columns).toBeDefined()
    expect(options.columns.length).toBe(13) // 6 call cols + 1 strike + 6 put cols
  })

  it('merges calls and puts by strike price into sorted records', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const records = options.records
    expect(records).toHaveLength(2)
    // Strikes sorted ascending
    expect(records[0].strikePrice).toBe(4700)
    expect(records[1].strikePrice).toBe(4800)
    // First row: call exists, put exists
    expect(records[0].callLastPrice).toBe(180.0)
    expect(records[0].putLastPrice).toBe(80.0)
    // Second row
    expect(records[1].callLastPrice).toBe(120.5)
    expect(records[1].putLastPrice).toBe(130.0)
  })

  it('shows placeholder when call or put is missing at a strike', async () => {
    render(<TQuoteTable chain={chainWithGaps} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const records = options.records
    expect(records).toHaveLength(2)
    // 4700: no call, has put
    expect(records[0].callLastPrice).toBe('--')
    expect(records[0].putLastPrice).toBe(80.0)
    // 4800: has call, no put
    expect(records[1].callLastPrice).toBe(120.5)
    expect(records[1].putLastPrice).toBe('--')
  })

  it('shows empty placeholder when chain has no data', async () => {
    const emptyChain: OptionChain = { underlying: '', expireDate: '', calls: [], puts: [], updateTime: '' }
    render(<TQuoteTable chain={emptyChain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(0)
  })

  it('formats impliedVolatility as percentage string', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const row = options.records[0]
    // IV 0.22 → "22.00%"
    expect(row.callIV).toBe('22.00%')
    expect(row.putIV).toBe('20.00%')
  })

  it('shows placeholder for zero impliedVolatility', async () => {
    const chainZero: OptionChain = {
      underlying: 'IF2608',
      expireDate: '20260815',
      calls: [makeQuote({ instrumentID: 'IF2608-C-4700', strikePrice: 4700, impliedVolatility: 0 })],
      puts: [makeQuote({ instrumentID: 'IF2608-P-4700', strikePrice: 4700, impliedVolatility: 0 })],
      updateTime: '2026-07-24T10:00:00',
    }
    render(<TQuoteTable chain={chainZero} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].callIV).toBe('--')
    expect(options.records[0].putIV).toBe('--')
  })

  it('prefers volatility map over quote impliedVolatility', async () => {
    const volMap = new Map([
      ['IF2608-C-4700', 0.35],
      ['IF2608-P-4700', 0.42],
    ])
    render(<TQuoteTable chain={chain} volatility={volMap} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    // IV from volatility map (0.35 → "35.00%"), not from quote (0.22)
    expect(options.records[0].callIV).toBe('35.00%')
    expect(options.records[0].putIV).toBe('42.00%')
  })

  it('falls back to quote impliedVolatility when instrument not in volatility map', async () => {
    const volMap = new Map([['OTHER-INSTRUMENT', 0.99]])
    render(<TQuoteTable chain={chain} volatility={volMap} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].callIV).toBe('22.00%')
  })

  it('releases vtable instance on unmount', async () => {
    const { unmount } = render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0]?.value
    unmount()
    expect(instance?.release).toHaveBeenCalled()
  })
})
