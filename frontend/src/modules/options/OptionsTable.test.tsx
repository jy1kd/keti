import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { OptionsTable } from './OptionsTable'
import { useMarketStore } from '@/modules/market/store'
import type { OptionsRecord } from './OptionsTable'

// vtable mock：记录每次构造的实例，提供最小 API。
// setRecords / updateRecords 调用次数会被记录，用于验证 snapshot 增量更新走 updateRecords 而非 setRecords。
interface VTableMockInstance {
  on: ReturnType<typeof vi.fn>
  records: unknown[]
  setRecords: ReturnType<typeof vi.fn>
  updateRecords: ReturnType<typeof vi.fn>
  getBodyVisibleCellRange: ReturnType<typeof vi.fn>
  mergeCells: ReturnType<typeof vi.fn>
  unmergeCells: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  setOption: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}
const vtableInstances: VTableMockInstance[] = []
vi.mock('@visactor/vtable', () => {
  const mockTable = (): VTableMockInstance => {
    const instance = {
      on: vi.fn(),
      records: [] as unknown[],
      setRecords: vi.fn((recs: unknown[]) => { instance.records = recs }),
      updateRecords: vi.fn((recs: unknown[]) => {
        // 模拟 vtable 真实 updateRecords：把传入的记录更新到内部 records 的对应位置
        for (const r of recs) instance.records.push(r)
      }),
      // 默认返回非空可见区（与现有 OptionsPanel.test.tsx 一致），让测试聚焦于 isActive 守卫
      getBodyVisibleCellRange: vi.fn(() => ({ rowStart: 1, rowEnd: 10 })),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn(),
      release: vi.fn(),
      resize: vi.fn(),
      setOption: vi.fn(),
      dispose: vi.fn(),
    } as unknown as VTableMockInstance
    vtableInstances.push(instance)
    return instance
  }
  return { ListTable: vi.fn(mockTable) }
})

function makeUnderlyingRow(underlyingID: string): OptionsRecord {
  return { kind: 'underlying', underlyingID }
}

function makeOptionRow(underlyingID: string, callID: string, putID: string): OptionsRecord {
  return {
    kind: 'option',
    underlyingID,
    callInstrumentID: callID,
    callLastPrice: 10,
    callBidPrice: 9,
    callAskPrice: 11,
    callVolume: 100,
    callOpenInterest: 200,
    putInstrumentID: putID,
    putLastPrice: 5,
    putBidPrice: 4,
    putAskPrice: 6,
    putVolume: 50,
    putOpenInterest: 80,
    strikePrice: 1000,
  }
}

describe('OptionsTable isActive 守卫', () => {
  beforeEach(() => {
    vtableInstances.length = 0
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      snapshots: new Map(),
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('isActive=false（缺省视激活）：挂载时不调用 onVisibleRangeChange 上报', async () => {
    // 期权面板隐藏（isActive=false）挂载时，不应触发可见区上报回调
    const onVisibleRangeChange = vi.fn()
    render(
      <OptionsTable
        records={[]}
        onToggleGroup={vi.fn()}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    // 让 useEffect / schedule setTimeout 跑完
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).not.toHaveBeenCalled()
  })

  it('isActive 缺省（视为激活）：挂载时调用 onVisibleRangeChange 上报', async () => {
    // 不传 isActive → 应视为激活 → 立即上报
    const onVisibleRangeChange = vi.fn()
    render(
      <OptionsTable
        records={[]}
        onToggleGroup={vi.fn()}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).toHaveBeenCalled()
  })

  it('isActive=false：records 变化时不重报', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <OptionsTable
        records={[]}
        onToggleGroup={vi.fn()}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).not.toHaveBeenCalled()
    // records 变化时仍不应上报（面板仍隐藏）
    rerender(
      <OptionsTable
        records={[makeUnderlyingRow('FG609'), makeOptionRow('FG609', 'FG609-C-1000', 'FG609-P-1000')]}
        onToggleGroup={vi.fn()}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).not.toHaveBeenCalled()
  })

  it('isActive 从 false 翻转到 true：立即重报可见 IDs', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <OptionsTable
        records={[makeUnderlyingRow('FG609'), makeOptionRow('FG609', 'FG609-C-1000', 'FG609-P-1000')]}
        onToggleGroup={vi.fn()}
        isActive={false}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).not.toHaveBeenCalled()
    // 切到期权标签（isActive 翻转为 true）→ 立即重报
    rerender(
      <OptionsTable
        records={[makeUnderlyingRow('FG609'), makeOptionRow('FG609', 'FG609-C-1000', 'FG609-P-1000')]}
        onToggleGroup={vi.fn()}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange).toHaveBeenCalled()
    const ids = onVisibleRangeChange.mock.calls[onVisibleRangeChange.mock.calls.length - 1]?.[0] as string[]
    expect(ids).toEqual(expect.arrayContaining(['FG609-C-1000', 'FG609-P-1000']))
  })

  it('isActive=true：records 变化时调用 onVisibleRangeChange（保持当前行为）', async () => {
    const onVisibleRangeChange = vi.fn()
    const { rerender } = render(
      <OptionsTable
        records={[]}
        onToggleGroup={vi.fn()}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    const initialCalls = onVisibleRangeChange.mock.calls.length
    // records 变化 → 应重报
    rerender(
      <OptionsTable
        records={[makeUnderlyingRow('FG609'), makeOptionRow('FG609', 'FG609-C-1000', 'FG609-P-1000')]}
        onToggleGroup={vi.fn()}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    expect(onVisibleRangeChange.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})

//  ── snapshot 增量更新（仿照 QuoteTable 路径） ───────────────────────────

describe('OptionsTable snapshot 增量更新 + 严格可见订阅', () => {
  beforeEach(() => {
    vtableInstances.length = 0
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      snapshots: new Map(),
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('snapshot 变化走 updateRecords（增量），不走 setRecords（全量重建）', async () => {
    // 固定 records 引用以隔离 snapshot 变化的影响（records 自身变化本就该 setRecords）
    const fixedRecords: OptionsRecord[] = [
      makeUnderlyingRow('FG609'),
      makeOptionRow('FG609', 'FG609-C-1000', 'FG609-P-1000'),
    ]
    const TestHarness = () => {
      const snaps = useMarketStore((s) => s.snapshots)
      return (
        <OptionsTable
          records={fixedRecords}
          snapshots={snaps}
          onToggleGroup={vi.fn()}
          isActive={true}
        />
      )
    }
    render(<TestHarness />)
    await vi.runAllTimersAsync()

    const instance = vtableInstances[0]
    expect(instance).toBeDefined()
    const initialSetRecordsCount = instance.setRecords.mock.calls.length

    // 模拟 snapshot 推送（store.batchUpdate 会创建新 Map 引用）
    useMarketStore.getState().batchUpdate([{
      instrumentID: 'FG609-C-1000',
      lastPrice: 100, bidPrice1: 99, askPrice1: 101, volume: 200, openInterest: 300,
    } as never])
    await vi.runAllTimersAsync()

    // snapshot 变化不应触发 setRecords（仅结构变化才 setRecords）
    expect(instance.setRecords.mock.calls.length).toBe(initialSetRecordsCount)
    // 但应触发 updateRecords（行 1 是 option 行）
    expect(instance.updateRecords).toHaveBeenCalled()
  })

  it('PRELOAD=0：onVisibleRangeChange 上报的 ID 数量等于可见行数（不预加载）', async () => {
    // 30 行 records，可见区 rowStart=1, rowEnd=10 → 上报 records[0..9] 中的 C/P
    // 假设 records[0] 是 underlying（无 C/P），records[1..9] 是 9 个 option（各 2 边）= 18 个 ID
    const records: OptionsRecord[] = []
    records.push(makeUnderlyingRow('FG609'))
    for (let i = 0; i < 20; i++) {
      records.push(makeOptionRow('FG609', `FG609-C-${1000 + i}`, `FG609-P-${1000 + i}`))
    }
    const onVisibleRangeChange = vi.fn()
    render(
      <OptionsTable
        records={records}
        onToggleGroup={vi.fn()}
        isActive={true}
        onVisibleRangeChange={onVisibleRangeChange}
      />,
    )
    await vi.runAllTimersAsync()
    // 取最后一次上报的 ids
    const calls = onVisibleRangeChange.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastIds = calls[calls.length - 1][0] as string[]
    // 可见 9 个 option 行（records[1..9]，因为 rowEnd=10 对应 records[9]）→ 18 个 ID
    // 关键断言：上报数量应严格等于可见区 option 行的 C+P 数，不多
    expect(lastIds.length).toBe(18)
    // 且应包含前 9 个 option 行的 C+P（不应包含 records[10+] 的）
    expect(lastIds).toContain('FG609-C-1000')
    expect(lastIds).toContain('FG609-P-1000')
    expect(lastIds).toContain('FG609-C-1008')
    expect(lastIds).toContain('FG609-P-1008')
    expect(lastIds).not.toContain('FG609-C-1010')  // 10 行外的，不应上报
    expect(lastIds).not.toContain('FG609-P-1010')
  })

  it('snapshot effect 只看可见区行，不处理越界/隐藏行', async () => {
    const records: OptionsRecord[] = []
    records.push(makeUnderlyingRow('FG609'))
    for (let i = 0; i < 30; i++) {
      records.push(makeOptionRow('FG609', `FG609-C-${1000 + i}`, `FG609-P-${1000 + i}`))
    }
    render(
      <OptionsTable
        records={records}
        snapshots={new Map()}
        onToggleGroup={vi.fn()}
        isActive={true}
      />,
    )
    await vi.runAllTimersAsync()
    const instance = vtableInstances[0]
    instance.updateRecords.mockClear()

    // 更新一个不可见行（records[20]）的快照——不应触发 updateRecords
    // 类型简化为只填必要字段（通过 as 断言避免无关字段类型噪音）
    const partialSnap = {
      instrumentID: 'FG609-C-1020',
      lastPrice: 999,
      bidPrice1: 998,
      askPrice1: 1000,
      volume: 1,
      openInterest: 1,
    } as unknown as import('@/services/types').MarketSnapshot
    useMarketStore.getState().batchUpdate([partialSnap])
    await vi.runAllTimersAsync()

    expect(instance.updateRecords).not.toHaveBeenCalled()
  })
})
