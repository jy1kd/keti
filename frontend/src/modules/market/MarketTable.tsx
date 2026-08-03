import { useRef, useEffect, useCallback } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'

interface MarketTableProps {
  contracts: ContractInfo[]
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  onRowClick?: (instrumentID: string, price: number) => void
  onRowDoubleClick?: (instrumentID: string, price: number) => void
  /** 右键菜单回调，传入合约 ID、价格、鼠标事件 */
  onContextMenu?: (instrumentID: string, price: number, event: MouseEvent) => void
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

/** 列级 style 回调：通过 table.records 拿到行数据，按涨跌着色 */
function coloredStyle(args: any) {
  const record = args.table?.records?.[args.row]
  return { color: priceColor(record) }
}

const columns = [
  { field: 'instrumentID', title: '合约', width: 90 },
  { field: 'productName', title: '合约品种', width: 100 },
  { field: 'exchangeID', title: '交易所', width: 70 },
  { field: 'expireDate', title: '到期日', width: 90 },
  { field: 'lastPrice', title: '最新价', width: 100, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 80, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 80, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 100, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 100, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 100 },
  { field: 'openInterest', title: '持仓量', width: 100 },
  { field: 'favorite', title: '⭐', width: 50 },
]

const CTP_INVALID_PRICE = 1.7976931348623157e+308
const isValidPrice = (p: number) => p > 0 && p < CTP_INVALID_PRICE

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean) {
  const productName = getProductName(contract.productID)
  if (!snap) {
    return {
      instrumentID: contract.instrumentID,
      productName,
      exchangeID: contract.exchangeID || PLACEHOLDER,
      expireDate: contract.expireDate || PLACEHOLDER,
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
    expireDate: contract.expireDate || PLACEHOLDER,
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

export function MarketTable({ contracts, snapshots, selectedInstrument, onRowClick, onRowDoubleClick, onVisibleRangeChange, favoritedIds, onFavoriteChange, selectedContracts, onSelectionChange }: MarketTableProps) {
export function MarketTable({ contracts, snapshots, selectedInstrument, onRowClick, onRowDoubleClick, onContextMenu, onVisibleRangeChange, favoritedIds, onFavoriteChange }: MarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<ListTable | null>(null)
  const onClickRef = useRef(onRowClick)
  const onDblClickRef = useRef(onRowDoubleClick)
  const onContextMenuRef = useRef(onContextMenu)
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange)
  const onFavoriteChangeRef = useRef(onFavoriteChange)
  const favoritedIdsRef = useRef(favoritedIds)
  const selectedContractsRef = useRef(selectedContracts)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const lastClickedIndexRef = useRef<number | null>(null)
  const recordsRef = useRef<ReturnType<typeof buildRecord>[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])
  useEffect(() => { onContextMenuRef.current = onContextMenu }, [onContextMenu])
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
        scrollStyle: {
          scrollSliderColor: '#30363d',
          scrollRailColor: '#161b22',
          visible: 'always',
        },
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

      // 多选逻辑
      const event = args.event as MouseEvent
      const prevLastClicked = lastClickedIndexRef.current

      // 先记录上次点击的行索引
      lastClickedIndexRef.current = rowIndex

      console.log('[MarketTable] Click:', {
        rowIndex,
        shiftKey: event?.shiftKey,
        ctrlKey: event?.ctrlKey,
        lastClicked: prevLastClicked,
        hasOnSelectionChange: !!onSelectionChangeRef.current,
      })

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

      // 触发单击回调
      if (onClickRef.current) {
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onClickRef.current(record.instrumentID, price)
      }
    })

    table.on('dblclick_cell', (args: any) => {
      const rowIndex = args.row - 1
      const record = recordsRef.current[rowIndex]
      if (record && onDblClickRef.current) {
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onDblClickRef.current(record.instrumentID, price)
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
    // 右键菜单事件
    table.on('contextmenu_cell', (args: any) => {
      const rowIndex = args.row - 1
      const record = recordsRef.current[rowIndex]
      if (record && onContextMenuRef.current) {
        const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onContextMenuRef.current(record.instrumentID, price, args.event)
      }
    })

    // 收藏列点击事件
    table.on('click_cell', (args: any) => {
      const colIndex = args.col
      const rowIndex = args.row - 1
      // 检查是否点击了收藏列（最后一列）
      if (colIndex === columns.length - 1) {
        const record = recordsRef.current[rowIndex]
        if (record && onFavoriteChangeRef.current) {
          const isFavorited = favoritedIdsRef.current?.has(record.instrumentID) ?? false
          onFavoriteChangeRef.current(record.instrumentID, !isFavorited)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

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
          const cellInfo = (tableRef.current as any).getCellAt?.(x, y)
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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(notifyVisibleRange, 100)
    })

    tableRef.current = table

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      table.release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update records when contracts or snapshots change (sync)
  useEffect(() => {
    if (!tableRef.current) return
    const records = contracts.map((contract) => buildRecord(contract, snapshots.get(contract.instrumentID), favoritedIds?.has(contract.instrumentID) ?? false))
    recordsRef.current = records
    tableRef.current.setRecords(records)

    // contracts 变化后重置 Shift+点击的索引（避免指向错误的行）
    lastClickedIndexRef.current = null

    // contracts 变化后触发可见行检测
    setTimeout(notifyVisibleRange, 0)
  }, [contracts, snapshots, notifyVisibleRange, favoritedIds])

  // selectedContracts 变化时更新行高亮
  useEffect(() => {
    if (!tableRef.current) return
    // 触发 vtable 重新渲染行样式
    // vtable 的 bodyStyle.bgColor 函数会在重绘时被调用
    tableRef.current.invalidate?.() || tableRef.current.setRecords(recordsRef.current)
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
