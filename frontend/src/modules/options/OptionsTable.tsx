import { useRef, useEffect, useCallback } from 'react'
import { ListTable } from '@visactor/vtable'
import type { OptionChain, OptionQuote, MarketSnapshot } from '@/services/types'
import { SCROLL_STYLE } from '@/utils/vtableTheme'

/** 标底层级（标底行或期权行），统一记录类型 */
export interface OptionsRecord {
  kind: 'underlying' | 'option'
  underlyingID: string
  // Call columns
  callInstrumentID?: string
  callLastPrice?: number | string
  callBidPrice?: number | string
  callAskPrice?: number | string
  callVolume?: number | string
  callOpenInterest?: number | string
  // Put columns
  putInstrumentID?: string
  putLastPrice?: number | string
  putBidPrice?: number | string
  putAskPrice?: number | string
  putVolume?: number | string
  putOpenInterest?: number | string
  // Strike
  strikePrice?: number | string
}

export interface OptionsTableProps {
  records: OptionsRecord[]
  /** 点击标底层切换折叠 */
  onToggleGroup: (underlyingID: string) => void
  /** 点击 C/P 侧单元格回调；中列（行权价）与缺失侧不回调 */
  onRowClick?: (instrumentID: string, price: number) => void
  /** vtable 可见区期权合约 ID 变化回调（仿照 QuoteTable onVisibleRangeChange → 订阅管理器） */
  onVisibleRangeChange?: (instrumentIDs: string[]) => void
  /**
   * 当前期权面板是否激活（与 useTabStore.activeTabId 对齐）。
   * 仿照 QuoteTable.isActive：隐藏面板（display:none）不挂载也无所谓，但 hidden 挂载时
   * 必须为 false，否则 vtable 容器 0 尺寸下 notifyVisibleRange 仍以「预加载 ±10 行」上报
   * 期权合约 ID → 覆盖活跃面板的可见范围 → 订阅管理器订阅错位。
   * 缺省 = 视为激活（与 QuoteTable 一致）。
   */
  isActive?: boolean
}

const PLACEHOLDER = '--'

const CALL_COLOR = '#ef4444'
const PUT_COLOR = '#22c55e'
const STRIKE_BG = 'rgba(255,255,255,0.04)'
const UNDERLYING_BG = '#1a2230'
const UNDERLYING_STYLE = { color: '#f87171', fontWeight: 'bold', fontSize: 14 }

interface ColDef {
  field: string
  title: string
  width: number
  headerStyle?: { color: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vtable style callback 类型无法精确化
  style?: ((args: any) => any) | Record<string, unknown>
}

const BASE_COLUMNS: ColDef[] = [
  { field: 'callOpenInterest', title: '持仓', width: 70, headerStyle: { color: CALL_COLOR } },
  { field: 'callVolume', title: '成交', width: 70, headerStyle: { color: CALL_COLOR } },
  { field: 'callAskPrice', title: '卖价', width: 80, headerStyle: { color: CALL_COLOR } },
  { field: 'callBidPrice', title: '买价', width: 80, headerStyle: { color: CALL_COLOR } },
  { field: 'callLastPrice', title: '最新', width: 80, headerStyle: { color: CALL_COLOR } },
  { field: 'strikePrice', title: '行权价', width: 90, style: { fontWeight: 'bold', bgColor: STRIKE_BG } },
  { field: 'putLastPrice', title: '最新', width: 80, headerStyle: { color: PUT_COLOR } },
  { field: 'putBidPrice', title: '买价', width: 80, headerStyle: { color: PUT_COLOR } },
  { field: 'putAskPrice', title: '卖价', width: 80, headerStyle: { color: PUT_COLOR } },
  { field: 'putVolume', title: '成交', width: 70, headerStyle: { color: PUT_COLOR } },
  { field: 'putOpenInterest', title: '持仓', width: 70, headerStyle: { color: PUT_COLOR } },
]

const RESIZE_SETTLE_MS = 250
const SCROLL_DEBOUNCE_MS = 100

/** 标底行样式包装：第一列加红粗大字 */
function withUnderlyingStyle(columns: ColDef[]): ColDef[] {
  return columns.map((col, i) => {
    if (i !== 0) return col
    return {
      ...col,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vtable style callback 类型无法精确化
      style: (args: any) => {
        const record = args.table?.records?.[args.row - 1]
        if (record?.kind === 'underlying') return UNDERLYING_STYLE
        return typeof col.style === 'function' ? col.style(args) : col.style
      },
    }
  })
}

/** 从链数据 + snapshot 构建期权行 records（不含标底层） */
function buildOptionRecords(
  chain: OptionChain,
  snapshots?: Map<string, MarketSnapshot>,
): OptionsRecord[] {
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
  const valOrDash = (v: number | undefined) => (v != null && v > 0 ? v : PLACEHOLDER)

  return strikes.map((strike) => {
    const entry = strikeMap.get(strike)!
    const c = entry.call
    const p = entry.put
    const cSnap = c ? snapshots?.get(c.instrumentID) : undefined
    const pSnap = p ? snapshots?.get(p.instrumentID) : undefined

    return {
      kind: 'option' as const,
      underlyingID: chain.underlying,
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
      strikePrice: strike,
    }
  })
}

export function OptionsTable({ records, onToggleGroup, onRowClick, onVisibleRangeChange, isActive }: OptionsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const recordsRef = useRef<OptionsRecord[]>([])
  const onRowClickRef = useRef(onRowClick)
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange)
  const onToggleGroupRef = useRef(onToggleGroup)
  const mergedRowsRef = useRef<Set<number>>(new Set())
  const mergeRafRef = useRef<number | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 镜像 QuoteTable.isActiveRef：当前面板激活态，避免回调闭包冻结过期值 */
  const isActiveRef = useRef(isActive)
  /** 镜像 QuoteTable.scheduleVisibleRangeReport：仅在激活时调度上报（避免隐藏面板污染订阅管理器） */
  const scheduleRafRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { onRowClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onVisibleRangeChangeRef.current = onVisibleRangeChange }, [onVisibleRangeChange])
  useEffect(() => { onToggleGroupRef.current = onToggleGroup }, [onToggleGroup])
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  /** 上报可见区的期权合约 ID 列表（仿照 QuoteTable → 订阅管理器） */
  const notifyVisibleRange = useCallback(() => {
    if (!onVisibleRangeChangeRef.current || !tableRef.current) return
    try {
      const range = tableRef.current.getBodyVisibleCellRange()
      if (!range) return
      const PRELOAD_ROWS = 10
      const startRow = Math.max(0, range.rowStart - 1 - PRELOAD_ROWS)
      const endRow = Math.min(recordsRef.current.length - 1, range.rowEnd - 1 + PRELOAD_ROWS)
      const ids: string[] = []
      for (let i = startRow; i <= endRow; i++) {
        const r = recordsRef.current[i]
        if (!r) continue
        if (r.callInstrumentID) ids.push(r.callInstrumentID)
        if (r.putInstrumentID) ids.push(r.putInstrumentID)
      }
      onVisibleRangeChangeRef.current(ids)
    } catch { /* vtable 未就绪 */ }
  }, [])

  /** 镜像 QuoteTable.scheduleVisibleRangeReport：仅在激活时调度上报。
   *  setTimeout 0 而非直接调用：避开 vtable 初始化同步路径内的潜在 read-before-render；
   *  scheduleRafRef 清旧调度避免多定时器叠加（清理逻辑见初次挂载与 records 变化 effect）。 */
  const scheduleVisibleRangeReport = useCallback(() => {
    if (isActiveRef.current === false) return
    if (scheduleRafRef.current != null) return
    scheduleRafRef.current = setTimeout(() => {
      scheduleRafRef.current = null
      notifyVisibleRange()
    }, 0)
  }, [notifyVisibleRange])

  /** 合并标底行为整行表头 */
  const applyRowMerges = useCallback((): boolean => {
    const table = tableRef.current
    if (!table || typeof table.mergeCells !== 'function') return false
    const lastCol = BASE_COLUMNS.length - 1
    const underlyingRows = new Set<number>()
    recordsRef.current.forEach((record, i) => {
      if (record.kind === 'underlying') underlyingRows.add(i + 1) // vtable row 0 = header
    })
    // 撤销旧合并
    for (const row of mergedRowsRef.current) {
      try { table.unmergeCells?.(0, row, lastCol, row) } catch { /* vtable 未就绪 */ }
    }
    const next = new Set<number>()
    for (const row of underlyingRows) {
      try {
        table.mergeCells(0, row, lastCol, row)
        next.add(row)
      } catch { /* 留待下一轮 rAF 重试 */ }
    }
    mergedRowsRef.current = next
    return next.size === underlyingRows.size
  }, [])

  // 初次挂载：创建 vtable
  useEffect(() => {
    if (!containerRef.current) return

    const records = recordsRef.current // 初始为空，由 setRecords 驱动
    const table = new ListTable(containerRef.current, {
      columns: withUnderlyingStyle(BASE_COLUMNS),
      records,
      frozenColCount: 0,
      widthMode: 'adaptive' as const,
      columnResizeMode: 'all' as const,
      hover: { highlightMode: 'row' as const },
      theme: {
        underlayBackgroundColor: '#0d1117',
        defaultStyle: {
          fontSize: 13,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          color: '#e6edf3',
          bgColor: '#0d1117',
          borderColor: '#21262d',
          hover: { cellBgColor: '#1c2333' },
        },
        headerStyle: {
          fontSize: 11,
          fontWeight: '600',
          color: '#8b949e',
          bgColor: '#161b22',
          borderColor: '#30363d',
        },
        bodyStyle: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vtable style callback 类型无法精确化
          bgColor: (args: any) => {
            const record = args.table?.records?.[args.row - 1]
            if (record?.kind === 'underlying') return UNDERLYING_BG
            return '#0d1117'
          },
          borderColor: '#21262d',
        },
        scrollStyle: { ...SCROLL_STYLE },
        frameStyle: { borderColor: '#30363d', cornerRadius: 0 },
      },
    })

    // 点击标底层 → 折叠/展开
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vtable event callback 类型无法精确化
    table.on('click_cell', (args: any) => {
      const rowIndex = (args.row ?? args.rowIndex) - 1
      const colIndex = args.col ?? args.colIndex
      if (rowIndex == null || colIndex == null) return
      const record = recordsRef.current[rowIndex]
      if (!record) return

      if (record.kind === 'underlying') {
        onToggleGroupRef.current?.(record.underlyingID)
        return
      }

      // 期权行 C/P 侧回调
      if (colIndex >= 0 && colIndex <= 4 && record.callInstrumentID) {
        const price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
        onRowClickRef.current?.(record.callInstrumentID, price)
      } else if (colIndex >= 6 && colIndex <= 10 && record.putInstrumentID) {
        const price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
        onRowClickRef.current?.(record.putInstrumentID, price)
      }
    })

    // 滚动 → 防抖上报可见标底
    table.on('scroll', () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(notifyVisibleRange, SCROLL_DEBOUNCE_MS)
    })

    tableRef.current = table
    scheduleVisibleRangeReport()

    return () => {
      if (mergeRafRef.current != null) {
        cancelAnimationFrame(mergeRafRef.current)
        mergeRafRef.current = null
      }
      if (scheduleRafRef.current != null) {
        clearTimeout(scheduleRafRef.current)
        scheduleRafRef.current = null
      }
      mergedRowsRef.current = new Set()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      tableRef.current = null
      const t = table
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null
        t.release()
      }, RESIZE_SETTLE_MS)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // records 变化 → setRecords + 合并标底行 + 上报可见区
  useEffect(() => {
    if (!tableRef.current) return
    recordsRef.current = records
    tableRef.current.setRecords(records)
    mergedRowsRef.current = new Set() // 重置后重新合并
    const mergedAll = applyRowMerges()
    if (mergeRafRef.current != null) cancelAnimationFrame(mergeRafRef.current)
    if (!mergedAll && typeof requestAnimationFrame === 'function') {
      mergeRafRef.current = requestAnimationFrame(() => {
        mergeRafRef.current = null
        applyRowMerges()
      })
    }
    scheduleVisibleRangeReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records])

  // 标签激活（isActive 翻转为 true）时重报可见区：切回期权标签时 vtable 容器尺寸变化但
  // 不触发 scroll/resize 事件，必须主动重报一次让订阅管理器对应当前可见区合约。
  // 与 QuoteTable.tsx:620-626 同型（隐式依赖：scheduleVisibleRangeReport 引用稳定）。
  useEffect(() => {
    if (isActive) notifyVisibleRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  return <div ref={containerRef} className="market-table-container" style={{ width: '100%', height: '100%' }} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { buildOptionRecords }
