import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { OptionChain, OptionQuote, MarketSnapshot } from '@/services/types'

interface TQuoteRow {
  strikePrice: number
  // Call columns
  callLastPrice: number | string
  callBidPrice: number | string
  callAskPrice: number | string
  callVolume: number | string
  callOpenInterest: number | string
  callIV: string
  // Put columns
  putLastPrice: number | string
  putBidPrice: number | string
  putAskPrice: number | string
  putVolume: number | string
  putOpenInterest: number | string
  putIV: string
}

interface TQuoteTableProps {
  chain: OptionChain
  /** Market snapshots for real-time price data. */
  snapshots?: Map<string, MarketSnapshot>
}

const PLACEHOLDER = '--'

/** Merge calls and puts by strike price into table records, enriching with snapshot data. */
function buildRecords(chain: OptionChain, snapshots?: Map<string, MarketSnapshot>): TQuoteRow[] {
  const strikeMap = new Map<number, { call?: OptionQuote; put?: OptionQuote }>()

  for (const call of chain.calls) {
    const entry = strikeMap.get(call.strikePrice) ?? {}
    entry.call = call
    strikeMap.set(call.strikePrice, entry)
  }
  for (const put of chain.puts) {
    const entry = strikeMap.get(put.strikePrice) ?? {}
    entry.put = put
    strikeMap.set(put.strikePrice, entry)
  }

  const strikes = [...strikeMap.keys()].sort((a, b) => a - b)

  return strikes.map((strike) => {
    const entry = strikeMap.get(strike)!
    const c = entry.call
    const p = entry.put

    // Merge snapshot data if available
    const cSnap = c ? snapshots?.get(c.instrumentID) : undefined
    const pSnap = p ? snapshots?.get(p.instrumentID) : undefined

    const fmtIV = (iv: number) => (iv > 0 ? `${(iv * 100).toFixed(2)}%` : PLACEHOLDER)
    const valOrDash = (v: number | undefined) => (v != null && v > 0 ? v : PLACEHOLDER)

    return {
      strikePrice: strike,
      callLastPrice: cSnap?.lastPrice ?? valOrDash(c?.lastPrice),
      callBidPrice: cSnap?.bidPrice1 ?? valOrDash(c?.bidPrice),
      callAskPrice: cSnap?.askPrice1 ?? valOrDash(c?.askPrice),
      callVolume: cSnap?.volume ?? valOrDash(c?.volume),
      callOpenInterest: cSnap?.openInterest ?? valOrDash(c?.openInterest),
      callIV: c ? fmtIV(c.impliedVolatility) : PLACEHOLDER,
      putLastPrice: pSnap?.lastPrice ?? valOrDash(p?.lastPrice),
      putBidPrice: pSnap?.bidPrice1 ?? valOrDash(p?.bidPrice),
      putAskPrice: pSnap?.askPrice1 ?? valOrDash(p?.askPrice),
      putVolume: pSnap?.volume ?? valOrDash(p?.volume),
      putOpenInterest: pSnap?.openInterest ?? valOrDash(p?.openInterest),
      putIV: p ? fmtIV(p.impliedVolatility) : PLACEHOLDER,
    }
  })
}

const CALL_COLOR = '#ef4444'
const PUT_COLOR = '#22c55e'
const STRIKE_BG = 'rgba(255,255,255,0.04)'

export function TQuoteTable({ chain, snapshots }: TQuoteTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const records = buildRecords(chain, snapshots)

    const columns = [
      // ── Call columns (left) ──
      { field: 'callIV', title: 'IV', width: 70, headerStyle: { color: CALL_COLOR } },
      { field: 'callOpenInterest', title: '持仓', width: 70, headerStyle: { color: CALL_COLOR } },
      { field: 'callVolume', title: '成交', width: 70, headerStyle: { color: CALL_COLOR } },
      { field: 'callAskPrice', title: '卖价', width: 80, headerStyle: { color: CALL_COLOR } },
      { field: 'callBidPrice', title: '买价', width: 80, headerStyle: { color: CALL_COLOR } },
      { field: 'callLastPrice', title: '最新', width: 80, headerStyle: { color: CALL_COLOR } },
      // ── Strike (middle) ──
      {
        field: 'strikePrice',
        title: '行权价',
        width: 90,
        style: { fontWeight: 'bold', bgColor: STRIKE_BG },
      },
      // ── Put columns (right) ──
      { field: 'putLastPrice', title: '最新', width: 80, headerStyle: { color: PUT_COLOR } },
      { field: 'putBidPrice', title: '买价', width: 80, headerStyle: { color: PUT_COLOR } },
      { field: 'putAskPrice', title: '卖价', width: 80, headerStyle: { color: PUT_COLOR } },
      { field: 'putVolume', title: '成交', width: 70, headerStyle: { color: PUT_COLOR } },
      { field: 'putOpenInterest', title: '持仓', width: 70, headerStyle: { color: PUT_COLOR } },
      { field: 'putIV', title: 'IV', width: 70, headerStyle: { color: PUT_COLOR } },
    ]

    const table = new ListTable(containerRef.current, {
      columns,
      records,
      defaultRowHeight: 28,
      widthMode: 'adaptive' as const,
      hover: { highlightMode: 'row' as const },
      theme: {
        underlayBackgroundColor: '#0d1117',
        defaultStyle: {
          color: '#e6edf3',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          bgColor: '#0d1117',
          borderColor: '#21262d',
          hover: {
            cellBgColor: '#1c2333',
          },
        },
        headerStyle: {
          bgColor: '#161b22',
          color: '#8b949e',
          fontSize: 12,
          fontWeight: 'bold',
          borderColor: '#30363d',
        },
        bodyStyle: {
          bgColor: '#0d1117',
          borderColor: '#21262d',
        },
      },
    })

    tableRef.current = table

    return () => {
      table.release()
      tableRef.current = null
    }
  }, [chain, snapshots])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0d1117' }} />
}
