import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQueryStore } from './store'

// Mock API functions — store 使用 refresh* 函数（POST /refresh 触发 CTP 查询）
vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn(),
  refreshPositions: vi.fn(),
  refreshAccount: vi.fn(),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
}))

import { refreshOrders, refreshPositions, refreshAccount, cancelOrder, cancelAllOrders } from '../../services/api'

const mockRefreshOrders = vi.mocked(refreshOrders)
const mockRefreshPositions = vi.mocked(refreshPositions)
const mockRefreshAccount = vi.mocked(refreshAccount)
const mockCancelOrder = vi.mocked(cancelOrder)
const mockCancelAllOrders = vi.mocked(cancelAllOrders)

describe('QueryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      orders: [],
      positions: [],
      account: null,
      isPaused: false,
      newOrderRefs: new Set(),
    })
  })

  // ── Pause ──────────────────────────────────────────────────────

  it('defaults to not paused', () => {
    expect(useQueryStore.getState().isPaused).toBe(false)
  })

  // ── Fetch Orders ───────────────────────────────────────────────

  it('fetchOrders populates orders from API', async () => {
    const mockOrders = [
      { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
    ]
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 1 })

    await useQueryStore.getState().fetchOrders()

    expect(useQueryStore.getState().orders).toHaveLength(1)
    expect(useQueryStore.getState().orders[0].orderRef).toBe('1001')
  })

  it('fetchOrders handles API error gracefully', async () => {
    mockRefreshOrders.mockRejectedValue(new Error('network'))
    await useQueryStore.getState().fetchOrders()
    expect(useQueryStore.getState().orders).toEqual([])
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
    expect(useQueryStore.getState().orders[0].orderStatus).toBe('5')
  })

  // ── Cancel All Orders ──────────────────────────────────────────

  it('handleCancelAll calls cancelAllOrders API', async () => {
    mockCancelAllOrders.mockResolvedValue({ success: true, attempted: 3, succeeded: 3, failedRefs: [] })

    const result = await useQueryStore.getState().handleCancelAll()

    expect(result).toBe(true)
    expect(mockCancelAllOrders).toHaveBeenCalled()
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
    expect(state.newOrderRefs.has('1001')).toBe(false)
  })

  // ── Clear New Highlights ───────────────────────────────────────

  it('clearNewOrderRef removes from highlight set', () => {
    useQueryStore.setState({ newOrderRefs: new Set(['1001', '1002']) })

    useQueryStore.getState().clearNewOrderRef('1001')

    expect(useQueryStore.getState().newOrderRefs.has('1001')).toBe(false)
    expect(useQueryStore.getState().newOrderRefs.has('1002')).toBe(true)
  })
})
