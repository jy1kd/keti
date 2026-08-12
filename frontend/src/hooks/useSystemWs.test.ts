import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSystemWs } from './useSystemWs'
import { useMarketStore } from '@/modules/market/store'

const mockConnect = vi.fn()
vi.mock('@/services/ws', () => ({
  WSManager: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnectAll: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    onClose: vi.fn(),
    onOpen: vi.fn(),
  })),
}))

describe('useSystemWs 强制重订阅触发', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMarketStore.setState({ forceResubscribeSeq: 0 })
    mockConnect.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('收到 connection_status mdConnected:true 时触发强制重订阅', () => {
    renderHook(() => useSystemWs('ws://localhost:8000'))
    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
    act(() => {
      onMessage({ type: 'connection_status', data: { mdConnected: true } })
    })
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(1)
  })

  it('mdConnected:false 不触发强制重订阅', () => {
    renderHook(() => useSystemWs('ws://localhost:8000'))
    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void
    act(() => {
      onMessage({ type: 'connection_status', data: { mdConnected: false } })
    })
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
  })
})
