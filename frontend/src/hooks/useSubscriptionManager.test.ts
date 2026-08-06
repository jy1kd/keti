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
