import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscriptionManager } from './useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket, unsubscribeMarket } from '@/services/api'

vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn().mockResolvedValue({ success: true }),
  unsubscribeMarket: vi.fn().mockResolvedValue({ success: true }),
}))

describe('useSubscriptionManager 延迟退订', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      recentlyUpdated: new Set(),
      selectedContracts: new Set(),
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
      recentlyUpdated: new Set(),
      selectedContracts: new Set(),
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('拖动中（多次可见区变化）只订阅不退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()

    // 模拟拖动：连续多次可见区变化（300ms 内 ≥2 次 → 拖动态）
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
    // 但 subscribe 仍在进行（mock.calls 是 [[arg]]，需 flat(2) 展平到字符串层）
    expect(vi.mocked(subscribeMarket).mock.calls.flat(2)).toContain('au2508')
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
})
