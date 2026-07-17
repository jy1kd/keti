import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarketWs } from './useMarketWs'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot } from '@/services/types'

// Mock WSManager
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockDisconnectAll = vi.fn()

vi.mock('@/services/ws', () => ({
  WSManager: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    disconnectAll: mockDisconnectAll,
    isConnected: vi.fn().mockReturnValue(false),
  })),
}))

describe('useMarketWs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMarketStore.setState({ snapshots: new Map() })
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockDisconnectAll.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连接 ws/market 端点', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))
    expect(mockConnect).toHaveBeenCalledWith('market', expect.any(Function))
  })

  it('收到 market_data 消息时更新 store', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))

    // 获取 connect 调用时注册的回调
    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: MarketSnapshot }) => void

    const snapshot: MarketSnapshot = {
      instrumentID: 'IF2608',
      lastPrice: 4120.0,
      bidPrice1: 4119.8,
      askPrice1: 4120.2,
      volume: 1000,
      openInterest: 5000,
    } as MarketSnapshot

    act(() => {
      onMessage({ type: 'market_data', data: snapshot })
    })

    expect(useMarketStore.getState().snapshots.get('IF2608')).toEqual(snapshot)
  })

  it('忽略非 market_data 消息', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    act(() => {
      onMessage({ type: 'connection_status', data: { mdConnected: true } })
    })

    expect(useMarketStore.getState().snapshots.size).toBe(0)
  })

  it('组件卸载时断开连接', () => {
    const { unmount } = renderHook(() => useMarketWs('ws://localhost:8000'))

    unmount()
    expect(mockDisconnectAll).toHaveBeenCalled()
  })

  it('使用 useReconnect 实现断线重连', () => {
    const { result } = renderHook(() => useMarketWs('ws://localhost:8000'))

    // useMarketWs 应返回重连状态信息
    expect(result.current).toHaveProperty('reconnectCount')
    expect(result.current).toHaveProperty('isReconnecting')
  })
})
