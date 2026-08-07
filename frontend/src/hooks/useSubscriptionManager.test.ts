import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscriptionManager } from './useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket, unsubscribeMarket, getSnapshots } from '@/services/api'

vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn().mockResolvedValue({ success: true }),
  unsubscribeMarket: vi.fn().mockResolvedValue({ success: true }),
  getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
}))

describe('useSubscriptionManager 延迟退订', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      selectedContracts: new Set(),
      scrollEndSeq: 0,
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('合约滑出可见区后在宽限期内不退订', async () => {
    renderHook(() => useSubscriptionManager())

    // 先订阅
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])

    // 滑出可见区
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(10_000) }) // 10s < 30s 宽限期

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
  })

  it('超过宽限期仍不可见则退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    vi.mocked(subscribeMarket).mockClear()

    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) }) // > 30s 宽限期

    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  })

  it('宽限期内滑回则取消退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))  // 滑出
    await act(async () => { vi.advanceTimersByTime(10_000) })        // 宽限期内
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))  // 滑回
    await act(async () => { vi.advanceTimersByTime(31_000) })

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
  })
})

describe('useSubscriptionManager 拖动与 LRU', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      selectedContracts: new Set(),
      scrollEndSeq: 0,
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('拖动中既不订阅也不退订，停止后才订阅最终可见区', async () => {
    renderHook(() => useSubscriptionManager())

    // 初始静止订阅
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()
    vi.mocked(unsubscribeMarket).mockClear()

    // 模拟快速拖动：300ms 内 ≥2 次变化 → 拖动态，零 HTTP
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })

    // 拖动中零 HTTP：无 subscribe、无 unsubscribe
    expect(vi.mocked(subscribeMarket)).not.toHaveBeenCalled()
    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()

    // 停止后 500ms 完整 diff → 订阅最终可见区 au2508
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalled()
    const subbed = vi.mocked(subscribeMarket).mock.calls.flat(2) as string[]
    expect(subbed).toContain('au2508')
  })

  it('新批次超 SOFT_LIMIT 时退订先行再订阅（串行化兜底）', async () => {
    renderHook(() => useSubscriptionManager())

    // 先把 subscribedRef 灌到 SOFT_LIMIT（480）
    const base = Array.from({ length: 480 }, (_, i) => `ID${i}`)
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(base))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()
    vi.mocked(unsubscribeMarket).mockClear()

    // 全部滑出 + 滑入 3 个新合约 → 480 + 3 > 480 → 需要腾名额
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['NEW1', 'NEW2', 'NEW3']))
    await act(async () => { vi.advanceTimersByTime(110) })
    await act(async () => { vi.advanceTimersByTime(500) })

    // 退订先行：unsubscribeMarket 先于 subscribeMarket 调用
    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalled()
    const unsubFirst = vi.mocked(unsubscribeMarket).mock.invocationCallOrder[0]
    const subFirst = vi.mocked(subscribeMarket).mock.invocationCallOrder[0]
    expect(subFirst).toBeGreaterThan(unsubFirst)
  })

  it('停止后完整 diff 退订超期合约', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // 滑出并推进超过宽限期
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) })

    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  })

  it('LRU：订阅数逼近 SOFT_LIMIT 时淘汰最久未见的合约', async () => {
    const { result } = renderHook(() => useSubscriptionManager())

    // 先订阅一批合约，使 subscribedRef 逼近上限（通过可见区模拟）
    const base = Array.from({ length: 480 }, (_, i) => `ID${i}`)
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(base))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(unsubscribeMarket).mockClear()

    // 全部滑出（成为低优先级 LRU 候选），再订阅一批新合约 → 超过 SOFT_LIMIT → 触发 LRU 淘汰
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['NEW1', 'NEW2', 'NEW3']))
    await act(async () => { vi.advanceTimersByTime(110) })
    // 拖动停止 500ms 后执行完整 diff → LRU 淘汰最久未见的低优先级合约
    await act(async () => { vi.advanceTimersByTime(500) })

    // 淘汰的是旧合约（ID 类），而不是新可见的 NEW 合约
    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
    const evicted = vi.mocked(unsubscribeMarket).mock.calls.flat(2) as string[]
    expect(evicted.length).toBeGreaterThan(0)
    expect(evicted.every((id) => id.startsWith('ID'))).toBe(true)
    // 淘汰后订阅数回到 SOFT_LIMIT 以内
    expect(result.current.subscribed.size).toBeLessThanOrEqual(480)
  })

  it('自选与锁定合约永不退订', async () => {
    useMarketStore.setState({ lockedContracts: new Map([['au2508', 1]]) })
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // 滑出全部并超期
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) })

    // 退订调用不能包含锁定合约 au2508
    const unsubscribed = vi.mocked(unsubscribeMarket).mock.calls.flat(2) as string[]
    expect(unsubscribed).not.toContain('au2508')
  })

  it('滚动松手（markScrollEnd）立即完整 diff，跳过拖动态 500ms 窗口', async () => {
    renderHook(() => useSubscriptionManager())

    // 先静止订阅
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()
    vi.mocked(unsubscribeMarket).mockClear()

    // 模拟拖动：300ms 内 ≥2 次变化 → 拖动态，零 HTTP
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(vi.mocked(subscribeMarket)).not.toHaveBeenCalled()

    // 滚动松手 → 立即完整 diff（不推进 500ms 即订阅最终可见区 au2508）
    act(() => useMarketStore.getState().markScrollEnd())
    await act(async () => {})
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalled()
    const subbed = vi.mocked(subscribeMarket).mock.calls.flat(2) as string[]
    expect(subbed).toContain('au2508')

    // 松手后可见区变化不再被误判为拖动态 → 立即订阅（无 500ms 延迟）
    vi.mocked(subscribeMarket).mockClear()
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['NEW1']))
    await act(async () => {})
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['NEW1'])
  })
})

describe('useSubscriptionManager success 门控', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      selectedContracts: new Set(),
      scrollEndSeq: 0,
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('subscribe 返回 success:false 时不加入已订阅集合（后续仍会重试）', async () => {
    vi.mocked(subscribeMarket).mockResolvedValueOnce({ success: false } as any)
    const { result } = renderHook(() => useSubscriptionManager())

    // 第一次订阅被后端整批拒绝（如触顶 500 上限）
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    // 被拒合约未标记为已订阅 → 留在待订阅状态
    expect(result.current.subscribed.has('IF2608')).toBe(false)

    // 再次触发可见区变化（连续两次变化在 300ms 内 → 拖动态，零 HTTP）→
    // 停止后 500ms 完整 diff 重新尝试订阅（mock 恢复默认 success:true）
    vi.mocked(subscribeMarket).mockClear()
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(500) })

    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    expect(result.current.subscribed.has('IF2608')).toBe(true)
  })
})

describe('useSubscriptionManager 快照回填（方案 A）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      selectedContracts: new Set(),
      scrollEndSeq: 0,
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('订阅成功后调用 getSnapshots 回填缓存快照', async () => {
    const getSnapshotsMock = vi.mocked(getSnapshots)
    getSnapshotsMock.mockResolvedValue({ snapshots: { IF2608: { instrumentID: 'IF2608', lastPrice: 4000 } } } as any)
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // subscribe 已调用
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    // 回填：getSnapshots 收到订阅的合约
    expect(getSnapshotsMock).toHaveBeenCalledWith(['IF2608'])
    // 快照写入 store
    expect(useMarketStore.getState().snapshots.get('IF2608')?.lastPrice).toBe(4000)
  })

  it('getSnapshots 失败时静默，不抛错', async () => {
    const getSnapshotsMock = vi.mocked(getSnapshots)
    getSnapshotsMock.mockRejectedValue(new Error('network'))
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    expect(getSnapshotsMock).toHaveBeenCalled()
    // 不抛错（测试通过即证明静默）
  })
})
