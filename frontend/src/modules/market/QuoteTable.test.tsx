import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { QuoteTable } from './QuoteTable'
import { shouldRenderAnchor } from './quoteTableCore'
import { futuresSpec } from './futuresSpec'
import { optionsSpec } from './optionsSpec'
import { useMarketStore } from './store'
import type { MarketSnapshot, ContractInfo } from '@/services/types'

describe('QuoteTable', () => {
  const mockContracts: ContractInfo[] = [
    { instrumentID: 'au2508', instrumentName: '黄金2508', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '20250815', isTrading: 1, productClass: "1" },
    { instrumentID: 'ag2508', instrumentName: '白银2508', exchangeID: 'SHFE', productID: 'ag', volumeMultiple: 15, priceTick: 1, expireDate: '20250815', isTrading: 1, productClass: "1" },
  ]

  const mockSnapshots = new Map<string, MarketSnapshot>([
    ['au2508', { instrumentID: 'au2508', lastPrice: 480.5, bidPrice1: 480.4, askPrice1: 480.6, volume: 1000, openInterest: 5000 } as MarketSnapshot],
    ['ag2508', { instrumentID: 'ag2508', lastPrice: 6500, bidPrice1: 6499, askPrice1: 6501, volume: 2000, openInterest: 8000 } as MarketSnapshot],
  ])

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a container div', () => {
    const { container } = render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('creates ListTable with correct options', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    expect(ListTable).toHaveBeenCalledTimes(1)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columns).toBeDefined()
    expect(options.columns.length).toBeGreaterThan(0)
  })

  it('冻结合约列为最左列（frozenColCount=1）', async () => {
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.frozenColCount).toBe(1)
  })

  it('passes records from contracts to vtable', async () => {
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(2)
  })

  it('shows placeholder for contracts without snapshots', async () => {
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(2)
    expect(options.records[0].lastPrice).toBe('--')
  })

  it('unmount 延迟 release（vtable RO 竞态防护）：卸载不立即释放，250ms 后释放一次', async () => {
    const { ListTable } = await import('@visactor/vtable')
    const { unmount } = render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const instance = (ListTable as any).mock.results[0].value
    unmount()
    expect(instance.release).not.toHaveBeenCalled() // 延迟释放：卸载瞬间不 release（防 RO 回调读已释放实例）
    act(() => { vi.advanceTimersByTime(250) })
    expect(instance.release).toHaveBeenCalledTimes(1)
  })

  it('涨跌幅以 preSettlementPrice 为基准（非 preClosePrice）', async () => {
    const snapshots = new Map<string, MarketSnapshot>([
      ['au2508', {
        instrumentID: 'au2508',
        lastPrice: 490.0,
        preSettlementPrice: 480.0,  // 基准：结算价
        preClosePrice: 485.0,       // 非基准：收盘价
        bidPrice1: 489.0,
        askPrice1: 491.0,
        volume: 1000,
        openInterest: 5000,
      } as MarketSnapshot],
    ])

    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={snapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0]

    // 涨跌 = 490 - 480 = 10（用 preSettlementPrice）
    // 不是 490 - 485 = 5（用 preClosePrice）
    expect(record.change).toBe(10)
    expect(record.changePercent).toBeCloseTo((10 / 480) * 100)
  })

  // --- 状态列 tests ---

  it('状态列为到期日右侧的列', async () => {
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const titles = options.columns.map((c: { title: string }) => c.title)
    const expireIdx = titles.indexOf('到期日')
    expect(expireIdx).toBeGreaterThanOrEqual(0)
    expect(titles[expireIdx + 1]).toBe('状态')
  })

  it('已停牌合约（isTrading=0）状态为 已停牌', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au9999', instrumentName: '测试', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 0, productClass: "1" },
    ]
    render(<QuoteTable spec={futuresSpec} contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('已停牌')
  })

  it('已到期合约（isTrading=1 但已过到期日）状态为 已到期', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2501', instrumentName: '测试', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '20240101', isTrading: 1, productClass: "1" },
    ]
    render(<QuoteTable spec={futuresSpec} contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('已到期')
  })

  it('交易中合约（isTrading=1 且未到期）状态为 交易中', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2612', instrumentName: '测试', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
    ]
    render(<QuoteTable spec={futuresSpec} contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('交易中')
  })

  it('状态列着色：vtable row=1（首条数据行）正确读取 records[0]，最后一行不落入灰色兜底', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2612', instrumentName: '测试A', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
      { instrumentID: 'au2613', instrumentName: '测试B', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
    ]
    render(<QuoteTable spec={futuresSpec} contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    // 状态列 style 函数应存在
    const statusCol = options.columns.find((c: { title: string }) => c.title === '状态')
    expect(typeof statusCol.style).toBe('function')

    const records = options.records
    // 模拟 vtable style 回调：args.row 是物理行号（0=表头，首条数据为 1）
    const styleArg = (row: number) => ({ table: { records }, row, col: 4 })
    // 首条数据行（row=1）→ records[0] 交易中 → 绿色
    expect(statusCol.style(styleArg(1))).toEqual({ color: '#3fb950' })
    // 最后一条数据行（row=2）→ records[1] 交易中 → 绿色（不应是灰色兜底 #8b949e）
    expect(statusCol.style(styleArg(2))).toEqual({ color: '#3fb950' })
  })

  it('状态列着色：已停牌行显示橙色', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2612', instrumentName: '测试A', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
      { instrumentID: 'au2613', instrumentName: '测试B', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 0, productClass: "1" },
    ]
    render(<QuoteTable spec={futuresSpec} contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const statusCol = options.columns.find((c: { title: string }) => c.title === '状态')
    const records = options.records
    // 第二条数据（row=2）→ records[1] 已停牌 → 橙色
    expect(statusCol.style({ table: { records }, row: 2, col: 4 })).toEqual({ color: '#d29922' })
  })

  it('columns 包含合约乘数与最小变动价位，且采用固定列宽 standard（默认列宽放大）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.widthMode).toBe('standard')
    const titles = options.columns.map((c: { title: string }) => c.title)
    expect(titles).toContain('合约乘数')
    expect(titles).toContain('最小变动价位')
    // 默认列宽放大：固定总宽明显大于原 1400，宽屏下横向留白更少
    const totalWidth = options.columns.reduce((sum: number, c: { width?: number }) => sum + (c.width ?? 0), 0)
    expect(totalWidth).toBeGreaterThan(1500)
    for (const col of options.columns) {
      expect(typeof col.width).toBe('number')
      expect(col.width as number).toBeGreaterThan(0)
    }
  })

  it('保留每列拖拽缩放能力（columnResizeMode=all，列可单独放大/缩小）', async () => {
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columnResizeMode).toBe('all')
  })

  it('buildRecord 从 contract 填充合约乘数与最小变动价位（有快照）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0] // au2508
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
  })

  it('无快照时合约乘数/最小变动价位仍从 contract 显示（静态列）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={new Map()} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0]
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
    expect(record.lastPrice).toBe('--')
  })

  it('横向滚动条为低调细灰样式（6px + 灰色滑块 + hover 表格时浮现）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    const ss = options.theme.scrollStyle
    expect(ss).toBeDefined()
    expect(ss.visible).toBe('focus') // 常显 → hover 表格时浮现
    expect(ss.width).toBe(6) // 6px 细条
    expect(ss.scrollSliderColor).toBe('rgba(139,148,158,0.45)') // 灰色滑块，低调不抢行情数据
    expect(ss.barToSide).toBe(true) // 进度条钉在视口底部，行数少时不跑到上边去
  })

  // --- 滚动条区域不触发多选（拖拽进度条不应误选行） ---

  describe('滚动条区域不触发多选', () => {
    it('拖拽底部横向进度条（底部 6px 内）不误选合约行', async () => {
      const onSelectionChange = vi.fn()
      const { container } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={onSelectionChange} />
      )
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // 模拟：getCellAt 把滚动条区域判为「末行」（横向进度条覆盖/邻近最后一行）
      instance.getCellAt = vi.fn().mockReturnValue({ row: 1, col: 0 })
      Object.defineProperty(instance, 'tableNoFrameWidth', { value: 800, configurable: true })
      Object.defineProperty(instance, 'tableNoFrameHeight', { value: 600, configurable: true })
      const tableEl = container.firstChild as HTMLElement

      await act(async () => {
        // y=595 落在底部进度条带（600-6=594 以下）；无修复时 getCellAt 返回 row1 → 误触发多选
        // 全部在 tableEl 上冒泡派发（mousemove/mouseup 监听在 window，冒泡到达且 e.target 是元素）
        tableEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 595, button: 0, bubbles: true }))
        tableEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 595, button: 0, bubbles: true }))
        tableEl.dispatchEvent(new MouseEvent('mouseup', { clientX: 500, clientY: 595, button: 0, bubbles: true }))
      })

      expect(onSelectionChange).not.toHaveBeenCalled()
      // 清理共享 mock，避免影响后续用例
      delete instance.getCellAt
      delete instance.tableNoFrameWidth
      delete instance.tableNoFrameHeight
    })

    it('拖拽右侧纵向滚动条（右侧 6px 内）不误选合约行', async () => {
      const onSelectionChange = vi.fn()
      const { container } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={onSelectionChange} />
      )
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      instance.getCellAt = vi.fn().mockReturnValue({ row: 1, col: 0 })
      Object.defineProperty(instance, 'tableNoFrameWidth', { value: 800, configurable: true })
      Object.defineProperty(instance, 'tableNoFrameHeight', { value: 600, configurable: true })
      const tableEl = container.firstChild as HTMLElement

      await act(async () => {
        // x=795 落在右侧滚动条带（800-6=794 右侧）；无修复时 getCellAt 按 y 判行 → 误触发多选
        tableEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 795, clientY: 200, button: 0, bubbles: true }))
        tableEl.dispatchEvent(new MouseEvent('mousemove', { clientX: 795, clientY: 300, button: 0, bubbles: true }))
        tableEl.dispatchEvent(new MouseEvent('mouseup', { clientX: 795, clientY: 300, button: 0, bubbles: true }))
      })

      expect(onSelectionChange).not.toHaveBeenCalled()
      delete instance.getCellAt
      delete instance.tableNoFrameWidth
      delete instance.tableNoFrameHeight
    })
  })

  // --- 滚动后拖选定位：getCellAt 需携带滚动偏移（否则滚动后选中错行/选不中） ---

  describe('滚动后拖选定位（getCellAt 携带滚动偏移）', () => {
    it('已滚动时 mousedown，getCellAt 应收到 y+scrollTop（内容坐标而非视口坐标）', async () => {
      const onSelectionChange = vi.fn()
      const { container } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={onSelectionChange} />
      )
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // 排除滚动条守卫：表格宽高足够大，x/y 不在边缘 6px 内
      Object.defineProperty(instance, 'tableNoFrameWidth', { value: 1200, configurable: true })
      Object.defineProperty(instance, 'tableNoFrameHeight', { value: 1000, configurable: true })
      // 模拟已向下滚动 500px（1000+ 合约列表常先滚动再拖选）
      Object.defineProperty(instance, 'scrollTop', { value: 500, configurable: true })
      Object.defineProperty(instance, 'scrollLeft', { value: 0, configurable: true })
      const getCellAt = vi.fn().mockReturnValue({ row: 1, col: 0 })
      instance.getCellAt = getCellAt
      const tableEl = container.firstChild as HTMLElement

      await act(async () => {
        // 视口 y=200；内容坐标应为 200+500=700（getCellAt 按内容行高解析，须加滚动偏移）
        tableEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 200, button: 0, bubbles: true }))
      })

      expect(getCellAt).toHaveBeenCalledWith(400, 700)
      delete instance.getCellAt
      delete instance.tableNoFrameWidth
      delete instance.tableNoFrameHeight
      delete instance.scrollTop
      delete instance.scrollLeft
    })
  })

  // --- onVisibleRangeChange tests ---

  it('接受 onVisibleRangeChange 回调', () => {
    const onVisibleRangeChange = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )
    // 组件渲染成功，回调已传入
    expect(onVisibleRangeChange).not.toHaveBeenCalled()
  })

  it('初始渲染后调用 onVisibleRangeChange', async () => {
    const onVisibleRangeChange = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    // 等待初始可见行检测（notifyVisibleRange 触发 setVisibleRangeVersion，需 act 包裹）
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    // 应该调用回调，传入可见合约 ID 列表
    expect(onVisibleRangeChange).toHaveBeenCalled()
    const calledWith = onVisibleRangeChange.mock.calls[0][0]
    expect(Array.isArray(calledWith)).toBe(true)
    // mock 返回 rowStart:1, rowEnd:30，所有合约都可见
    expect(calledWith).toEqual(expect.arrayContaining(['au2508', 'ag2508']))
  })

  it('contracts 变化时更新可见行', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    onVisibleRangeChange.mockClear()

    // 添加新合约
    const newContracts = [
      ...mockContracts,
      { instrumentID: 'cu2508', instrumentName: '铜2508', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20250815', isTrading: 1, productClass: "1" },
    ]

    rerender(
      <QuoteTable spec={futuresSpec}
        contracts={newContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    // 回调应该被调用
    expect(onVisibleRangeChange).toHaveBeenCalled()
  })

  it('滚动条释放（mouseup 距上次 scroll <200ms）触发 markScrollEnd', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const instance = (ListTable as any).mock.results[0].value

    // 模拟一次滚动（记录 lastScrollAtRef）
    const scrollHandler = instance.on.mock.calls.find(([name]: [string]) => name === 'scroll')?.[1]
    expect(scrollHandler).toBeDefined()
    scrollHandler({ scrollTop: 500 })

    // 松手 → markScrollEnd（handleScrollEnd 同步调用 notifyVisibleRange → setVisibleRangeVersion，需 act 包裹）
    await act(async () => {
      window.dispatchEvent(new Event('mouseup'))
    })
    expect(useMarketStore.getState().scrollEndSeq).toBeGreaterThan(0)
  })

  it('键盘滚动停止（keyup 距上次 scroll <200ms）触发 markScrollEnd', async () => {
    useMarketStore.setState({ scrollEndSeq: 0 }) // 清掉前序用例（mouseup 测试）的残留计数
    const { ListTable } = await import('@visactor/vtable')
    render(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />)
    const instance = (ListTable as any).mock.results[0].value

    // 模拟一次滚动（记录 lastScrollAtRef）
    const scrollHandler = instance.on.mock.calls.find(([name]: [string]) => name === 'scroll')?.[1]
    expect(scrollHandler).toBeDefined()
    scrollHandler({ scrollTop: 300 })

    // 键盘滚动无 mouseup：keyup 也应触发 markScrollEnd → 订阅立即 diff（不等 500ms 拖停）
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keyup'))
    })
    expect(useMarketStore.getState().scrollEndSeq).toBeGreaterThan(0)
  })

  // --- onContextMenu tests ---

  it('接受 onContextMenu 回调', () => {
    const onContextMenu = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onContextMenu={onContextMenu}
      />
    )
    // 组件渲染成功，回调已传入
    expect(onContextMenu).not.toHaveBeenCalled()
  })

  it('右键点击时调用 onContextMenu 并传入合约信息', async () => {
    const onContextMenu = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onContextMenu={onContextMenu}
      />
    )

    // 获取 vtable 实例并触发 contextmenu_cell 事件
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]

    expect(contextmenuHandler).toBeDefined()

    // 模拟右键点击第一行
    contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } })

    expect(onContextMenu).toHaveBeenCalledTimes(1)
    expect(onContextMenu).toHaveBeenCalledWith('au2508', 480.5, expect.any(Object))
  })

  it('右键落在多选集合外时，先把该合约置为单选选中（同步蓝区）', async () => {
    const onContextMenu = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        selectedContracts={new Set(['ag2508'])} // 集合不包含 au2508
        onSelectionChange={onSelectionChange}
        onContextMenu={onContextMenu}
      />
    )
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]

    contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } }) // row1 → au2508

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['au2508']))
    expect(onContextMenu).toHaveBeenCalledWith('au2508', 480.5, expect.any(Object))
  })

  it('右键命中多选集合内时保持集合不变，显示多选菜单', async () => {
    const onMultiSelectContextMenu = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        selectedContracts={new Set(['au2508', 'ag2508'])}
        onSelectionChange={onSelectionChange}
        onMultiSelectContextMenu={onMultiSelectContextMenu}
      />
    )
    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]

    contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } }) // au2508 在集合内

    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(onMultiSelectContextMenu).toHaveBeenCalledWith(['au2508', 'ag2508'], expect.any(Object))
  })

  it('右键点击无行情的合约时 price 为 0', async () => {
    const onContextMenu = vi.fn()
    render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={new Map()}
        onContextMenu={onContextMenu}
      />
    )

    const { ListTable } = await import('@visactor/vtable')
    const tableInstance = (ListTable as any).mock.results[0].value
    const contextmenuHandler = tableInstance.on.mock.calls.find(
      (call: any[]) => call[0] === 'contextmenu_cell'
    )?.[1]

    contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } })

    expect(onContextMenu).toHaveBeenCalledWith('au2508', 0, expect.any(Object))
  })

  // --- 局部更新 tests ---

  describe('QuoteTable 局部更新', () => {
    it('snapshots 变化时调用 updateRecords 而非 setRecords', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />
      )

      // 初始渲染调用了 setRecords
      const instance = (ListTable as any).mock.results[0].value
      expect(instance.setRecords).toHaveBeenCalled()
      instance.setRecords.mockClear()

      // 新的快照（au2508 价格变化，自 diff 检测到该行变化）
      const newSnapshots = new Map(mockSnapshots)
      newSnapshots.set('au2508', { ...newSnapshots.get('au2508')!, lastPrice: 490 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={newSnapshots} />)

      expect(instance.updateRecords).toHaveBeenCalled()
      expect(instance.setRecords).not.toHaveBeenCalled()
      // 只更新 1 行，且索引为 0-based 记录索引 [0]（au2508 在 contracts 中 index 0）
      const updateCalls = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(updateCalls[0][1]).toEqual([0])
    })

    it('更新第二个合约时索引为 1（0-based 记录索引）', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.updateRecords.mockClear()

      // 新的快照（ag2508 价格变化，ag2508 在 contracts 中 index 1）
      const newSnapshots = new Map(mockSnapshots)
      newSnapshots.set('ag2508', { ...newSnapshots.get('ag2508')!, lastPrice: 6600 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={newSnapshots} />)

      expect(instance.updateRecords).toHaveBeenCalled()
      const updateCalls = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(updateCalls[0][1]).toEqual([1])
    })

    it('多次 tick 后行索引映射保持（局部更新仍更新正确行）', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.updateRecords.mockClear()

      // 第 1 次 tick：au2508 价格变化 → 0-based 行索引 [0]
      const snapshots1 = new Map(mockSnapshots)
      snapshots1.set('au2508', { ...snapshots1.get('au2508')!, lastPrice: 490 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={snapshots1} />)

      const calls1 = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(calls1.length).toBeGreaterThan(0)
      expect(calls1[0][1]).toEqual([0])
      instance.updateRecords.mockClear()

      // 第 2 次 tick：ag2508 价格变化 → 0-based 行索引 [1]（映射未因上次局部更新而错位）
      const snapshots2 = new Map(snapshots1)
      snapshots2.set('ag2508', { ...snapshots2.get('ag2508')!, lastPrice: 6600 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={snapshots2} />)

      const calls2 = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(calls2.length).toBeGreaterThan(0)
      expect(calls2[0][1]).toEqual([1])
    })

    it('只更新可见行：屏幕外合约的快照变化不触发 updateRecords', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const manyContracts: ContractInfo[] = Array.from({ length: 50 }, (_, i) => ({
        instrumentID: `C${i}`,
        instrumentName: `测试${i}`,
        exchangeID: 'SHFE',
        productID: 'au',
        volumeMultiple: 1000,
        priceTick: 0.02,
        expireDate: '99991231',
        isTrading: 1,
        productClass: '1',
      }))
      const baseSnapshots = new Map<string, MarketSnapshot>(
        manyContracts.map((c) => [c.instrumentID, {
          instrumentID: c.instrumentID,
          lastPrice: 4000,
          bidPrice1: 3999,
          askPrice1: 4001,
          volume: 1,
          openInterest: 1,
        } as MarketSnapshot])
      )

      const { rerender } = render(<QuoteTable spec={futuresSpec} contracts={manyContracts} snapshots={baseSnapshots} />)
      const instance = (ListTable as any).mock.results[0].value
      instance.updateRecords.mockClear()
      instance.setRecords.mockClear()

      // 模拟可见范围只有中间几行（含预加载 → 可见区间窄）
      const originalRange = instance.getBodyVisibleCellRange
      instance.getBodyVisibleCellRange = vi.fn().mockReturnValue({ rowStart: 25, rowEnd: 25, colStart: 0, colEnd: 10 })

      // 只改屏幕外的合约 C0（index 0）→ 不应触发 updateRecords
      const snap1 = new Map(baseSnapshots)
      snap1.set('C0', { ...snap1.get('C0')!, lastPrice: 3999 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={manyContracts} snapshots={snap1} />)
      expect(instance.updateRecords).not.toHaveBeenCalled()

      // 改可见区合约 C25（index 25）→ 应触发 updateRecords 且索引为 25
      const snap2 = new Map(snap1)
      snap2.set('C25', { ...snap2.get('C25')!, lastPrice: 4001 } as any)
      rerender(<QuoteTable spec={futuresSpec} contracts={manyContracts} snapshots={snap2} />)
      expect(instance.updateRecords).toHaveBeenCalled()
      const rows = instance.updateRecords.mock.calls.flatMap((c: [any[], number[]]) => c[1])
      expect(rows).toContain(25)

      // 恢复原始 mock，避免影响同文件其他用例
      instance.getBodyVisibleCellRange = originalRange
    })

    it('selectedContracts 变化时仅重绘可见单元格（updateCellContentRange），不再全量 setRecords', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={() => {}} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.updateCellContentRange.mockClear()
      instance.setRecords.mockClear()

      rerender(
        <QuoteTable spec={futuresSpec} contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set(['au2508'])} onSelectionChange={() => {}} />
      )

      // 只重绘可见区单元格（bgColor 回调重新求值），避免 1000+ 行全量重建
      expect(instance.updateCellContentRange).toHaveBeenCalled()
      expect(instance.setRecords).not.toHaveBeenCalled()
    })
  })

  describe('shouldRenderAnchor（金色活动锚点守卫）', () => {
    it('锚点在选区内返回 true（单选重合 / 多选锚点在集合内）', () => {
      expect(shouldRenderAnchor('au2508', new Set(['au2508']))).toBe(true)
      expect(shouldRenderAnchor('au2508', new Set(['au2508', 'ag2508']))).toBe(true)
    })

    it('锚点不在选区内返回 false（防第二个高亮区）', () => {
      expect(shouldRenderAnchor('au2508', new Set(['ag2508']))).toBe(false)
      expect(shouldRenderAnchor('au2508', new Set())).toBe(false)
      expect(shouldRenderAnchor(null, new Set(['au2508']))).toBe(false)
      expect(shouldRenderAnchor(undefined, undefined)).toBe(false)
    })
  })

  describe('selectRow 守卫', () => {
    function stubRaf() {
      // jsdom 可能未实现 rAF：先兜底赋值，再 spy 使其同步触发回调
      if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0 }) as typeof requestAnimationFrame
      }
      if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
      }
      const raf = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0 })
      const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
      return () => { raf.mockRestore(); cancel.mockRestore() }
    }

    it('锚点在选区内：渲染金色 selectRow', async () => {
      const restore = stubRaf()
      render(
        <QuoteTable spec={futuresSpec}
          contracts={mockContracts}
          snapshots={mockSnapshots}
          selectedInstrument="au2508"
          selectedContracts={new Set(['au2508'])}
        />
      )
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // au2508 在 contracts 中 index 0 → vtableRow 1
      expect(instance.selectRow).toHaveBeenCalledWith(1)
      expect(instance.clearSelected).not.toHaveBeenCalled()
      restore()
    })

    it('锚点不在选区内：清除金色（clearSelected），不渲染独立高亮', async () => {
      const restore = stubRaf()
      render(
        <QuoteTable spec={futuresSpec}
          contracts={mockContracts}
          snapshots={mockSnapshots}
          selectedInstrument="au2508"
          selectedContracts={new Set(['ag2508'])}
        />
      )
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      expect(instance.selectRow).not.toHaveBeenCalled()
      expect(instance.clearSelected).toHaveBeenCalled()
      restore()
    })
  })

  // --- spec 驱动新增行为 tests ---

  it('bodyStyle.bgColor：spec.rowStyle 行级底色优先于多选蓝高亮', async () => {
    const spec = {
      columns: futuresSpec.columns,
      buildRecord: futuresSpec.buildRecord,
      // 标底行深色底（Task 6 期权表语义），此处用 kind 区分
      rowStyle: (r: { kind: string }) => (r.kind === 'underlying' ? { bgColor: '#161b22' } : undefined),
    }
    render(
      <QuoteTable spec={spec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        selectedContracts={new Set(['au2508'])}
      />
    )
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const bgColor = options.theme.bodyStyle.bgColor
    expect(typeof bgColor).toBe('function')
    // 行级样式优先：au2508 虽在选中蓝区，但 spec.rowStyle 命中标底行 → 深色底
    expect(bgColor({ table: { records: [{ instrumentID: 'au2508', kind: 'underlying' }] }, row: 1 })).toBe('#161b22')
    // 无 rowStyle 且被选中 → 蓝高亮
    expect(bgColor({ table: { records: [{ instrumentID: 'au2508', kind: 'normal' }] }, row: 1 })).toBe('rgba(59, 130, 246, 0.15)')
    // 无 rowStyle 且未选中 → 默认底
    expect(bgColor({ table: { records: [{ instrumentID: 'ag2508', kind: 'normal' }] }, row: 1 })).toBe('#0d1117')
  })

  it('isActive 翻转为 true 时重报可见区（notifyVisibleRange）', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )
    // 初始渲染的 setTimeout(notifyVisibleRange,0) 在 fake timers 下需推进才会触发 → 清掉
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    onVisibleRangeChange.mockClear()

    rerender(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )
    expect(onVisibleRangeChange).toHaveBeenCalled()
  })

  it('Critical #1：隐藏面板（isActive=false）挂载不调用 onVisibleRangeChange，激活翻转为 true 时重报', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )
    // 挂载后推进 timers：隐藏面板（display:none）的挂载 setTimeout 必须被跳过，
    // 否则会覆盖活跃面板（期货/期权）的可见范围 → 活跃表失去订阅
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(onVisibleRangeChange).not.toHaveBeenCalled()

    // 激活翻转为 true → isActive 翻转 effect 立即重报可见区
    rerender(
      <QuoteTable spec={futuresSpec}
        contracts={mockContracts}
        snapshots={mockSnapshots}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )
    expect(onVisibleRangeChange).toHaveBeenCalled()
    expect(onVisibleRangeChange.mock.calls[0][0]).toEqual(expect.arrayContaining(['au2508', 'ag2508']))
  })

  // --- 期权标底行 → 合并整行表头（Task 1） ---

  describe('标底行合并为整行表头', () => {
    const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
    const opt: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }

    it('标底行渲染后调用 mergeCells 整行合并，期权行不合并', async () => {
      render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // 标底行 records index 0 → vtable 物理行 1（0=表头），整行合并到最后一列。
      // 硬编码期望列：optionsSpec 共 14 列 → 末列索引 13（不依赖实现同款表达式，防恒真断言）
      expect(instance.mergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
      // 期权行（物理行 2）不合并
      expect(instance.mergeCells).not.toHaveBeenCalledWith(0, 2, 13, 2)
    })

    it('合约列样式包装不修改共享 spec.columns（模块级常量无 style 泄漏）', async () => {
      render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
      const instrumentCol = optionsSpec.columns.find((c) => c.field === 'instrumentID')
      // 包装发生在 ListTable 入参副本上，spec.columns 本身必须保持原样（instrumentID 列无 style）
      expect(instrumentCol?.style).toBeUndefined()
    })

    it('重建数据行号漂移：撤销旧标底行合并，合并新标底行', async () => {
      const { rerender } = render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // 首轮：标底行（fut）在 records index 0 → vtable 物理行 1，已合并
      expect(instance.mergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
      instance.mergeCells.mockClear()
      instance.unmergeCells.mockClear()

      // 重建：物理行 1 变为期权行（opt），标底漂移到物理行 2（fut）
      // → 旧合并必须撤销（unmergeCells），新标底行必须合并（mergeCells）
      rerender(<QuoteTable spec={optionsSpec} contracts={[opt, fut]} snapshots={new Map()} />)
      expect(instance.unmergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
      expect(instance.mergeCells).toHaveBeenCalledWith(0, 2, 13, 2)
    })

    it('筛选/搜索重建后同一物理行仍是标底但合约变化 → 重新 mergeCells 重捕获文本（不再跳过）', async () => {
      // vtable mergeCells 在合并时捕获 text（this.getCellValue(startCol,startRow)）；
      // 若跳过已合并行，物理行 1 仍是标底但 setRecords 换合约后会残留 AD2609 旧文本。
      const ad: ContractInfo = { instrumentID: 'AD2609', instrumentName: 'AD2609', exchangeID: 'CZCE', productID: 'AD', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
      const ma: ContractInfo = { instrumentID: 'MA609', instrumentName: 'MA609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 10, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
      const { rerender } = render(<QuoteTable spec={optionsSpec} contracts={[ad, opt]} snapshots={new Map()} />)
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      // 首轮：物理行 1 = AD2609（标底），已合并
      expect(instance.mergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
      instance.mergeCells.mockClear()
      instance.unmergeCells.mockClear()

      // 重建：物理行 1 仍是标底，但合约变为 MA609 → 旧合并必须撤销，且必须重新 mergeCells
      rerender(<QuoteTable spec={optionsSpec} contracts={[ma, opt]} snapshots={new Map()} />)
      expect(instance.unmergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
      expect(instance.mergeCells).toHaveBeenCalledWith(0, 1, 13, 1)
    })

    it('合约列样式：标底行返回红/粗/大字，期权行保持原样式', async () => {
      render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
      const { ListTable } = await import('@visactor/vtable')
      const options = (ListTable as any).mock.calls[0][1]
      const instrumentCol = options.columns.find((c: { field: string }) => c.field === 'instrumentID')
      expect(typeof instrumentCol.style).toBe('function')
      const records = [
        optionsSpec.buildRecord(fut, undefined, false),
        optionsSpec.buildRecord(opt, undefined, false),
      ]
      // 标底行（row=1 → records[0]）
      expect(instrumentCol.style({ table: { records }, row: 1, col: 0 })).toEqual({ color: '#f87171', fontWeight: 'bold', fontSize: 14 })
      // 期权行（row=2 → records[1]）无叠加样式
      expect(instrumentCol.style({ table: { records }, row: 2, col: 0 })).toBeUndefined()
    })

    it('单击合并后的标底行仍解析为 underlying 行并触发 onSelectionChange', async () => {
      const onSelectionChange = vi.fn()
      render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} onSelectionChange={onSelectionChange} />)
      const { ListTable } = await import('@visactor/vtable')
      const instance = (ListTable as any).mock.results[0].value
      const clickHandler = instance.on.mock.calls.find((call: any[]) => call[0] === 'click_cell')?.[1]
      expect(clickHandler).toBeDefined()
      // vtable 合并单元格的 row 指向被合并首行（标底行）；col 落在中间列（非收藏列）
      clickHandler({ row: 1, col: 5, event: {} })
      expect(onSelectionChange).toHaveBeenCalledWith(new Set(['FG609']))
    })

    it('同步已合并全部标底行时不调度 rAF 兜底（避免白做一轮重合并）', async () => {
      const { ListTable } = await import('@visactor/vtable')
      let rafCalls = 0
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => { rafCalls++; cb(0); return rafCalls })
      try {
        render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
        const instance = (ListTable as any).mock.results[0].value
        // 同步 pass 已合并全部标底行（mergeCells 不抛错）→ 不再调度 rAF 兜底重试
        expect(rafCalls).toBe(0)
        expect(instance.mergeCells).toHaveBeenCalledTimes(1)
      } finally {
        rafSpy.mockRestore()
      }
    })

    it('同步合并未完成（标底行未就绪）时调度 rAF 兜底重试', async () => {
      const { ListTable } = await import('@visactor/vtable')
      let rafCalls = 0
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => { rafCalls++; cb(0); return rafCalls })
      const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
      let instance: any = null
      try {
        const { rerender } = render(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)
        instance = (ListTable as any).mock.results[0].value
        // 基线：同步 pass 全部合并成功 → 不调度 rAF 兜底
        expect(rafCalls).toBe(0)
        expect(instance.mergeCells).toHaveBeenCalledTimes(1)

        // 模拟渲染异步未就绪：同步合并抛错 → applyRowMerges 返回 false → 调度 rAF 兜底重试
        instance.mergeCells.mockReset()
        instance.mergeCells.mockImplementationOnce(() => { throw new Error('not ready') })
        rerender(<QuoteTable spec={optionsSpec} contracts={[fut, opt]} snapshots={new Map()} />)

        // rAF 兜底已调度（同步 pass 未完成）
        expect(rafCalls).toBe(1)
        // 同步 1 次（抛错）+ rAF 重试 1 次（成功）
        expect(instance.mergeCells).toHaveBeenCalledTimes(2)
      } finally {
        rafSpy.mockRestore()
        cafSpy.mockRestore()
        // 清除本次排队的 once 实现，避免泄漏到后续用例（共享 mock 实例）
        instance?.mergeCells?.mockReset()
      }
    })
  })
})
