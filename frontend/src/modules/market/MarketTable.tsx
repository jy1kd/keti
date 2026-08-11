import { useRef, useEffect, useCallback, useState } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'
import { getContractStatus, type ContractStatus } from '@/utils/contractStatus'
import { SCROLLBAR_SIZE, SCROLL_STYLE } from '@/utils/vtableTheme'
import { useMarketStore } from './store'

interface MarketTableProps {
  contracts: ContractInfo[]
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  onRowClick?: (instrumentID: string, price: number) => void
  onRowDoubleClick?: (instrumentID: string, price: number) => void
  /** 单选右键菜单回调，传入合约 ID、价格、鼠标事件 */
  onContextMenu?: (instrumentID: string, price: number, event: MouseEvent) => void
  /** 多选右键菜单回调，传入选中的合约 ID 列表和鼠标事件 */
  onMultiSelectContextMenu?: (instrumentIDs: string[], event: MouseEvent) => void
  /** 可见行变化回调，传入当前可见的合约 ID 列表 */
  onVisibleRangeChange?: (visibleInstrumentIDs: string[]) => void
  /** 收藏的合约 ID 集合 */
  favoritedIds?: Set<string>
  /** 收藏状态变化回调 */
  onFavoriteChange?: (instrumentID: string, isFavorited: boolean) => void
  /** 多选的合约 ID 集合 */
  selectedContracts?: Set<string>
  /** 多选变化回调 */
  onSelectionChange?: (selectedIDs: Set<string>) => void
}

const PLACEHOLDER = '--'

/** mouseup 距上次 scroll 在此窗口内视为滚动条释放（松手） */
const SCROLL_RELEASE_WINDOW_MS = 200

const UP_COLOR = '#ef4444'
const DOWN_COLOR = '#22c55e'
const FLAT_COLOR = '#e6edf3'

/** 根据 record.change 正负返回文字颜色 */
function priceColor(record: any): string {
  const change = typeof record?.change === 'number' ? record.change : 0
  if (change > 0) return UP_COLOR
  if (change < 0) return DOWN_COLOR
  return FLAT_COLOR
}

/** 列级 style 回调：通过 table.records 拿到行数据，按涨跌着色
 * 注意：args.row 是 vtable 物理行号（0=表头），records 是 0 起始数据数组，需 -1 */
function coloredStyle(args: any) {
  const record = args.table?.records?.[args.row - 1]
  return { color: priceColor(record) }
}

/** 状态列着色：交易中绿色 / 已停牌橙色 / 已到期灰色（row 需 -1，理由同上） */
function statusStyle(args: any) {
  const record = args.table?.records?.[args.row - 1]
  const status = record?.status as ContractStatus | undefined
  if (status === '交易中') return { color: '#3fb950' }
  if (status === '已停牌') return { color: '#d29922' }
  return { color: '#8b949e' }
}

const columns = [
  { field: 'instrumentID', title: '合约', width: 110 },
  { field: 'productName', title: '合约品种', width: 85 },
  { field: 'exchangeID', title: '交易所', width: 75 },
  { field: 'volumeMultiple', title: '合约乘数', width: 85 },
  { field: 'priceTick', title: '最小变动价位', width: 110 },
  { field: 'expireDate', title: '到期日', width: 100 },
  { field: 'status', title: '状态', width: 80, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 110, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 100, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 100, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 110, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 110, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 110 },
  { field: 'openInterest', title: '持仓量', width: 110 },
  { field: 'favorite', title: '⭐', width: 60 },
]

const CTP_INVALID_PRICE = 1.7976931348623157e+308
const isValidPrice = (p: number) => p > 0 && p < CTP_INVALID_PRICE

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean) {
  const productName = getProductName(contract.productID)
  const status = getContractStatus(contract)
  if (!snap) {
    return {
      instrumentID: contract.instrumentID,
      productName,
      exchangeID: contract.exchangeID || PLACEHOLDER,
      volumeMultiple: contract.volumeMultiple,
      priceTick: contract.priceTick,
      expireDate: contract.expireDate || PLACEHOLDER,
      status,
      lastPrice: PLACEHOLDER,
      change: PLACEHOLDER,
      changePercent: PLACEHOLDER,
      bidPrice1: PLACEHOLDER,
      askPrice1: PLACEHOLDER,
      volume: PLACEHOLDER,
      openInterest: PLACEHOLDER,
      favorite: isFavorited ? '⭐' : '☆',
    }
  }
  // preSettlementPrice 可能为 0（CTP DBL_MAX 被 sanitize 后），此时 fallback 到昨收
  const preSettlement = (snap.preSettlementPrice && snap.preSettlementPrice > 0)
    ? snap.preSettlementPrice
    : (snap.preClosePrice || snap.lastPrice)
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    instrumentID: snap.instrumentID,
    productName,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    volumeMultiple: contract.volumeMultiple,
    priceTick: contract.priceTick,
    expireDate: contract.expireDate || PLACEHOLDER,
    status,
    lastPrice: isValidPrice(snap.lastPrice) ? snap.lastPrice : PLACEHOLDER,
    change: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? change : PLACEHOLDER,
    changePercent: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? changePercent : PLACEHOLDER,
    bidPrice1: isValidPrice(snap.bidPrice1) ? snap.bidPrice1 : PLACEHOLDER,
    askPrice1: isValidPrice(snap.askPrice1) ? snap.askPrice1 : PLACEHOLDER,
    volume: snap.volume,
    openInterest: snap.openInterest,
    favorite: isFavorited ? '⭐' : '☆',
  }
}

export function MarketTable({ contracts, snapshots, selectedInstrument, onRowClick, onRowDoubleClick, onContextMenu, onMultiSelectContextMenu, onVisibleRangeChange, favoritedIds, onFavoriteChange, selectedContracts, onSelectionChange }: MarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const onClickRef = useRef(onRowClick)
  const onDblClickRef = useRef(onRowDoubleClick)
  const onContextMenuRef = useRef(onContextMenu)
  const onMultiSelectContextMenuRef = useRef(onMultiSelectContextMenu)
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange)
  const onFavoriteChangeRef = useRef(onFavoriteChange)
  const favoritedIdsRef = useRef(favoritedIds)
  const selectedContractsRef = useRef(selectedContracts)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const lastClickedIndexRef = useRef<number | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const lastClickRowRef = useRef<number>(-1)
  const recordsRef = useRef<ReturnType<typeof buildRecord>[]>([])
  /** 每行最近一次 buildRecord 所用的 snapshot 引用（按行跟踪，仅对可见行生效） */
  const rowSnapshotRef = useRef<(MarketSnapshot | undefined)[]>([])
  /** 可见区版本号：滚动导致可见范围变化时递增，驱动局部更新 effect 重算（滚入新区域的行立即刷新） */
  const [visibleRangeVersion, setVisibleRangeVersion] = useState(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 最近一次滚动发生的时间戳（松手检测窗口依据） */
  const lastScrollAtRef = useRef(0)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])
  useEffect(() => { onContextMenuRef.current = onContextMenu }, [onContextMenu])
  useEffect(() => { onMultiSelectContextMenuRef.current = onMultiSelectContextMenu }, [onMultiSelectContextMenu])
  useEffect(() => { onVisibleRangeChangeRef.current = onVisibleRangeChange }, [onVisibleRangeChange])
  useEffect(() => { onFavoriteChangeRef.current = onFavoriteChange }, [onFavoriteChange])
  useEffect(() => { favoritedIdsRef.current = favoritedIds }, [favoritedIds])
  useEffect(() => { selectedContractsRef.current = selectedContracts }, [selectedContracts])
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])

  // 可见行检测函数（提取为共享），包含预加载
  const notifyVisibleRange = useCallback(() => {
    if (!onVisibleRangeChangeRef.current || !tableRef.current) return
    try {
      const range = tableRef.current.getBodyVisibleCellRange()
      if (!range) return
      const PRELOAD_ROWS = 10
      const startRow = Math.max(0, range.rowStart - 1 - PRELOAD_ROWS) // vtable row 0 = header，向上预加载
      const endRow = Math.min(recordsRef.current.length - 1, range.rowEnd - 1 + PRELOAD_ROWS) // 向下预加载
      const visibleIDs: string[] = []
      for (let i = startRow; i <= endRow; i++) {
        const record = recordsRef.current[i]
        if (record) visibleIDs.push(record.instrumentID)
      }
      onVisibleRangeChangeRef.current(visibleIDs)
      // 可见区变化 → 递增版本号，驱动局部更新 effect 对滚入的新行立即重算
      setVisibleRangeVersion((v) => v + 1)
    } catch {
      // vtable 尚未就绪
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const records = contracts.map((c) => buildRecord(c, snapshots.get(c.instrumentID), favoritedIds?.has(c.instrumentID) ?? false))
    recordsRef.current = records

    const table = new ListTable(containerRef.current, {
      columns,
      records,
      frozenColCount: 1, // 冻结「合约」列：横向拖动时固定最左侧
      widthMode: 'adaptive',
      theme: {
        underlayBackgroundColor: '#0d1117',
        defaultStyle: {
          fontSize: 12,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          color: '#e6edf3',
          bgColor: '#0d1117',
          borderColor: '#21262d',
          hover: {
            cellBgColor: '#1c2333',
          },
          select: {
            inlineRowBgColor: 'rgba(240, 180, 41, 0.12)',
          },
        },
        headerStyle: {
          fontSize: 11,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          fontWeight: '600',
          color: '#8b949e',
          bgColor: '#161b22',
          borderColor: '#30363d',
        },
        bodyStyle: {
          bgColor: (args: any) => {
            // 多选高亮
            const record = args.table?.records?.[args.row - 1]
            if (record && selectedContractsRef.current?.has(record.instrumentID)) {
              return 'rgba(59, 130, 246, 0.15)' // 蓝色高亮
            }
            return '#0d1117'
          },
          borderColor: '#21262d',
        },
        selectionStyle: {
          cellBorderColor: '#f0b429',
          cellBorderLineWidth: 1,
          cellBgColor: 'rgba(240, 180, 41, 0.08)',
          inlineRowBgColor: 'rgba(240, 180, 41, 0.12)',
        },
        scrollStyle: { ...SCROLL_STYLE },
        frameStyle: {
          borderColor: '#30363d',
          cornerRadius: 0,
        },
      },
    })

    table.on('click_cell', (args: any) => {
      const rowIndex = args.row - 1 // vtable row 0 = header, row 1 = first data row
      const colIndex = args.col
      const record = recordsRef.current[rowIndex]
      if (!record) return

      // 收藏列点击
      if (colIndex === columns.length - 1) {
        if (onFavoriteChangeRef.current) {
          const isFavorited = favoritedIdsRef.current?.has(record.instrumentID) ?? false
          onFavoriteChangeRef.current(record.instrumentID, !isFavorited)
        }
        return
      }

      // 双击检测：同一行 300ms 内连续点击视为双击
      const now = Date.now()
      const isDoubleClick =
        lastClickRowRef.current === rowIndex &&
        now - lastClickTimeRef.current < 300
      lastClickTimeRef.current = now
      lastClickRowRef.current = rowIndex

      // 多选逻辑（双击时不处理多选）
      const event = args.event as MouseEvent
      const prevLastClicked = lastClickedIndexRef.current

      if (!isDoubleClick) {
        // 先记录上次点击的行索引
        lastClickedIndexRef.current = rowIndex

        if (onSelectionChangeRef.current) {
          const currentSelected = new Set(selectedContractsRef.current ?? [])

          if (event?.ctrlKey || event?.metaKey) {
            // Ctrl+点击：逐个选择/取消选择
            if (currentSelected.has(record.instrumentID)) {
              currentSelected.delete(record.instrumentID)
            } else {
              currentSelected.add(record.instrumentID)
            }
            onSelectionChangeRef.current(currentSelected)
          } else if (event?.shiftKey && prevLastClicked !== null) {
            // Shift+点击：范围选择
            console.log('[MarketTable] Shift+click range:', prevLastClicked, 'to', rowIndex)
            const start = Math.min(prevLastClicked, rowIndex)
            const end = Math.max(prevLastClicked, rowIndex)
            for (let i = start; i <= end; i++) {
              const r = recordsRef.current[i]
              if (r) currentSelected.add(r.instrumentID)
            }
            onSelectionChangeRef.current(currentSelected)
          } else {
            // 普通点击：单选
            onSelectionChangeRef.current(new Set([record.instrumentID]))
          }
        }
      }

      // 触发回调：双击优先，否则单击
      const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
      if (isDoubleClick && onDblClickRef.current) {
        onDblClickRef.current(record.instrumentID, price)
      } else if (onClickRef.current) {
        onClickRef.current(record.instrumentID, price)
      }
    })

    // Ctrl+A 全选
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // 检查焦点是否在表格内
        const activeElement = document.activeElement
        if (activeElement && containerRef.current?.contains(activeElement)) {
          e.preventDefault()
          if (onSelectionChangeRef.current) {
            const allIDs = recordsRef.current.map(r => r.instrumentID).filter(Boolean)
            onSelectionChangeRef.current(new Set(allIDs))
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // 右键菜单事件
    table.on('contextmenu_cell', (args: any) => {
      const rowIndex = args.row - 1
      const record = recordsRef.current[rowIndex]
      if (!record) return

      const event = args.event as MouseEvent
      const selected = selectedContractsRef.current

      // 如果右键点击的行在多选范围内，且有多选回调，显示多选菜单
      if (selected && selected.size > 1 && selected.has(record.instrumentID) && onMultiSelectContextMenuRef.current) {
        onMultiSelectContextMenuRef.current(Array.from(selected), event)
      } else {
        // 右键落在集合外 → 先同步蓝区（单选该合约），再显示单选菜单
        if (onSelectionChangeRef.current) {
          onSelectionChangeRef.current(new Set([record.instrumentID]))
        }
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onContextMenuRef.current?.(record.instrumentID, price, event)
      }
    })

    // 鼠标拖动选择
    let isDragging = false
    let dragStartRow = -1
    let dragSelected = new Set<string>()

    const getRowFromEvent = (e: MouseEvent): number => {
      // 使用 vtable 的 API 获取准确的行索引
      const target = e.target as HTMLElement
      const cell = target?.closest('td') || target?.closest('[data-row]')
      if (cell) {
        const rowAttr = cell.getAttribute('data-row') || cell.parentElement?.getAttribute('data-row')
        if (rowAttr) {
          return parseInt(rowAttr, 10) - 1 // vtable 的 data-row 从 1 开始
        }
      }
      // 备用方案：通过 vtable 的getCellAt 方法
      try {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect && tableRef.current) {
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          // 排除滚动条区域：底部横向进度条 / 右侧纵向滚动条。
          // 否则拖拽进度条时 getCellAt 会把该区域判成「邻近的行」→ 误触发多选，与滚动条拖动冲突。
          const table = tableRef.current as any
          const tH = table.tableNoFrameHeight
          const tW = table.tableNoFrameWidth
          if (
            (typeof tH === 'number' && y >= tH - SCROLLBAR_SIZE) ||
            (typeof tW === 'number' && x >= tW - SCROLLBAR_SIZE)
          ) {
            return -1
          }
          const cellInfo = table.getCellAt?.(x, y)
          if (cellInfo && cellInfo.row !== undefined) {
            return cellInfo.row - 1
          }
        }
      } catch {
        // 忽略错误
      }
      return -1
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // 只处理左键
      const rowIndex = getRowFromEvent(e)
      if (rowIndex < 0 || rowIndex >= recordsRef.current.length) return

      isDragging = true
      dragStartRow = rowIndex
      dragSelected = new Set(selectedContractsRef.current ?? [])

      // 如果没有按 Ctrl/Shift，开始新的选择
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        dragSelected = new Set()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const rowIndex = getRowFromEvent(e)
      if (rowIndex < 0 || rowIndex >= recordsRef.current.length) return

      // 计算选择范围
      const start = Math.min(dragStartRow, rowIndex)
      const end = Math.max(dragStartRow, rowIndex)

      const newSelected = new Set(dragSelected)
      for (let i = start; i <= end; i++) {
        const record = recordsRef.current[i]
        if (record) newSelected.add(record.instrumentID)
      }

      if (onSelectionChangeRef.current) {
        onSelectionChangeRef.current(newSelected)
      }
    }

    const handleMouseUp = () => {
      isDragging = false
      dragStartRow = -1
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    // 初始渲染后触发一次（延迟确保 vtable 就绪）
    setTimeout(notifyVisibleRange, 0)

    // 滚动时触发（100ms 防抖）
    table.on('scroll', () => {
      lastScrollAtRef.current = Date.now()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(notifyVisibleRange, 100)
    })

    // 滚动条释放（mouseup 距上次 scroll < 200ms）→ 最终 notify + 完整 diff 信号
    const handleScrollEnd = () => {
      if (Date.now() - lastScrollAtRef.current > SCROLL_RELEASE_WINDOW_MS) return
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      notifyVisibleRange()
      useMarketStore.getState().markScrollEnd()
    }
    window.addEventListener('mouseup', handleScrollEnd)

    tableRef.current = table

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseup', handleScrollEnd)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      table.release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 合约列表或收藏变化 → 全量 setRecords（低频）
  useEffect(() => {
    if (!tableRef.current) return
    const records = contracts.map((contract) => buildRecord(contract, snapshots.get(contract.instrumentID), favoritedIds?.has(contract.instrumentID) ?? false))
    recordsRef.current = records
    // 重置每行 snapshot 跟踪：全量重建后所有行都视为已同步
    rowSnapshotRef.current = contracts.map((c) => snapshots.get(c.instrumentID))
    tableRef.current.setRecords(records)
    lastClickedIndexRef.current = null
    setTimeout(notifyVisibleRange, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, favoritedIds])

  // snapshots 变化 或 可见区变化 → 仅对可见行局部 updateRecords。
  // 高频 tick 下逐行按 snapshot 引用比较（rowSnapshotRef），避免对几百个订阅合约全量 buildRecord；
  // 滚动到新区域时 visibleRangeVersion 递增，触发本 effect 对滚入的行立即重算。
  useEffect(() => {
    if (!tableRef.current) return
    const range = tableRef.current.getBodyVisibleCellRange?.()
    if (!range) return

    const PRELOAD_ROWS = 10
    const startRow = Math.max(0, range.rowStart - 1 - PRELOAD_ROWS) // vtable row 0 = header，向上预加载
    const endRow = Math.min(recordsRef.current.length - 1, range.rowEnd - 1 + PRELOAD_ROWS) // 向下预加载

    const rowIndexes: number[] = []
    const updatedRecords: ReturnType<typeof buildRecord>[] = []
    for (let i = startRow; i <= endRow; i++) {
      const rowSnap = rowSnapshotRef.current[i]
      const rowRecord = recordsRef.current[i]
      if (!rowRecord) continue
      const snap = snapshots.get(rowRecord.instrumentID)
      if (rowSnap === snap) continue // 该行快照引用未变
      const record = buildRecord(contracts[i], snap, favoritedIds?.has(rowRecord.instrumentID) ?? false)
      recordsRef.current[i] = record
      rowSnapshotRef.current[i] = snap
      updatedRecords.push(record)
      rowIndexes.push(i) // updateRecords 第二参数是 0-based 记录索引（表头偏移由 vtable 内部处理）
    }
    if (updatedRecords.length > 0) {
      tableRef.current.updateRecords(updatedRecords, rowIndexes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, visibleRangeVersion, contracts, favoritedIds])

  // selectedContracts 变化时更新行高亮
  useEffect(() => {
    if (!tableRef.current) return
    // 触发 vtable 重新渲染行样式
    // vtable 的 bodyStyle.bgColor 函数会在重绘时被调用
    tableRef.current.setRecords(recordsRef.current)
  }, [selectedContracts])

  // 高亮选中合约行（rAF 等 vtable setRecords 渲染完成）
  useEffect(() => {
    if (!tableRef.current || !selectedInstrument) return
    const rowIndex = contracts.findIndex((c) => c.instrumentID === selectedInstrument)
    if (rowIndex < 0) return
    const vtableRow = rowIndex + 1
    const raf = requestAnimationFrame(() => {
      try {
        tableRef.current?.selectRow(vtableRow)
        // 仅当目标行不在可视区内才滚动，避免点击后行被顶到表格首位
        const range = tableRef.current?.getBodyVisibleCellRange()
        if (range && (vtableRow < range.rowStart || vtableRow > range.rowEnd)) {
          tableRef.current?.scrollToCell({ row: vtableRow, col: 0 })
        }
      } catch {
        // vtable 尚未就绪
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedInstrument, contracts])

  return <div ref={containerRef} className="market-table-container" />
}
