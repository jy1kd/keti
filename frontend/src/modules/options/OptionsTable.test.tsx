import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { OptionsTable } from './OptionsTable'
import { useMarketStore } from '@/modules/market/store'
import type { OptionsRecord } from './OptionsTable'

// vtable mock：记录每次构造的实例，提供最小 API（getBodyVisibleCellRange 固定 rowStart/rowEnd）
const vtableInstances: unknown[] = []
vi.mock('@visactor/vtable', () => {
  const mockTable = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance: any = {
      on: vi.fn(),
      records: [] as unknown[],
      setRecords: vi.fn((recs: unknown[]) => {
        instance.records = recs
      }),
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      // 默认返回非空可见区（与现有 OptionsPanel.test.tsx 一致），让测试聚焦于 isActive 守卫
      getBodyVisibleCellRange: vi.fn(() => ({ rowStart: 1, rowEnd: 10 })),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn(),
      release: vi.fn(),
    }
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
