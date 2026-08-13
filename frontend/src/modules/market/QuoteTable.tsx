import { useRef, useEffect, useCallback, useState } from 'react'
import { ListTable } from '@visactor/vtable'
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { SCROLLBAR_SIZE, SCROLL_STYLE } from '@/utils/vtableTheme'
import { useMarketStore } from './store'
import { PLACEHOLDER, shouldRenderAnchor, type QuoteRecord, type QuoteTableSpec } from './quoteTableCore'

interface QuoteTableProps {
  /**
   * 行情表 spec（列定义 + buildRecord + 可选行级样式）。
   * 必须为模块级稳定常量（如 futuresSpec/optionsSpec），运行时不得替换；
   * 传入身份会变化的 spec 将导致表格陈旧（columns/buildRecord/rowStyle 被冻结）。
   */
  spec: QuoteTableSpec
  contracts: ContractInfo[]
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  /** 当前标签是否激活（激活时重报可见区） */
  isActive?: boolean
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

/** mouseup 距上次 scroll 在此窗口内视为滚动条释放（松手） */
const SCROLL_RELEASE_WINDOW_MS = 200

/** 标底行（合并表头行）合约列样式：红/粗/大字（比默认 12 加大） */
const UNDERLYING_HEADER_STYLE = { color: '#f87171', fontWeight: 'bold', fontSize: 14 }

/**
 * 合约列样式包装：标底行（整行合并后该样式作用于合并单元格）→ 红/粗/大字；
 * 其余行保持列原样式（optionsSpec 合约列无 style，futuresSpec 若有则透传）。
 * 不修改 spec.columns（模块级共享常量），仅对 ListTable 传入一份包装副本。
 */
function withUnderlyingHeaderStyle(columns: QuoteTableSpec['columns']): QuoteTableSpec['columns'] {
  return columns.map((col) => {
    if (col.field !== 'instrumentID') return col
    return {
      ...col,
      style: (args: any) => {
        const record = args.table?.records?.[args.row - 1]
        if (record?.kind === 'underlying') return UNDERLYING_HEADER_STYLE
        return col.style?.(args)
      },
    }
  })
}

export function QuoteTable({ spec, contracts, snapshots, selectedInstrument, isActive, onRowClick, onRowDoubleClick, onContextMenu, onMultiSelectContextMenu, onVisibleRangeChange, favoritedIds, onFavoriteChange, selectedContracts, onSelectionChange }: QuoteTableProps) {
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
  /** 最近一次 isActive：隐藏面板（isActive=false，display:none）挂载/重建时不上报可见区，
   *  避免覆盖活跃面板的可见范围 → 活跃表失去订阅（Critical #1）。undefined=未指定→按历史行为上报。 */
  const isActiveRef = useRef(isActive)
  /** dev 守卫：记录最近一次 spec 引用，检测运行时 spec 身份变化（spec 必须为稳定常量） */
  const specRef = useRef(spec)
  const lastClickedIndexRef = useRef<number | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const lastClickRowRef = useRef<number>(-1)
  const recordsRef = useRef<QuoteRecord[]>([])
  /** 每行最近一次 buildRecord 所用的 snapshot 引用（按行跟踪，仅对可见行生效） */
  const rowSnapshotRef = useRef<(MarketSnapshot | undefined)[]>([])
  /** 可见区版本号：滚动导致可见范围变化时递增，驱动局部更新 effect 重算（滚入新区域的行立即刷新） */
  const [visibleRangeVersion, setVisibleRangeVersion] = useState(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 最近一次滚动发生的时间戳（松手检测窗口依据） */
  const lastScrollAtRef = useRef(0)
  /** 已合并的标底行 vtable 物理行号集合（0=表头）：跟踪合并状态 → 撤销漂移行 + 跳过重复合并 */
  const mergedRowsRef = useRef<Set<number>>(new Set())
  /** 合并兜底 rAF 句柄（渲染异步未就绪时重试；卸载/重建时清除在排队帧） */
  const mergeRafRef = useRef<number | null>(null)

  useEffect(() => { onClickRef.current = onRowClick }, [onRowClick])
  useEffect(() => { onDblClickRef.current = onRowDoubleClick }, [onRowDoubleClick])
  useEffect(() => { onContextMenuRef.current = onContextMenu }, [onContextMenu])
  useEffect(() => { onMultiSelectContextMenuRef.current = onMultiSelectContextMenu }, [onMultiSelectContextMenu])
  useEffect(() => { onVisibleRangeChangeRef.current = onVisibleRangeChange }, [onVisibleRangeChange])
  useEffect(() => { onFavoriteChangeRef.current = onFavoriteChange }, [onFavoriteChange])
  useEffect(() => { favoritedIdsRef.current = favoritedIds }, [favoritedIds])
  useEffect(() => { selectedContractsRef.current = selectedContracts }, [selectedContracts])
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  // 开发期守卫：spec 必须为模块级稳定常量（futuresSpec/optionsSpec）。运行时替换 spec 会
  // 导致表格陈旧——columns/buildRecord/rowStyle 冻结在首渲染闭包内。仅 dev 告警，不抛错。
  useEffect(() => {
    if (import.meta.env.DEV && specRef.current !== spec) {
      console.warn('[QuoteTable] spec 身份变化——spec 必须为稳定常量，运行时替换不支持')
    }
    specRef.current = spec
  }, [spec])

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

  // 挂载/重建后延迟上报可见区。隐藏面板（isActive=false）跳过，避免覆盖活跃面板的可见范围；
  // 激活时由 isActive 翻转 effect 补报（见组件底部）。
  const scheduleVisibleRangeReport = useCallback(() => {
    if (isActiveRef.current === false) return
    setTimeout(notifyVisibleRange, 0)
  }, [notifyVisibleRange])

  /**
   * 合并标底行为整行表头：`mergeCells(0, row, colCount-1, row)`（vtable 行号 0=表头，记录索引 +1）。
   * 在 setRecords 之后调用（vtable 场景图由 setRecords 同步构建，直接合并即可）：
   * - 先撤销已合并但不再是标底的行（setRecords 重建数据后行号可能漂移，旧合并会残留在错误行）；
   * - 再合并当前标底行，已合并行跳过（避免重复 push customMergeCell → 渲染错乱）；
   * - 合并失败（渲染异步未就绪）的行不入集合，由 rAF 兜底重试（见 contracts effect）。
   */
  const applyRowMerges = useCallback(() => {
    const table = tableRef.current
    if (!table || typeof table.mergeCells !== 'function') return
    const lastCol = spec.columns.length - 1
    const underlyingRows = new Set<number>()
    recordsRef.current.forEach((record, i) => {
      if (record.kind === 'underlying') underlyingRows.add(i + 1)
    })
    // 撤销不再标底的行（unmergeCells 不存在则跳过，兼容无合并语义的表）
    for (const row of mergedRowsRef.current) {
      if (!underlyingRows.has(row)) {
        try {
          table.unmergeCells?.(0, row, lastCol, row)
        } catch {
          // vtable 尚未就绪，忽略
        }
      }
    }
    const next = new Set<number>()
    for (const row of underlyingRows) {
      if (mergedRowsRef.current.has(row)) {
        next.add(row)
        continue
      }
      try {
        table.mergeCells(0, row, lastCol, row)
        next.add(row)
      } catch {
        // 本轮未就绪，留待下一轮 setRecords/rAF 重试
      }
    }
    mergedRowsRef.current = next
  }, [spec])

  useEffect(() => {
    if (!containerRef.current) return

    const records = contracts.map((c) => spec.buildRecord(c, snapshots.get(c.instrumentID), favoritedIds?.has(c.instrumentID) ?? false))
    recordsRef.current = records

    const table = new ListTable(containerRef.current, {
      columns: withUnderlyingHeaderStyle(spec.columns),
      records,
      frozenColCount: 1, // 冻结「合约」列：横向拖动时固定最左侧
      widthMode: 'standard',
      columnResizeMode: 'all', // 保留每列拖拽缩放：可单独放大/缩小任意列宽
      select: {
        // 禁用 vtable 原生拖选扩展：拖选批量选中由下方 window 监听实现（蓝区），
        // 金色活动锚点由 shouldRenderAnchor 守卫 + selectRow/clearSelected 唯一控制。
        // 若不关掉，二次拖选时原生金色矩形会与 RAF selectRow 竞态，定格滞留无法清除。
        disableDragSelect: true,
      },
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
            // 行级样式（期权表标底行深色底）优先，无则按多选蓝高亮
            const record = args.table?.records?.[args.row - 1]
            if (record) {
              const rowBg = spec.rowStyle?.(record)?.bgColor
              if (rowBg != null) return rowBg as string
              if (selectedContractsRef.current?.has(record.instrumentID)) {
                return 'rgba(59, 130, 246, 0.15)' // 蓝色高亮
              }
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
      if (colIndex === spec.columns.length - 1) {
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
      const price = record.lastPrice == null || record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
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
        const price = record.lastPrice == null || record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
        onContextMenuRef.current?.(record.instrumentID, price, event)
      }
    })

    // 鼠标拖动选择
    let isDragging = false
    let dragStartRow = -1
    let dragSelected = new Set<string>()
    /** 本次按下是否为普通拖选（无 Ctrl/Shift）：首次 mousemove 时清掉金色锚点 */
    let plainDragStart = false

    const getRowFromEvent = (e: MouseEvent): number => {
      // VTable 1.26 纯 canvas 渲染，表格内无 <td>/[data-row] 元素，
      // 不再走 DOM 探测，直接经 getCellAt 按内容坐标解析行号。
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
          // getCellAt 按内容坐标解析（含滚动偏移），而 x/y 是视口坐标。
          // 必须补 scrollLeft/scrollTop，否则滚动后返回的行号偏小 → 拖选选中错行/选不中。
          const cellInfo = table.getCellAt?.(x + (table.scrollLeft ?? 0), y + (table.scrollTop ?? 0))
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
        // 普通拖选是批量操作：不同步金色锚点到起始行。
        // 首次 mousemove 时清掉金色锚点（见 handleMouseMove），
        // 保证拖选结束后金色不残留，仅保留蓝色选区。
        plainDragStart = true
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      // 普通拖选首次移动：清掉金色锚点，避免拖选把金色钉在起始行残留无法消除。
      // （仅在确认是拖拽而非点击时执行，点击走 click_cell 重新设置锚点，无闪烁。）
      if (plainDragStart) {
        plainDragStart = false
        useMarketStore.getState().setSelectedInstrument(null)
      }
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
      plainDragStart = false
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    // 初始渲染后触发一次（延迟确保 vtable 就绪；隐藏面板不参与上报）
    scheduleVisibleRangeReport()

    // 滚动时触发（100ms 防抖）
    table.on('scroll', () => {
      lastScrollAtRef.current = Date.now()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(notifyVisibleRange, 100)
    })

    // 滚动停止（mouseup/keyup 距上次 scroll < 200ms）→ 最终 notify + 完整 diff 信号。
    // keyup 覆盖键盘滚动（方向键/翻页）：无 mouseup，否则要等拖停 500ms 窗口才订阅。
    const handleScrollEnd = () => {
      if (Date.now() - lastScrollAtRef.current > SCROLL_RELEASE_WINDOW_MS) return
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      notifyVisibleRange()
      useMarketStore.getState().markScrollEnd()
    }
    window.addEventListener('mouseup', handleScrollEnd)
    window.addEventListener('keyup', handleScrollEnd)

    tableRef.current = table

    return () => {
      // 清除排队中的合并兜底帧（表已 release，避免对已释放实例补合并）
      if (mergeRafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(mergeRafRef.current)
        mergeRafRef.current = null
      }
      // 清空合并状态：StrictMode 下 effect setup→cleanup→setup 会重建新表实例，
      // 若残留旧表已合并行，applyRowMerges 会误判「已合并」而跳过 mergeCells → 标底行渲染为未合并。
      mergedRowsRef.current = new Set()
      window.removeEventListener('keydown', handleKeyDown)
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseup', handleScrollEnd)
      window.removeEventListener('keyup', handleScrollEnd)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      table.release()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 合约列表或收藏变化 → 全量 setRecords（低频）
  useEffect(() => {
    if (!tableRef.current) return
    const records = contracts.map((contract) => spec.buildRecord(contract, snapshots.get(contract.instrumentID), favoritedIds?.has(contract.instrumentID) ?? false))
    recordsRef.current = records
    // 重置每行 snapshot 跟踪：全量重建后所有行都视为已同步
    rowSnapshotRef.current = contracts.map((c) => snapshots.get(c.instrumentID))
    tableRef.current.setRecords(records)
    lastClickedIndexRef.current = null
    // 标底行合并：setRecords 场景图同步构建，直接合并；rAF 兜底重试渲染异步未就绪的行
    applyRowMerges()
    if (mergeRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(mergeRafRef.current)
    }
    if (typeof requestAnimationFrame === 'function') {
      mergeRafRef.current = requestAnimationFrame(() => {
        mergeRafRef.current = null
        applyRowMerges()
      })
    }
    // 合约重建后延迟补报可见区（隐藏面板不参与上报）
    scheduleVisibleRangeReport()
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
    const updatedRecords: QuoteRecord[] = []
    for (let i = startRow; i <= endRow; i++) {
      const rowSnap = rowSnapshotRef.current[i]
      const rowRecord = recordsRef.current[i]
      if (!rowRecord) continue
      const snap = snapshots.get(rowRecord.instrumentID)
      if (rowSnap === snap) continue // 该行快照引用未变
      const record = spec.buildRecord(contracts[i], snap, favoritedIds?.has(rowRecord.instrumentID) ?? false)
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

  // selectedContracts 变化时更新行高亮：仅重绘可见区单元格（bodyStyle.bgColor 回调重新求值），
  // 避免全量 setRecords 重建 1000+ 行。滚入新区域由 vtable 滚动重绘按当前 selectedContractsRef 求值。
  useEffect(() => {
    if (!tableRef.current) return
    try {
      const range = tableRef.current.getBodyVisibleCellRange?.()
      if (!range) return
      const colCount = tableRef.current.colCount ?? spec.columns.length
      tableRef.current.updateCellContentRange(0, range.rowStart, colCount - 1, range.rowEnd)
    } catch {
      // vtable 尚未就绪
    }
  }, [selectedContracts])

  // 高亮选中合约行（rAF 等 vtable setRecords 渲染完成）；金色活动锚点仅在选区内渲染
  useEffect(() => {
    if (!tableRef.current) return
    if (!shouldRenderAnchor(selectedInstrument, selectedContracts)) {
      // 锚点不在选区内 → 清除 vtable 原生金色选中，避免独立高亮区
      try {
        tableRef.current.clearSelected()
      } catch {
        // vtable 尚未就绪
      }
      return
    }
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
  }, [selectedInstrument, selectedContracts, contracts])

  // 标签激活（isActive 翻转为 true）时重报可见区：期权表切回期货标签等场景下
  // 订阅管理器以可见区为准，激活后立即补订阅（依赖空数组保证 notifyVisibleRange 引用稳定）
  useEffect(() => {
    if (isActive) notifyVisibleRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  return <div ref={containerRef} className="market-table-container" />
}
