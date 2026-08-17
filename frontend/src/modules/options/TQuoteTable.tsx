import { useRef, useEffect } from 'react'
import { ListTable } from '@visactor/vtable'
import type { OptionChain, OptionQuote, MarketSnapshot } from '@/services/types'
import { SCROLL_STYLE } from '@/utils/vtableTheme'

interface TQuoteRow {
  strikePrice: number
  // Call columns
  callInstrumentID?: string
  callLastPrice: number | string
  callBidPrice: number | string
  callAskPrice: number | string
  callVolume: number | string
  callOpenInterest: number | string
  // Put columns
  putInstrumentID?: string
  putLastPrice: number | string
  putBidPrice: number | string
  putAskPrice: number | string
  putVolume: number | string
  putOpenInterest: number | string
}

interface TQuoteTableProps {
  chain: OptionChain
  /** Market snapshots for real-time price data. */
  snapshots?: Map<string, MarketSnapshot>
  /** 点击 C/P 侧单元格回调；中列（行权价）与缺失侧不回调 */
  onRowClick?: (instrumentID: string, price: number) => void
  /** 暴露 vtable 实例（测试用，生产可忽略） */
  onTableReady?: (table: ListTable) => void
}

const PLACEHOLDER = '--'

/** Merge calls and puts by strike price into table records, enriching with snapshot data. */
function buildRecords(
  chain: OptionChain,
  snapshots?: Map<string, MarketSnapshot>,
): TQuoteRow[] {
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

    const valOrDash = (v: number | undefined) => (v != null && v > 0 ? v : PLACEHOLDER)

    return {
      strikePrice: strike,
      callInstrumentID: c?.instrumentID,
      callLastPrice: cSnap?.lastPrice ?? valOrDash(c?.lastPrice),
      callBidPrice: cSnap?.bidPrice1 ?? valOrDash(c?.bidPrice),
      callAskPrice: cSnap?.askPrice1 ?? valOrDash(c?.askPrice),
      callVolume: cSnap?.volume ?? valOrDash(c?.volume),
      callOpenInterest: cSnap?.openInterest ?? valOrDash(c?.openInterest),
      putInstrumentID: p?.instrumentID,
      putLastPrice: pSnap?.lastPrice ?? valOrDash(p?.lastPrice),
      putBidPrice: pSnap?.bidPrice1 ?? valOrDash(p?.bidPrice),
      putAskPrice: pSnap?.askPrice1 ?? valOrDash(p?.askPrice),
      putVolume: pSnap?.volume ?? valOrDash(p?.volume),
      putOpenInterest: pSnap?.openInterest ?? valOrDash(p?.openInterest),
    }
  })
}

const CALL_COLOR = '#ef4444'
const PUT_COLOR = '#22c55e'
const STRIKE_BG = 'rgba(255,255,255,0.04)'

const columns = [
  // ── Call columns (left) ──
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
]

export function TQuoteTable({ chain, snapshots, onRowClick, onTableReady }: TQuoteTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  /** 当前渲染的 records，供 click_cell 回调按行索引取行数据 */
  const recordsRef = useRef<TQuoteRow[]>([])
  /** 延迟释放定时器句柄：同一实例至多一个挂起释放定时器，避免快速开合叠加定时器 */
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mount/unmount: create and release the vtable instance exactly once.
  useEffect(() => {
    if (!containerRef.current) return

    const records = buildRecords(chain, snapshots)
    recordsRef.current = records

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
        scrollStyle: { ...SCROLL_STYLE },
      },
    })

    tableRef.current = table
    onTableReady?.(table)

    // 点击 C/P 侧单元格回传合约 ID 与最新价；中列（行权价 index 5）与缺失侧不回调
    // vtable click_cell 回传单个事件对象 { col, row, colIndex, rowIndex, ... }，
    // 兼容两种字段命名（col/row 与 colIndex/rowIndex）。
    table.on('click_cell', (evt: { col?: number; row?: number; colIndex?: number; rowIndex?: number }) => {
      if (!onRowClick) return
      const rowIndex = evt.rowIndex ?? evt.row
      const colIndex = evt.colIndex ?? evt.col
      if (rowIndex == null || colIndex == null) return
      const record = recordsRef.current[rowIndex]
      if (!record) return
      if (colIndex >= 0 && colIndex <= 4 && record.callInstrumentID) {
        const price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
        onRowClick(record.callInstrumentID, price)
      } else if (colIndex >= 6 && colIndex <= 10 && record.putInstrumentID) {
        const price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
        onRowClick(record.putInstrumentID, price)
      }
    })

    // 延迟 release：vtable 内部 ResizeObserver 对容器 100ms 防抖；若 release 先于防抖回调
    // （internalProps 置 null），回调内 resize() 读 null 崩溃。延迟 ~250ms 释放，
    // 让挂起回调先在存活表上触发；release 幂等（isReleased 守卫），可安全延迟。
    // StrictMode 双挂载时，延迟释放释放的是旧脱离表，tableRef 已指向新表（仅当仍相等才置 null）。
    const RESIZE_SETTLE_MS = 250
    return () => {
      const t = table
      // 同实例至多保留一个挂起释放定时器：快速开合（cleanup 连续触发）时先清掉旧定时器，
      // 再调度新的一次释放，避免多个 release 定时器叠加。
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null
        t.release()
        if (tableRef.current === t) tableRef.current = null
      }, RESIZE_SETTLE_MS)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update records when data changes without rebuilding the table.
  useEffect(() => {
    const records = buildRecords(chain, snapshots)
    recordsRef.current = records
    tableRef.current?.setRecords(records)
  }, [chain, snapshots])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0d1117' }} />
}
