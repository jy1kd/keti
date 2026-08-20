import { useRef, useEffect, useCallback, useState } from 'react'
import { ListTable } from '@visactor/vtable'
import type { OptionChain, OptionQuote, MarketSnapshot } from '@/services/types'
import { SCROLL_STYLE } from '@/utils/vtableTheme'

/** 标底层级（标底行或期权行），统一记录类型 */
export interface OptionsRecord {
  kind: 'underlying' | 'option'
  underlyingID: string
  /** 仅用于标底行的视觉状态（VTable 不是 DOM，不能依赖 CSS class）。 */
  isExpanded?: boolean
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
  /** 实时快照（仿照 QuoteTable 通过 updateRecords 增量更新可见区，避免全表 setRecords） */
  snapshots?: Map<string, MarketSnapshot>
  /** 点击标底层切换折叠 */
  onToggleGroup: (underlyingID: string) => void
  /** 点击 C/P 侧单元格回调；中列（行权价）与缺失侧不回调 */
  onRowClick?: (instrumentID: string, price: number) => void
  /** 搜索选中的合约；用于定位到具体行及 C/P 半区 */
  selectedInstrument?: string | null
  /** 双击 C/P 侧单元格回调（与期货表格一致，300ms 同行判定） */
  onRowDoubleClick?: (instrumentID: string, price: number) => void
  /**
   * 右键菜单回调（仿照 QuoteTable onContextMenu → 期权页单选菜单）。
   * 按下标底层（整行合并的分组表头）与中列（行权价）不回调；
   * call 侧列回调 call 合约、put 侧列回调 put 合约；price 为快照价，占位符回传 0。
   */
  onContextMenu?: (instrumentID: string, price: number, event: MouseEvent) => void
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
const UNDERLYING_COLLAPSED_BG = '#202938'
const UNDERLYING_STYLE = { color: '#f87171', fontWeight: 'bold', fontSize: 14 }
const UNDERLYING_EXPANDED_STYLE = { ...UNDERLYING_STYLE, color: '#f0b429' }

/** 合并行显示文本包含状态图标，但折叠状态只使用纯标底 ID。 */
function underlyingIDFromLabel(label: string, fallback: string): string {
  const id = label.replace(/\s+[▲▼]$/, '').trim()
  return id || fallback
}

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
        if (record?.kind === 'underlying') return record.isExpanded ? UNDERLYING_EXPANDED_STYLE : UNDERLYING_STYLE
        return typeof col.style === 'function' ? col.style(args) : col.style
      },
    }
  })
}

/**
 * 从链数据构建期权行 records（不含标底层、不含 snapshot）
 *
 * 关键：这里只构建结构（合约 ID + 行权价 + 链静态价），不读 snapshots。
 * snapshot 数据由 OptionsTable 内部 snapshot effect 通过 updateRecords 增量合并，
 * 避免每次 snapshot 变化都全表 setRecords 重建（仿照 QuoteTable 快照增量路径）。
 */
function buildOptionRecords(chain: OptionChain): OptionsRecord[] {
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

    return {
      kind: 'option' as const,
      underlyingID: chain.underlying,
      callInstrumentID: c?.instrumentID,
      callLastPrice: valOrDash(c?.lastPrice),
      callBidPrice: valOrDash(c?.bidPrice),
      callAskPrice: valOrDash(c?.askPrice),
      callVolume: valOrDash(c?.volume),
      callOpenInterest: valOrDash(c?.openInterest),
      putInstrumentID: p?.instrumentID,
      putLastPrice: valOrDash(p?.lastPrice),
      putBidPrice: valOrDash(p?.bidPrice),
      putAskPrice: valOrDash(p?.askPrice),
      putVolume: valOrDash(p?.volume),
      putOpenInterest: valOrDash(p?.openInterest),
      strikePrice: strike,
    }
  })
}

export function OptionsTable({ records, snapshots, onToggleGroup, onRowClick, onRowDoubleClick, onContextMenu, onVisibleRangeChange, isActive, selectedInstrument }: OptionsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const recordsRef = useRef<OptionsRecord[]>([])
  /** 每行最近一次 updateRecords 用的快照引用对（按行跟踪，仅对可见行生效，仿照 QuoteTable）
   *  每行存 { c: call snapshot 引用, p: put snapshot 引用 }，比较两侧是否变化 */
  const rowSnapshotRef = useRef<{ c?: MarketSnapshot; p?: MarketSnapshot }[]>([])
  /** 可见区版本号：滚动导致可见范围变化时递增，驱动局部更新 effect 重算（滚入新区域的行立即刷新） */
  const [visibleRangeVersion, setVisibleRangeVersion] = useState(0)
  const onRowClickRef = useRef(onRowClick)
  const onRowDoubleClickRef = useRef(onRowDoubleClick)
  const lastClickTimeRef = useRef(0)
  const lastClickRowRef = useRef<number | null>(null)
  const onContextMenuRef = useRef(onContextMenu)
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange)
  const onToggleGroupRef = useRef(onToggleGroup)
  const mergedRowsRef = useRef<Set<number>>(new Set())
  const mergeRafRef = useRef<number | null>(null)
  /** updateRecords 后调度标底行合并校准的延时器（scheduleMergeReconcile） */
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 镜像 QuoteTable.isActiveRef：当前面板激活态，避免回调闭包冻结过期值 */
  const isActiveRef = useRef(isActive)
  /** 镜像 QuoteTable.scheduleVisibleRangeReport：仅在激活时调度上报（避免隐藏面板污染订阅管理器） */
  const scheduleRafRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { onRowClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onRowDoubleClickRef.current = onRowDoubleClick }, [onRowDoubleClick])
  useEffect(() => { onContextMenuRef.current = onContextMenu }, [onContextMenu])
  useEffect(() => { onVisibleRangeChangeRef.current = onVisibleRangeChange }, [onVisibleRangeChange])
  useEffect(() => { onToggleGroupRef.current = onToggleGroup }, [onToggleGroup])
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  /** 上报可见区的期权合约 ID 列表（仿照 QuoteTable → 订阅管理器）。
   *  PRELOAD_ROWS = 0：用户明确要求「屏幕上显示的合约才订阅」；期货表的 ±10 预加载对期权表
   *  太激进——每屏 ~30 行 × 2 边 = 60 合约已经接近上限，再加预加载会无谓消耗订阅名额并挤掉滚动进入视野的合约。
   *  同 QuoteTable：递增 visibleRangeVersion 放在防抖后的上报里（而非 scroll 事件每次触发），
   *  避免拖动期间每个滚动帧都重算 snapshot effect 导致页面卡顿。 */
  const notifyVisibleRange = useCallback(() => {
    if (!onVisibleRangeChangeRef.current || !tableRef.current) return
    try {
      const range = tableRef.current.getBodyVisibleCellRange()
      if (!range) return
      const startRow = Math.max(0, range.rowStart - 1) // vtable row 0 = header
      const endRow = Math.min(recordsRef.current.length - 1, range.rowEnd - 1)
      const ids: string[] = []
      for (let i = startRow; i <= endRow; i++) {
        const r = recordsRef.current[i]
        if (!r) continue
        if (r.callInstrumentID) ids.push(r.callInstrumentID)
        if (r.putInstrumentID) ids.push(r.putInstrumentID)
      }
      onVisibleRangeChangeRef.current(ids)
      // 可见区变化 → 递增版本号，驱动 snapshot effect 对滚入的新区域立即重算
      setVisibleRangeVersion((v) => v + 1)
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

  /** updateRecords 会破坏 vtable mergeCells 状态：某行残留「旧合并文本」（如折叠后该行实际是 ad2610 却仍显示 ad2609），
   *  导致标签与点击目标错位（点 ad2609 却折叠 ad2610）。仅重合并可见区不够——被破坏的合并可能在非可见行。
   *  这里对 vtable 实际存在的 customMergeCell 做按需校准：只撤销「文本≠当前记录」或「该行已非标底」的合并，
   *  再补合并缺失的标底行，避免每次快照全表 200+ 组无谓重建。用 setTimeout(0) 延迟到 React 提交后执行。 */
  const reconcileMerges = useCallback((): void => {
    const table = tableRef.current
    if (!table || typeof table.mergeCells !== 'function') return
    const lastCol = BASE_COLUMNS.length - 1
    // 期望的标底行（vtable row）→ 标底名
    const expected = new Map<number, string>()
    recordsRef.current.forEach((record, i) => {
      if (record.kind === 'underlying') expected.set(i + 1, record.underlyingID)
    })
    // 扫描 vtable 实际合并：撤销「不再期望」或「文本陈旧」的残留合并。用合并自身存储的范围精确撤销，
    // 覆盖多行异常合并（避免 unmergeCells 按单行范围匹配不到而残留旧文本）。
    const existing = (table.options?.customMergeCell ?? []) as Array<{
      text?: string
      range: { start: { col: number; row: number }; end: { col: number; row: number } }
    }>
    for (const m of existing) {
      const want = expected.get(m.range.start.row)
      if (want == null || m.text !== want) {
        try {
          table.unmergeCells?.(m.range.start.col, m.range.start.row, m.range.end.col, m.range.end.row)
          mergedRowsRef.current.delete(m.range.start.row)
        } catch { /* vtable 未就绪 */ }
      }
    }
    // 对「缺失」或「刚被撤销」的标底行重新合并——此时旧合并已清空，mergeCells 会捕获当前记录的标底名
    const remain = new Set(
      ((table.options?.customMergeCell ?? []) as Array<{ range: { start: { row: number } } }>)
        .map(m => m.range.start.row),
    )
    for (const row of expected.keys()) {
      if (remain.has(row)) continue
      try {
        table.mergeCells(0, row, lastCol, row)
        mergedRowsRef.current.add(row)
      } catch { /* 留待下一轮 */ }
    }
    // 兜底清理 mergedRowsRef 中已非标底的行
    for (const row of [...mergedRowsRef.current]) {
      if (!expected.has(row)) mergedRowsRef.current.delete(row)
    }
  }, [])

  /** updateRecords 后调度标底行合并校准（setTimeout(0) → React 提交后、下一帧渲染前） */
  const scheduleMergeReconcile = useCallback(() => {
    if (mergeTimerRef.current != null) clearTimeout(mergeTimerRef.current)
    mergeTimerRef.current = setTimeout(() => {
      mergeTimerRef.current = null
      reconcileMerges()
    }, 0)
  }, [reconcileMerges])

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
            if (record?.kind === 'underlying') return record.isExpanded ? UNDERLYING_BG : UNDERLYING_COLLAPSED_BG
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
      const colIndex = args.col ?? args.colIndex
      if (colIndex == null) return
      const rowIndex = args.row ?? args.rowIndex
      // 优先用 vtable 自身解析的 originData（与渲染行严格一致，免疫折叠/快照后 recordsRef 漂移导致
      // 「点 ad2609 折叠 ad2610」的错位）；originData 缺失（旧版/异常）时回退 recordsRef 按行索引。
      const record = (args.originData as OptionsRecord | undefined)
        ?? recordsRef.current[rowIndex - 1]
      if (!record) return

      if (record.kind === 'underlying') {
        // 以「合并单元格文本 = 用户看到的标底标签」为准折叠对应系列：折叠/快照后 vtable 内部
        // 行号或 dataSource 可能与渲染标签错位（标签显示 ad2609 但点下去折的是 ad2610），
        // 而合并文本始终等于该行标签 → 点击「所见即所得」。getCustomMergeValue 缺失时回退记录。
        const label = tableRef.current?.getCustomMergeValue?.(0, rowIndex) as string | undefined
        onToggleGroupRef.current?.(underlyingIDFromLabel(label ?? '', record.underlyingID))
        return
      }

      // 期权行 C/P 侧回调（含双击检测，与期货表格一致：300ms 同行判定）
      let instrumentID: string | undefined
      let price: number
      if (colIndex >= 0 && colIndex <= 4 && record.callInstrumentID) {
        instrumentID = record.callInstrumentID
        price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
      } else if (colIndex >= 6 && colIndex <= 10 && record.putInstrumentID) {
        instrumentID = record.putInstrumentID
        price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
      } else {
        return
      }
      const now = Date.now()
      const isDoubleClick =
        lastClickRowRef.current === rowIndex &&
        now - lastClickTimeRef.current < 300
      lastClickTimeRef.current = now
      lastClickRowRef.current = rowIndex
      if (isDoubleClick) {
        onRowDoubleClickRef.current?.(instrumentID, price)
      } else {
        onRowClickRef.current?.(instrumentID, price)
      }
    })

    // 右键菜单：C/P 侧按列映射到具体合约（仿照 QuoteTable contextmenu_cell）。
    // 标底层（整行合并的分组表头）与中列（行权价）不属于任何 C/P 合约 → 不回调；
    // 单侧缺失（无合约）也不回调。始终 preventDefault 抑制浏览器原生菜单。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vtable event callback 类型无法精确化
    table.on('contextmenu_cell', (args: any) => {
      args.event?.preventDefault?.()
      const colIndex = args.col ?? args.colIndex
      if (colIndex == null) return
      const record = (args.originData as OptionsRecord | undefined)
        ?? recordsRef.current[(args.row ?? args.rowIndex) - 1]
      if (!record || record.kind === 'underlying') return

      let instrumentID: string | undefined
      let price: number
      if (colIndex >= 0 && colIndex <= 4) {
        instrumentID = record.callInstrumentID
        price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
      } else if (colIndex >= 6 && colIndex <= 10) {
        instrumentID = record.putInstrumentID
        price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
      } else {
        return // 中列（行权价）
      }
      if (!instrumentID) return
      onContextMenuRef.current?.(instrumentID, price, args.event)
    })

    // 滚动 → 防抖上报可见标底（上报内递增 visibleRangeVersion；此处不直接递增，
    // 否则每个滚动帧都触发 snapshot effect 重算，拖动期间页面卡顿）
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
      if (mergeTimerRef.current != null) {
        clearTimeout(mergeTimerRef.current)
        mergeTimerRef.current = null
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

  // records 变化 → 全量 setRecords + 合并标底行 + 重置 rowSnapshot 跟踪 + 上报可见区
  // 仅在结构变化（链数据/筛选/折叠）时触发；不再因 snapshot 变化而重建（snapshot 走下面的 effect 增量更新）
  useEffect(() => {
    if (!tableRef.current) return
    recordsRef.current = records
    // 全量重建：每行的 rowSnapshotRef 索引重置，让 snapshot effect 重新填充可见行的最新引用
    rowSnapshotRef.current = records.map(() => ({}))
    tableRef.current.setRecords(records)
    // 注意：不要在这里重置 mergedRowsRef！applyRowMerges 内部会先「撤销旧合并」再「重新合并」。
    // 若在此清空 mergedRowsRef，applyRowMerges 的 unmerge 循环遍历空集合，旧 mergeCells 永不撤销，
    // vtable 残留旧标底文本（如筛选后仍显示 ad2609）。
    const mergedAll = applyRowMerges()
    if (mergeRafRef.current != null) cancelAnimationFrame(mergeRafRef.current)
    if (!mergedAll && typeof requestAnimationFrame === 'function') {
      mergeRafRef.current = requestAnimationFrame(() => {
        mergeRafRef.current = null
        applyRowMerges()
      })
    }
    scheduleVisibleRangeReport()
    // 全量重建后立即递增版本号，强制刷新可见区（之前已滚到的行可能未跟上）
    setVisibleRangeVersion((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records])

  // 搜索选择后定位到具体 C/P 半区。vtable 行 0 是表头，C/P 列分别从 0/6 开始。
  // 直接使用合约 ID 查找记录，避免把同一行的另一侧误当成目标。
  useEffect(() => {
    if (!selectedInstrument || !tableRef.current) return
    const rowIndex = records.findIndex(
      (record) => record.callInstrumentID === selectedInstrument || record.putInstrumentID === selectedInstrument,
    )
    if (rowIndex < 0) return
    const record = records[rowIndex]
    const col = record.callInstrumentID === selectedInstrument ? 0 : 6
    tableRef.current.scrollToCell?.({ row: rowIndex + 1, col })
  }, [records, selectedInstrument])

  // snapshot 增量更新：仅对当前可见区行按引用对比，找出快照引用变化的行调用 updateRecords。
  // 仿照 QuoteTable.tsx:548-575 的 snapshot 增量路径；PRELOAD=0 → 仅屏幕上可见的行被更新。
  useEffect(() => {
    if (!tableRef.current) return
    const range = tableRef.current.getBodyVisibleCellRange?.()
    if (!range) return

    const startRow = Math.max(0, range.rowStart - 1)
    const endRow = Math.min(recordsRef.current.length - 1, range.rowEnd - 1)

    const rowIndexes: number[] = []
    const updatedRecords: OptionsRecord[] = []
    for (let i = startRow; i <= endRow; i++) {
      const rowRecord = recordsRef.current[i]
      if (!rowRecord) continue
      if (rowRecord.kind !== 'option') continue // 标底层无 C/P 快照，跳过
      const cSnap = rowRecord.callInstrumentID ? snapshots?.get(rowRecord.callInstrumentID) : undefined
      const pSnap = rowRecord.putInstrumentID ? snapshots?.get(rowRecord.putInstrumentID) : undefined
      const prevCRef = rowSnapshotRef.current[i]?.c
      const prevPRef = rowSnapshotRef.current[i]?.p
      if (cSnap === prevCRef && pSnap === prevPRef) continue // 该行两个快照引用都未变
      const next = {
        ...rowRecord,
        callLastPrice: cSnap?.lastPrice ?? rowRecord.callLastPrice,
        callBidPrice: cSnap?.bidPrice1 ?? rowRecord.callBidPrice,
        callAskPrice: cSnap?.askPrice1 ?? rowRecord.callAskPrice,
        callVolume: cSnap?.volume ?? rowRecord.callVolume,
        callOpenInterest: cSnap?.openInterest ?? rowRecord.callOpenInterest,
        putLastPrice: pSnap?.lastPrice ?? rowRecord.putLastPrice,
        putBidPrice: pSnap?.bidPrice1 ?? rowRecord.putBidPrice,
        putAskPrice: pSnap?.askPrice1 ?? rowRecord.putAskPrice,
        putVolume: pSnap?.volume ?? rowRecord.putVolume,
        putOpenInterest: pSnap?.openInterest ?? rowRecord.putOpenInterest,
      }
      recordsRef.current[i] = next
      rowSnapshotRef.current[i] = { c: cSnap, p: pSnap }
      updatedRecords.push(next)
      rowIndexes.push(i)
    }
    if (updatedRecords.length > 0) {
      tableRef.current.updateRecords(updatedRecords, rowIndexes)
      // updateRecords 可能破坏标底行合并 → 下一帧前全量重建合并，防止折叠/滚动后残留旧标底文本（重复 ad2609）
      scheduleMergeReconcile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, visibleRangeVersion])

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
