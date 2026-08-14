import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscriptionManager } from './useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { useCollectionsStore } from '@/stores/collections'
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
      forceResubscribeSeq: 0,
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
    await act(async () => { vi.advanceTimersByTime(9_000) }) // 9s < 10s 宽限期

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
  })

  it('forceResubscribeSeq 递增时清空 subscribedRef 并对全部 should 重订阅', async () => {
    const { result } = renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    vi.mocked(subscribeMarket).mockClear()

    // 模拟 WS 重连触发强制重订阅：即使 IF2608 已在 subscribedRef 仍重发订阅
    act(() => useMarketStore.getState().markForceResubscribe())
    await act(async () => {})

    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    expect(result.current.subscribed.has('IF2608')).toBe(true)
  })

  it('宽限期收紧到 10s：滑出超过 10s 才退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()

    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    // 9s：仍在宽限期内 → 不退订
    await act(async () => { vi.advanceTimersByTime(9_000) })
    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()

    // 再过 2s（累计 11s > 10s）→ 触发到期重排定时器 → 退订
    await act(async () => { vi.advanceTimersByTime(2_000) })
    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
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
      forceResubscribeSeq: 0,
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

  it('should 集超 SOFT_LIMIT 时本批最多订阅 SOFT_LIMIT，超出部分留待下次 diff 并告警', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      renderHook(() => useSubscriptionManager())

      // 可见区 554 个合约（> 后端 500 上限，直接整批提交会被原子拒绝）→ 本批只能提交前 SOFT_LIMIT 个
      const big = Array.from({ length: 554 }, (_, i) => `VIS${i}`)
      act(() => useMarketStore.getState().setVisibleInstrumentIDs(big))
      await act(async () => { vi.advanceTimersByTime(110) })

      // 只提交一个 ≤ SOFT_LIMIT 的批次（而非 554），超出的留待下次 diff
      expect(vi.mocked(subscribeMarket)).toHaveBeenCalledTimes(1)
      const batch = vi.mocked(subscribeMarket).mock.calls[0][0] as string[]
      expect(batch).toHaveLength(480)
      // 告警记录了丢弃数（留待下次 diff 重试）
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('留待下次 diff'))

      // 下次 diff 重试被丢弃的余量（VIS480..VIS553，74 个）：可见区收窄到余量 → 容量释放
      // → 第二次订阅批次包含全部余量合约。两次可见变化在 300ms 内被判为拖动态，
      // 完整 diff 在拖停后 500ms 执行（需推进定时器越过拖停窗口）。
      vi.mocked(subscribeMarket).mockClear()
      act(() => useMarketStore.getState().setVisibleInstrumentIDs(big.slice(480)))
      await act(async () => { vi.advanceTimersByTime(110) })
      await act(async () => { vi.advanceTimersByTime(500) })

      const retried = vi.mocked(subscribeMarket).mock.calls.flat(2) as string[]
      expect(retried.length).toBe(74)
      expect(retried.sort()).toEqual(big.slice(480).sort())
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('锁定/解锁合约变化不喂入拖动启发（可见集未变 → 立即 diff，不误判拖动）', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()

    // 两次锁定变化在 300ms 内（可见集不变）：若被误判为拖动态，第二次锁定的完整 diff
    // 会被拖到 500ms 拖停窗口后，订阅即时性受损
    act(() => useMarketStore.getState().addLockedContract('au2508'))
    await act(async () => { vi.advanceTimersByTime(100) })
    act(() => useMarketStore.getState().addLockedContract('ag2508'))
    await act(async () => {})

    // 无 500ms 拖停延迟：第二次锁定立即触发完整 diff，订阅新锁定合约
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['ag2508'])
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
      forceResubscribeSeq: 0,
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
      forceResubscribeSeq: 0,
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

describe('useSubscriptionManager 收藏不再自动订阅', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      selectedContracts: new Set(),
      scrollEndSeq: 0,
      forceResubscribeSeq: 0,
    })
  })
  afterEach(() => { vi.useRealTimers() })

  it('收藏夹合约不自动订阅：shouldSubscribe 仅可见区 ∪ 锁定（自选扁平收藏已删除）', async () => {
    renderHook(() => useSubscriptionManager())

    // 播种一个收藏夹（旧扁平收藏 favorites 已删除，订阅管理器不再读取收藏）
    useCollectionsStore.setState({
      collections: [{ id: 'coll-1', name: '默认收藏夹', instrumentIDs: ['au2508'] }],
      loaded: true,
    })
    await act(async () => { vi.advanceTimersByTime(110) })

    // 收藏夹合约不应被自动订阅（仅当进入可见区/锁定才订阅）
    expect(vi.mocked(subscribeMarket)).not.toHaveBeenCalled()
  })
})
