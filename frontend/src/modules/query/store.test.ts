import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQueryStore } from './store'

// Mock API functions — store 使用 refresh* 函数（POST /refresh 触发 CTP 查询）
vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn(),
  refreshTrades: vi.fn(),
  refreshPositions: vi.fn(),
  refreshAccount: vi.fn(),
  getStopOrders: vi.fn(),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  cancelStopOrder: vi.fn(),
}))

import { refreshOrders, refreshTrades, refreshPositions, refreshAccount, getStopOrders, cancelOrder, cancelAllOrders, cancelStopOrder } from '../../services/api'

const mockRefreshOrders = vi.mocked(refreshOrders)
const mockRefreshTrades = vi.mocked(refreshTrades)
const mockRefreshPositions = vi.mocked(refreshPositions)
const mockRefreshAccount = vi.mocked(refreshAccount)
const mockGetStopOrders = vi.mocked(getStopOrders)
const mockCancelOrder = vi.mocked(cancelOrder)
const mockCancelAllOrders = vi.mocked(cancelAllOrders)
const mockCancelStopOrder = vi.mocked(cancelStopOrder)

describe('QueryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      activeTab: 'orders',
      orders: [],
      trades: [],
      positions: [],
      account: null,
      stopOrders: [],
      isPaused: false,
      isLoading: false,
      newOrderRefs: new Set(),
      newTradeIDs: new Set(),
    })
  })

  // ── Tab switching ──────────────────────────────────────────────

  it('defaults to orders tab', () => {
    expect(useQueryStore.getState().activeTab).toBe('orders')
  })

  it('sets active tab', () => {
    useQueryStore.getState().setActiveTab('trades')
    expect(useQueryStore.getState().activeTab).toBe('trades')
  })

  it('supports all tab values including stop_orders, quotes, contracts', () => {
    const tabs = ['orders', 'trades', 'positions', 'account', 'stop_orders', 'quotes', 'contracts'] as const
    for (const tab of tabs) {
      useQueryStore.getState().setActiveTab(tab)
      expect(useQueryStore.getState().activeTab).toBe(tab)
    }
  })

  // ── Pause / Resume ─────────────────────────────────────────────

  it('defaults to not paused', () => {
    expect(useQueryStore.getState().isPaused).toBe(false)
  })

  it('toggles pause', () => {
    useQueryStore.getState().togglePause()
    expect(useQueryStore.getState().isPaused).toBe(true)
    useQueryStore.getState().togglePause()
    expect(useQueryStore.getState().isPaused).toBe(false)
  })

  // ── Fetch Orders ───────────────────────────────────────────────

  it('fetchOrders populates orders from API', async () => {
    const mockOrders = [
      { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
    ]
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 1 })

    await useQueryStore.getState().fetchOrders()

    const state = useQueryStore.getState()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].orderRef).toBe('1001')
  })

  it('fetchOrders handles API error gracefully', async () => {
    mockRefreshOrders.mockRejectedValue(new Error('network'))

    await useQueryStore.getState().fetchOrders()

    expect(useQueryStore.getState().orders).toEqual([])
  })

  // ── Fetch Trades ───────────────────────────────────────────────

  it('fetchTrades populates trades from API', async () => {
    const mockTrades = [
      { tradeID: 'T001', orderRef: '1001', instrumentID: 'IF2608', direction: '0', offsetFlag: '0', price: 4800, volume: 1, tradeTime: '09:30:01' },
    ]
    mockRefreshTrades.mockResolvedValue({ trades: mockTrades, count: 1 })

    await useQueryStore.getState().fetchTrades()

    expect(useQueryStore.getState().trades).toHaveLength(1)
  })

  // ── Fetch Positions ────────────────────────────────────────────

  it('fetchPositions populates positions from API', async () => {
    const mockPositions = [
      { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
    ]
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 1 })

    await useQueryStore.getState().fetchPositions()

    expect(useQueryStore.getState().positions).toHaveLength(1)
    expect(useQueryStore.getState().positions[0].posiDirection).toBe('2')
  })

  // ── Fetch Account ──────────────────────────────────────────────

  it('fetchAccount populates account from API', async () => {
    const mockAccount = {
      accountID: 'test', balance: 100000, available: 50000, frozenMargin: 10000,
      currMargin: 40000, commission: 100, closeProfit: 500, positionProfit: 200,
      deposit: 0, withdraw: 0, preBalance: 99800, tradingDay: '20260727',
    }
    mockRefreshAccount.mockResolvedValue(mockAccount)

    await useQueryStore.getState().fetchAccount()

    expect(useQueryStore.getState().account).not.toBeNull()
    expect(useQueryStore.getState().account?.balance).toBe(100000)
  })

  // ── Fetch Stop Orders ──────────────────────────────────────────

  it('fetchStopOrders populates stop orders from API', async () => {
    const mockStopOrders = [
      { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'pending', createdAt: '09:30:00' },
    ]
    mockGetStopOrders.mockResolvedValue({ stopOrders: mockStopOrders, count: 1 })

    await useQueryStore.getState().fetchStopOrders()

    expect(useQueryStore.getState().stopOrders).toHaveLength(1)
    expect(useQueryStore.getState().stopOrders[0].status).toBe('pending')
  })

  // ── Refresh All ────────────────────────────────────────────────

  it('refreshAll calls all fetch methods', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: [], count: 0 })
    mockRefreshTrades.mockResolvedValue({ trades: [], count: 0 })
    mockRefreshPositions.mockResolvedValue({ positions: [], count: 0 })
    mockRefreshAccount.mockResolvedValue(null as never)
    mockGetStopOrders.mockResolvedValue({ stopOrders: [], count: 0 })

    await useQueryStore.getState().refreshAll()

    expect(mockRefreshOrders).toHaveBeenCalled()
    expect(mockRefreshTrades).toHaveBeenCalled()
    expect(mockRefreshPositions).toHaveBeenCalled()
    expect(mockRefreshAccount).toHaveBeenCalled()
    expect(mockGetStopOrders).toHaveBeenCalled()
  })

  it('refreshAll skips when paused', async () => {
    useQueryStore.setState({ isPaused: true })

    await useQueryStore.getState().refreshAll()

    expect(mockRefreshOrders).not.toHaveBeenCalled()
  })

  // ── Cancel Order ───────────────────────────────────────────────

  it('handleCancelOrder calls API and removes from orders', async () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })
    mockCancelOrder.mockResolvedValue({ success: true })

    const result = await useQueryStore.getState().handleCancelOrder('1001')

    expect(result).toBe(true)
    expect(mockCancelOrder).toHaveBeenCalledWith('1001')
    // F3: 乐观更新应使用 CTP 编码 '5'（已撤单），而非 'canceled'
    expect(useQueryStore.getState().orders[0].orderStatus).toBe('5')
  })

  // ── Cancel All Orders ──────────────────────────────────────────

  it('handleCancelAll calls cancelAllOrders API', async () => {
    mockCancelAllOrders.mockResolvedValue({ success: true, cancelled: 3, failed: 0, errors: [] })

    const result = await useQueryStore.getState().handleCancelAll()

    expect(result).toBe(true)
    expect(mockCancelAllOrders).toHaveBeenCalled()
  })

  // ── Cancel Stop Order ──────────────────────────────────────────

  it('handleCancelStopOrder calls API and updates status', async () => {
    useQueryStore.setState({
      stopOrders: [
        { stopOrderRef: 'S001', instrumentID: 'IF2608', direction: 'sell', combOffsetFlag: 'close', limitPrice: 4790, volumeTotalOriginal: 1, stopPrice: 4790, status: 'pending', createdAt: '09:30:00' },
      ],
    })
    mockCancelStopOrder.mockResolvedValue({ success: true })

    const result = await useQueryStore.getState().handleCancelStopOrder('S001')

    expect(result).toBe(true)
    expect(useQueryStore.getState().stopOrders[0].status).toBe('canceled')
  })

  // ── Incremental Order Update ───────────────────────────────────

  it('upsertOrder inserts new order at top', () => {
    const order = { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:31:00' }
    useQueryStore.getState().upsertOrder(order)

    const state = useQueryStore.getState()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].orderRef).toBe('1002')
    expect(state.newOrderRefs.has('1002')).toBe(true)
  })

  it('upsertOrder updates existing order in place', () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })

    useQueryStore.getState().upsertOrder({
      orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0',
      limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '3', statusMsg: '全部成交', insertTime: '09:30:00',
    })

    const state = useQueryStore.getState()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].volumeTraded).toBe(1)
    expect(state.orders[0].orderStatus).toBe('3')
    // Updated order should NOT be marked as new
    expect(state.newOrderRefs.has('1001')).toBe(false)
  })

  // ── Incremental Trade Update ───────────────────────────────────

  it('upsertTrade inserts new trade at top', () => {
    const trade = { tradeID: 'T002', orderRef: '1002', instrumentID: 'IF2608', direction: '0', offsetFlag: '0', price: 4810, volume: 1, tradeTime: '09:32:00' }
    useQueryStore.getState().upsertTrade(trade)

    expect(useQueryStore.getState().trades).toHaveLength(1)
    expect(useQueryStore.getState().newTradeIDs.has('T002')).toBe(true)
  })

  // ── Clear New Highlights ───────────────────────────────────────

  it('clearNewOrderRef removes from highlight set', () => {
    useQueryStore.setState({ newOrderRefs: new Set(['1001', '1002']) })

    useQueryStore.getState().clearNewOrderRef('1001')

    expect(useQueryStore.getState().newOrderRefs.has('1001')).toBe(false)
    expect(useQueryStore.getState().newOrderRefs.has('1002')).toBe(true)
  })

  it('clearNewTradeID removes from highlight set', () => {
    useQueryStore.setState({ newTradeIDs: new Set(['T001']) })

    useQueryStore.getState().clearNewTradeID('T001')

    expect(useQueryStore.getState().newTradeIDs.has('T001')).toBe(false)
  })
})
