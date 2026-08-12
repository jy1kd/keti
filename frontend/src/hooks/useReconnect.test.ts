import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReconnect } from './useReconnect'
import type { WSManager } from '@/services/ws'

interface MockWs extends WSManager {
  /** 模拟一次断线（触发已注册的 onClose 回调） */
  __fireClose: () => void
  /** 统计 onOpen 触发次数 */
  __openCount: () => number
}

/**
 * 构造可驱动生命周期的 WSManager mock：
 * - connect 成功时（openOnConnect=true）触发已注册的 onOpen 回调；
 * - onOpen/onClose 捕获回调，测试可手动 __fireClose 触发断线。
 */
function createMockWs(options: { openOnConnect?: boolean } = {}): MockWs {
  const { openOnConnect = true } = options
  let openCb: (() => void) | undefined
  let closeCb: ((event: unknown) => void) | undefined
  let connected = false
  let openCount = 0

  const ws = {
    connect: vi.fn(() => {
      if (openOnConnect) {
        connected = true
        openCount++
        openCb?.()
      }
      // openOnConnect=false → 连接失败，connected 保持 false，不触发 onOpen
    }),
    disconnect: vi.fn(),
    disconnectAll: vi.fn(),
    isConnected: vi.fn(() => connected),
    send: vi.fn(),
    onOpen: vi.fn((_endpoint: string, cb: () => void) => {
      openCb = cb
    }),
    onClose: vi.fn((_endpoint: string, cb: (event: unknown) => void) => {
      closeCb = cb
    }),
    __fireClose: () => {
      connected = false
      closeCb?.({ code: 1006 })
    },
    __openCount: () => openCount,
  } as unknown as MockWs

  return ws
}

describe('useReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes reconnect count and status', () => {
    const ws = createMockWs()

    const { result } = renderHook(() => useReconnect(ws, 'market'))

    expect(result.current).toHaveProperty('reconnectCount')
    expect(result.current).toHaveProperty('isReconnecting')
    expect(typeof result.current.reconnectCount).toBe('number')
    expect(typeof result.current.isReconnecting).toBe('boolean')
  })

  it('does not reconnect when connection is healthy', () => {
    const ws = createMockWs()

    renderHook(() => useReconnect(ws, 'market'))

    const initialCalls = vi.mocked(ws.connect).mock.calls.length

    // 连接健康（无断线事件）→ 不触发额外重连
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(initialCalls)
  })

  it('reconnects after disconnect with exponential backoff', () => {
    const ws = createMockWs()

    renderHook(() => useReconnect(ws, 'market'))
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(1) // 初始连接

    act(() => {
      ws.__fireClose() // 断线
    })
    // 退避期内不重连
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(1)
    // 1s 退避后重连
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(2)
  })

  it('成功重连后重置计数 — 多次断线仍持续重连', () => {
    // 回归测试：修复前 retryCountRef 只在 isConnected 为真时归零（该分支永不生效），
    // 断线满 5 次后 scheduleReconnect 永久放弃重连。
    const ws = createMockWs() // 每次 connect 成功 → 触发 onOpen

    renderHook(() => useReconnect(ws, 'market'))
    // 初始连接触发 1 次 onOpen
    expect(ws.__openCount()).toBe(1)

    // 连续 6 次「断线→成功重连」：计数已重置，每次退避都从 1s 开始，永不耗尽
    for (let i = 0; i < 6; i++) {
      const before = vi.mocked(ws.connect).mock.calls.length
      act(() => {
        ws.__fireClose()
        vi.advanceTimersByTime(1000) // 计数已重置 → 退避 1s
      })
      expect(vi.mocked(ws.connect).mock.calls.length).toBe(before + 1)
    }

    // 初始 + 6 次重连，共 7 次 onOpen
    expect(ws.__openCount()).toBe(7)
  })

  it('gives up after max retries (5)', () => {
    // 连接一直失败（不触发 onOpen）→ 计数不重置，连续 5 次后放弃
    const ws = createMockWs({ openOnConnect: false })

    renderHook(() => useReconnect(ws, 'market'))

    // 5 次断线 → 每次退避后重连失败（退避 1, 2, 4, 8, 16s）
    for (let i = 0; i < 5; i++) {
      act(() => {
        ws.__fireClose()
        vi.advanceTimersByTime(Math.pow(2, i) * 1000)
      })
    }
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(6) // 初始 + 5 次尝试

    // 第 6 次断线：已达 MAX_RETRIES，不再调度重连
    const callsBefore = vi.mocked(ws.connect).mock.calls.length
    act(() => {
      ws.__fireClose()
      vi.advanceTimersByTime(60000)
    })
    expect(vi.mocked(ws.connect).mock.calls.length).toBe(callsBefore)
  })
})
