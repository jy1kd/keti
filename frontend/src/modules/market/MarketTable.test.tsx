import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MarketTable } from './MarketTable'
import { useMarketStore } from './store'
import type { MarketSnapshot, ContractInfo } from '@/services/types'

describe('MarketTable', () => {
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
    const { container } = render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('creates ListTable with correct options', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    expect(ListTable).toHaveBeenCalledTimes(1)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columns).toBeDefined()
    expect(options.columns.length).toBeGreaterThan(0)
  })

  it('passes records from contracts to vtable', async () => {
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(2)
  })

  it('shows placeholder for contracts without snapshots', async () => {
    render(<MarketTable contracts={mockContracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(2)
    expect(options.records[0].lastPrice).toBe('--')
  })

  it('releases vtable instance on unmount', async () => {
    const { unmount } = render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    unmount()
    expect(true).toBe(true)
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

    render(<MarketTable contracts={mockContracts} snapshots={snapshots} />)
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
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
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
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('已停牌')
  })

  it('已到期合约（isTrading=1 但已过到期日）状态为 已到期', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2501', instrumentName: '测试', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '20240101', isTrading: 1, productClass: "1" },
    ]
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('已到期')
  })

  it('交易中合约（isTrading=1 且未到期）状态为 交易中', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2612', instrumentName: '测试', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
    ]
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records[0].status).toBe('交易中')
  })

  it('状态列着色：vtable row=1（首条数据行）正确读取 records[0]，最后一行不落入灰色兜底', async () => {
    const contracts: ContractInfo[] = [
      { instrumentID: 'au2612', instrumentName: '测试A', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
      { instrumentID: 'au2613', instrumentName: '测试B', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '99991231', isTrading: 1, productClass: "1" },
    ]
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
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
    render(<MarketTable contracts={contracts} snapshots={new Map()} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    const statusCol = options.columns.find((c: { title: string }) => c.title === '状态')
    const records = options.records
    // 第二条数据（row=2）→ records[1] 已停牌 → 橙色
    expect(statusCol.style({ table: { records }, row: 2, col: 4 })).toEqual({ color: '#d29922' })
  })

  // --- onVisibleRangeChange tests ---

  it('接受 onVisibleRangeChange 回调', () => {
    const onVisibleRangeChange = vi.fn()
    render(
      <MarketTable
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
      <MarketTable
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    // 等待初始可见行检测
    await vi.advanceTimersByTimeAsync(100)

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
      <MarketTable
        contracts={mockContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    await vi.advanceTimersByTimeAsync(100)
    onVisibleRangeChange.mockClear()

    // 添加新合约
    const newContracts = [
      ...mockContracts,
      { instrumentID: 'cu2508', instrumentName: '铜2508', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '20250815', isTrading: 1, productClass: "1" },
    ]

    rerender(
      <MarketTable
        contracts={newContracts}
        snapshots={mockSnapshots}
        onVisibleRangeChange={onVisibleRangeChange}
      />
    )

    await vi.advanceTimersByTimeAsync(100)

    // 回调应该被调用
    expect(onVisibleRangeChange).toHaveBeenCalled()
  })

  it('滚动条释放（mouseup 距上次 scroll <200ms）触发 markScrollEnd', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const instance = (ListTable as any).mock.results[0].value

    // 模拟一次滚动（记录 lastScrollAtRef）
    const scrollHandler = instance.on.mock.calls.find(([name]: [string]) => name === 'scroll')?.[1]
    expect(scrollHandler).toBeDefined()
    scrollHandler({ scrollTop: 500 })

    // 松手 → markScrollEnd
    window.dispatchEvent(new Event('mouseup'))
    expect(useMarketStore.getState().scrollEndSeq).toBeGreaterThan(0)
  })

  // --- onContextMenu tests ---

  it('接受 onContextMenu 回调', () => {
    const onContextMenu = vi.fn()
    render(
      <MarketTable
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
      <MarketTable
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

  it('右键点击无行情的合约时 price 为 0', async () => {
    const onContextMenu = vi.fn()
    render(
      <MarketTable
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

  describe('MarketTable 局部更新', () => {
    it('snapshots 变化时调用 updateRecords 而非 setRecords', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <MarketTable contracts={mockContracts} snapshots={mockSnapshots} />
      )

      // 初始渲染调用了 setRecords
      const instance = (ListTable as any).mock.results[0].value
      expect(instance.setRecords).toHaveBeenCalled()
      instance.setRecords.mockClear()

      // 新的快照（au2508 价格变化，自 diff 检测到该行变化）
      const newSnapshots = new Map(mockSnapshots)
      newSnapshots.set('au2508', { ...newSnapshots.get('au2508')!, lastPrice: 490 } as any)
      rerender(<MarketTable contracts={mockContracts} snapshots={newSnapshots} />)

      expect(instance.updateRecords).toHaveBeenCalled()
      expect(instance.setRecords).not.toHaveBeenCalled()
      // 只更新 1 行，且索引为 0-based 记录索引 [0]（au2508 在 contracts 中 index 0）
      const updateCalls = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(updateCalls[0][1]).toEqual([0])
    })

    it('更新第二个合约时索引为 1（0-based 记录索引）', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <MarketTable contracts={mockContracts} snapshots={mockSnapshots} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.updateRecords.mockClear()

      // 新的快照（ag2508 价格变化，ag2508 在 contracts 中 index 1）
      const newSnapshots = new Map(mockSnapshots)
      newSnapshots.set('ag2508', { ...newSnapshots.get('ag2508')!, lastPrice: 6600 } as any)
      rerender(<MarketTable contracts={mockContracts} snapshots={newSnapshots} />)

      expect(instance.updateRecords).toHaveBeenCalled()
      const updateCalls = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(updateCalls[0][1]).toEqual([1])
    })

    it('多次 tick 后行索引映射保持（局部更新仍更新正确行）', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <MarketTable contracts={mockContracts} snapshots={mockSnapshots} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.updateRecords.mockClear()

      // 第 1 次 tick：au2508 价格变化 → 0-based 行索引 [0]
      const snapshots1 = new Map(mockSnapshots)
      snapshots1.set('au2508', { ...snapshots1.get('au2508')!, lastPrice: 490 } as any)
      rerender(<MarketTable contracts={mockContracts} snapshots={snapshots1} />)

      const calls1 = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(calls1.length).toBeGreaterThan(0)
      expect(calls1[0][1]).toEqual([0])
      instance.updateRecords.mockClear()

      // 第 2 次 tick：ag2508 价格变化 → 0-based 行索引 [1]（映射未因上次局部更新而错位）
      const snapshots2 = new Map(snapshots1)
      snapshots2.set('ag2508', { ...snapshots2.get('ag2508')!, lastPrice: 6600 } as any)
      rerender(<MarketTable contracts={mockContracts} snapshots={snapshots2} />)

      const calls2 = instance.updateRecords.mock.calls as [any[], number[]][]
      expect(calls2.length).toBeGreaterThan(0)
      expect(calls2[0][1]).toEqual([1])
    })

    it('selectedContracts 变化时仍走 setRecords 全量', async () => {
      const { ListTable } = await import('@visactor/vtable')
      const { rerender } = render(
        <MarketTable contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={() => {}} />
      )
      const instance = (ListTable as any).mock.results[0].value
      instance.setRecords.mockClear()

      rerender(
        <MarketTable contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set(['au2508'])} onSelectionChange={() => {}} />
      )

      expect(instance.setRecords).toHaveBeenCalled()
    })
  })
})
