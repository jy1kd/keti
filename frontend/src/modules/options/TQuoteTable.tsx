import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { OptionChain, OptionQuote } from '@/services/types'

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
}

const PLACEHOLDER = '--'

/** Merge calls and puts by strike price into table records. */
function buildRecords(chain: OptionChain): TQuoteRow[] {
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

    const fmtIV = (iv: number) => (iv > 0 ? `${(iv * 100).toFixed(2)}%` : PLACEHOLDER)

    return {
      strikePrice: strike,
      callLastPrice: c?.lastPrice ?? PLACEHOLDER,
      callBidPrice: c?.bidPrice ?? PLACEHOLDER,
      callAskPrice: c?.askPrice ?? PLACEHOLDER,
      callVolume: c?.volume ?? PLACEHOLDER,
      callOpenInterest: c?.openInterest ?? PLACEHOLDER,
      callIV: c ? fmtIV(c.impliedVolatility) : PLACEHOLDER,
      putLastPrice: p?.lastPrice ?? PLACEHOLDER,
      putBidPrice: p?.bidPrice ?? PLACEHOLDER,
      putAskPrice: p?.askPrice ?? PLACEHOLDER,
      putVolume: p?.volume ?? PLACEHOLDER,
      putOpenInterest: p?.openInterest ?? PLACEHOLDER,
      putIV: p ? fmtIV(p.impliedVolatility) : PLACEHOLDER,
    }
  })
}

const CALL_COLOR = '#ef4444'
const PUT_COLOR = '#22c55e'
const STRIKE_BG = 'rgba(255,255,255,0.04)'

export function TQuoteTable({ chain }: TQuoteTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const records = buildRecords(chain)

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
      hover: { highlightMode: 'row' as const },
      theme: {
        defaultStyle: {
          color: '#e6edf3',
          fontSize: 13,
          fontFamily: 'Consolas, monospace',
        },
        headerStyle: {
          bgColor: '#1a1a2e',
          color: '#8b949e',
          fontSize: 12,
          fontWeight: 'bold',
        },
        bodyStyle: {
          bgColor: '#0d1117',
        },
      },
    })

    tableRef.current = table

    return () => {
      table.release()
      tableRef.current = null
    }
  }, [chain])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
