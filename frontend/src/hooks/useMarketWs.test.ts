import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarketWs, resetGlobalWs } from './useMarketWs'
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
    onClose: vi.fn(),
    onOpen: vi.fn(),
  })),
}))

// Mock API to prevent real network calls
vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn(),
  getSnapshots: vi.fn(),
}))

// Mock contracts store
const mockLoadAllInstruments = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/contracts', () => ({
  useContractsStore: {
    getState: vi.fn(() => ({
      loadAllInstruments: mockLoadAllInstruments,
    })),
  },
}))

// Mock toast
const mockToastSuccess = vi.fn()
vi.mock('@/components/Toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
    _clearAll: vi.fn(),
  },
  ToastContainer: () => null,
}))

/** 推送一条消息并刷新批量缓冲区（前进 100ms） */
function pushAndFlush(act: (fn: () => void) => void, onMessage: (msg: { type: string; data: unknown }) => void, msg: { type: string; data: unknown }) {
  act(() => {
    onMessage(msg)
  })
  act(() => {
    vi.advanceTimersByTime(110)
  })
}

describe('useMarketWs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMarketStore.setState({
      snapshots: new Map(),
      currentPeriod: '5m',
      selectedInstrument: null,
      lockedContracts: new Map(),
    })
    // 重置全局单例
    resetGlobalWs()
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockDisconnectAll.mockClear()
    mockLoadAllInstruments.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连接 ws/market 端点', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))
    expect(mockConnect).toHaveBeenCalledWith('market', expect.any(Function))
  })

  it('收到 market_data 消息时批量更新 store', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    const snapshot: MarketSnapshot = {
      instrumentID: 'IF2608',
      lastPrice: 4120.0,
      bidPrice1: 4119.8,
      askPrice1: 4120.2,
      volume: 1000,
      openInterest: 5000,
    } as MarketSnapshot

    pushAndFlush(act, onMessage, { type: 'market_data', data: snapshot })

    expect(useMarketStore.getState().snapshots.get('IF2608')).toEqual(snapshot)
  })

  it('忽略非 market_data 消息', () => {
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    pushAndFlush(act, onMessage, { type: 'connection_status', data: { mdConnected: true } })

    expect(useMarketStore.getState().snapshots.size).toBe(0)
  })

  it('使用 useReconnect 实现断线重连', () => {
    const { result } = renderHook(() => useMarketWs('ws://localhost:8000'))

    expect(result.current).toHaveProperty('reconnectCount')
    expect(result.current).toHaveProperty('isReconnecting')
  })

  it('收到 market_data 时批量更新 K 线数据（appendKline）', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, selectedInstrument: 'IF2608' })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: {
        instrumentID: 'IF2608',
        lastPrice: 4120.0,
        volume: 100,
        openInterest: 500,
        openPrice: 4100.0,
        highPrice: 4130.0,
        lowPrice: 4090.0,
        preClosePrice: 4110.0,
        preSettlementPrice: 4105.0,
        updateTime: '14:30:00',
        updateMillisec: 500,
      },
    })

    expect(appendKline).toHaveBeenCalledWith(
      'IF2608',
      expect.objectContaining({
        close: 4120.0,
      }),
      expect.any(Number),
    )
  })

  it('未选中且未锁定的合约不计算 K 线（只缓冲快照）', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, selectedInstrument: null, lockedContracts: new Map() })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: {
        instrumentID: 'rb2510',
        lastPrice: 3500.0,
        volume: 100,
        openInterest: 500,
        updateTime: '14:30:00',
        updateMillisec: 500,
      },
    })

    // 快照仍应批量更新（表格要渲染），但 K 线不计算
    expect(useMarketStore.getState().snapshots.get('rb2510')).toBeDefined()
    expect(appendKline).not.toHaveBeenCalled()
  })

  it('锁定的合约（打开 K线/报单标签）也计算 K 线', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, selectedInstrument: null, lockedContracts: new Map([['au2508', 1]]) })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: {
        instrumentID: 'au2508',
        lastPrice: 600.5,
        volume: 100,
        openInterest: 500,
        updateTime: '14:30:00',
        updateMillisec: 500,
      },
    })

    expect(appendKline).toHaveBeenCalledWith(
      'au2508',
      expect.objectContaining({ close: 600.5 }),
      expect.any(Number),
    )
  })

  it('gate 使用最新 selectedInstrument（切换选中合约后 K 线跟随）', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, selectedInstrument: 'IF2608' })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    // 切到 au2508 后，IF2608 的 tick 不再算 K 线
    act(() => useMarketStore.getState().setSelectedInstrument('au2508'))

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: { instrumentID: 'IF2608', lastPrice: 4120, volume: 100, openInterest: 500, updateTime: '14:30:00', updateMillisec: 500 },
    })

    expect(appendKline).not.toHaveBeenCalled()
  })

  it('K 线时间戳按周期向下取整', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, currentPeriod: '5m', selectedInstrument: 'IF2608' })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: {
        instrumentID: 'IF2608',
        lastPrice: 4120.0,
        volume: 100,
        openInterest: 500,
        openPrice: 4100.0,
        highPrice: 4130.0,
        lowPrice: 4090.0,
        updateTime: '14:32:15',
        updateMillisec: 0,
      },
    })

    const klineArg = appendKline.mock.calls[0][1]
    const date = new Date(klineArg.timestamp)
    expect(date.getMinutes() % 5).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })

  it('切换 K 线周期后，实时聚合使用新周期（periodMs 经 ref 读取，非 mount 冻结闭包）', () => {
    const appendKline = vi.fn()
    useMarketStore.setState({ appendKline, currentPeriod: '1m', selectedInstrument: 'IF2608' })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    // mount 后切换到 5m：handleMessage 闭包在 mount 时冻结，periodMs 必须经 ref 才能拿到新周期
    act(() => useMarketStore.getState().setPeriod('5m'))

    pushAndFlush(act, onMessage, {
      type: 'market_data',
      data: {
        instrumentID: 'IF2608',
        lastPrice: 4120.0,
        volume: 100,
        openInterest: 500,
        updateTime: '14:32:15',
        updateMillisec: 0,
      },
    })

    const klineArg = appendKline.mock.calls[0][1]
    const date = new Date(klineArg.timestamp)
    // 14:32:15 按 5m 向下取整 → 14:30:00（分钟 % 5 === 0，秒 === 0）；
    // 若被 1m 周期冻结则会取整到 14:32:00（分钟 % 5 !== 0）
    expect(date.getMinutes() % 5).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })

  it('短时间内多条消息合并为一次更新', () => {
    const batchUpdate = vi.fn()
    useMarketStore.setState({ batchUpdate })

    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    // 连续发送 3 条消息（不刷新定时器）
    act(() => {
      onMessage({ type: 'market_data', data: { instrumentID: 'IF2608', lastPrice: 4100 } })
      onMessage({ type: 'market_data', data: { instrumentID: 'au2510', lastPrice: 600 } })
      onMessage({ type: 'market_data', data: { instrumentID: 'rb2510', lastPrice: 3500 } })
    })

    // 此时 batchUpdate 不应被调用（还在缓冲区）
    expect(batchUpdate).not.toHaveBeenCalled()

    // 刷新定时器
    act(() => {
      vi.advanceTimersByTime(110)
    })

    // 应该一次性更新所有 3 个快照
    expect(batchUpdate).toHaveBeenCalledTimes(1)
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ instrumentID: 'IF2608' }),
        expect.objectContaining({ instrumentID: 'au2510' }),
        expect.objectContaining({ instrumentID: 'rb2510' }),
      ]),
    )
  })
})

describe('useMarketWs - instruments_refreshed', () => {
  beforeEach(() => {
    useMarketStore.setState({ snapshots: new Map(), currentPeriod: '5m' })
    resetGlobalWs()
    mockConnect.mockClear()
    mockToastSuccess.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('收到 instruments_refreshed 时显示 toast 提示合约数量', async () => {
    vi.useFakeTimers()
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    act(() => {
      onMessage({ type: 'instruments_refreshed', data: { count: 17348 } })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('已更新 17348 个合约')
    vi.useRealTimers()
  })

  it('收到 instruments_refreshed 消息后重新加载合约列表', async () => {
    vi.useFakeTimers()
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    act(() => {
      onMessage({ type: 'instruments_refreshed', data: { count: 5 } })
    })

    expect(mockLoadAllInstruments).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('不响应非 instruments_refreshed 类型的 WS 消息', () => {
    vi.useFakeTimers()
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    act(() => {
      onMessage({ type: 'connection_status', data: { status: 'connected', target: 'md' } })
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('count=0 时不显示 toast', async () => {
    vi.useFakeTimers()
    renderHook(() => useMarketWs('ws://localhost:8000'))

    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void

    act(() => {
      onMessage({ type: 'instruments_refreshed', data: { count: 0 } })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
