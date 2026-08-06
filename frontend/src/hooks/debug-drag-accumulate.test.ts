import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscriptionManager } from './useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket, unsubscribeMarket, getSnapshots } from '@/services/api'

vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn().mockResolvedValue({ success: true, added: 1, alreadySubscribed: [] }),
  unsubscribeMarket: vi.fn().mockResolvedValue({ success: true, removed: 1 }),
  getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
}))

// 诊断：模拟拖动经过大量合约（subscribedRef 膨胀到近 480），再切到底部合约
// 验证底部合约是否被保留、数据是否会持续刷新
describe('debug: drag accumulates subs then switch to bottom', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({ visibleInstrumentIDs: [], lockedContracts: new Map(), selectedContracts: new Set() })
  })
  afterEach(() => vi.useRealTimers())

  it('subscribedRef 膨胀到 480 后，底部合约订阅会被后端拒绝吗', async () => {
    const { result } = renderHook(() => useSubscriptionManager())

    // 模拟拖动：依次可见 0..489（490 个合约滑过）
    for (let i = 0; i < 490; i++) {
      act(() => useMarketStore.getState().setVisibleInstrumentIDs([`C${i}`]))
      await act(async () => { vi.advanceTimersByTime(110) })
    }
    console.log('[debug] subscribedRef.size after dragging 490 contracts:', result.current.subscribed.size)

    // 切到底部合约（新合约，之前没订阅过）
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['BOTTOM1']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // 检查 subscribeMarket 最后一次调用
    const calls = vi.mocked(subscribeMarket).mock.calls
    console.log('[debug] subscribeMarket 最后一次调用参数:', JSON.stringify(calls[calls.length - 1]))
    // 检查 getSnapshots 是否对 BOTTOM1 回填
    const gsCalls = vi.mocked(getSnapshots).mock.calls
    console.log('[debug] getSnapshots 调用:', JSON.stringify(gsCalls.slice(-3)))
  })
})
