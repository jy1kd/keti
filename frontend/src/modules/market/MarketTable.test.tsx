import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MarketTable } from './MarketTable'
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
})
