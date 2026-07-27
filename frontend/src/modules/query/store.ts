import { create } from 'zustand'
import {
  refreshOrders,
  refreshTrades,
  refreshPositions,
  refreshAccount,
  getStopOrders,
  cancelOrder,
  cancelAllOrders,
  cancelStopOrder,
} from '../../services/api'
import type { AccountInfo, StopOrder } from '../../services/types'
import { toast } from '../../components/Toast'

// API 返回的原始类型（direction/offsetFlag/posiDirection 等为 CTP 字符串）
interface RawOrder {
  orderRef: string
  instrumentID: string
  direction: string
  combOffsetFlag: string
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded?: number
  orderStatus: string
  statusMsg?: string
  insertTime?: string
}

interface RawTrade {
  tradeID: string
  orderRef: string
  instrumentID: string
  direction: string
  offsetFlag: string
  price: number
  volume: number
  tradeTime: string
}

interface RawPosition {
  instrumentID: string
  posiDirection: string
  position: number
  positionCost: number
  positionProfit: number
  openCost: number
  useMargin: number
  todayPosition: number
  ydPosition: number
  tradingDay: string
}

// 前端使用类型（放宽约束，允许 CTP 原始字符串）
type OrderEntry = RawOrder
type TradeEntry = RawTrade
type PositionEntry = RawPosition

export type QueryTab = 'orders' | 'trades' | 'positions' | 'account' | 'stop_orders' | 'quotes' | 'contracts'

interface QueryStore {
  // Tab
  activeTab: QueryTab
  setActiveTab: (tab: QueryTab) => void

  // Data
  orders: OrderEntry[]
  trades: TradeEntry[]
  positions: PositionEntry[]
  account: AccountInfo | null
  stopOrders: StopOrder[]

  // New data highlight tracking
  newOrderRefs: Set<string>
  newTradeIDs: Set<string>
  clearNewOrderRef: (ref: string) => void
  clearNewTradeID: (id: string) => void

  // Control
  isPaused: boolean
  isLoading: boolean
  togglePause: () => void

  // Fetch methods
  fetchOrders: () => Promise<void>
  fetchTrades: () => Promise<void>
  fetchPositions: () => Promise<void>
  fetchAccount: () => Promise<void>
  fetchStopOrders: () => Promise<void>
  refreshAll: () => Promise<void>

  // Incremental update (from WebSocket)
  upsertOrder: (order: OrderEntry) => void
  upsertTrade: (trade: TradeEntry) => void

  // Actions
  handleCancelOrder: (orderRef: string) => Promise<boolean>
  handleCancelAll: () => Promise<boolean>
  handleCancelStopOrder: (stopOrderRef: string) => Promise<boolean>
}

export const useQueryStore = create<QueryStore>((set, get) => ({
  // Tab
  activeTab: 'orders',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Data
  orders: [],
  trades: [],
  positions: [],
  account: null,
  stopOrders: [],

  // Highlight tracking
  newOrderRefs: new Set<string>(),
  newTradeIDs: new Set<string>(),

  clearNewOrderRef: (ref) => {
    const next = new Set(get().newOrderRefs)
    next.delete(ref)
    set({ newOrderRefs: next })
  },

  clearNewTradeID: (id) => {
    const next = new Set(get().newTradeIDs)
    next.delete(id)
    set({ newTradeIDs: next })
  },

  // Control
  isPaused: false,
  isLoading: false,

  togglePause: () => set({ isPaused: !get().isPaused }),

  // ── Fetch methods ──────────────────────────────────────────────

  fetchOrders: async () => {
    try {
      // POST /refresh 触发 CTP 查询（GET 只读缓存，初始为空）
      const res = await refreshOrders()
      set({ orders: res.orders ?? [] })
    } catch {
      // Silently fail — keep existing data
    }
  },

  fetchTrades: async () => {
    try {
      const res = await refreshTrades()
      set({ trades: res.trades ?? [] })
    } catch {
      // Silently fail
    }
  },

  fetchPositions: async () => {
    try {
      const res = await refreshPositions()
      // as unknown as: CTP 返回 posiDirection 为 '2'/'3' 字符串，但 PositionInfo 类型定义为 'long'/'short'
      // 实际运行时数据是 CTP 格式，RawPosition 用 string 接收更准确
      set({ positions: (res.positions ?? []) as unknown as RawPosition[] })
    } catch {
      // Silently fail
    }
  },

  fetchAccount: async () => {
    try {
      const res = await refreshAccount()
      // POST /refresh 直接返回账户对象（非 ApiResponse 包装）
      set({ account: res ?? null })
    } catch {
      // Silently fail
    }
  },

  fetchStopOrders: async () => {
    try {
      const res = await getStopOrders()
      // as unknown as: API 返回的止损单结构与 StopOrder 类型字段一致但来源不同，安全断言
      set({ stopOrders: (res.stopOrders ?? []) as unknown as StopOrder[] })
    } catch {
      // Silently fail
    }
  },

  refreshAll: async () => {
    if (get().isPaused) return
    set({ isLoading: true })
    try {
      await Promise.all([
        get().fetchOrders(),
        get().fetchTrades(),
        get().fetchPositions(),
        get().fetchAccount(),
        get().fetchStopOrders(),
      ])
    } finally {
      set({ isLoading: false })
    }
  },

  // ── Incremental updates (from WebSocket) ───────────────────────

  upsertOrder: (order) => {
    const { orders, newOrderRefs } = get()
    const idx = orders.findIndex((o) => o.orderRef === order.orderRef)
    if (idx >= 0) {
      // Update existing — do NOT mark as new
      const next = [...orders]
      next[idx] = order
      set({ orders: next })
    } else {
      // Insert new at top — mark as new for highlight
      const nextNew = new Set(newOrderRefs)
      nextNew.add(order.orderRef)
      set({ orders: [order, ...orders], newOrderRefs: nextNew })
    }
  },

  upsertTrade: (trade) => {
    const { trades, newTradeIDs } = get()
    const exists = trades.some((t) => t.tradeID === trade.tradeID)
    if (!exists) {
      const nextNew = new Set(newTradeIDs)
      nextNew.add(trade.tradeID)
      set({ trades: [trade, ...trades], newTradeIDs: nextNew })
    }
  },

  // ── Actions ────────────────────────────────────────────────────

  handleCancelOrder: async (orderRef) => {
    try {
      const result = await cancelOrder(orderRef)
      if (result.success) {
        toast.success('撤单成功')
        // Optimistic: mark as canceled locally
        const orders = get().orders.map((o) =>
          o.orderRef === orderRef ? { ...o, orderStatus: '5' } : o
        )
        set({ orders })
        return true
      }
      toast.error(`撤单失败：${result.message || '未知错误'}`)
      return false
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`撤单失败：${message}`)
      return false
    }
  },

  handleCancelAll: async () => {
    try {
      const result = await cancelAllOrders()
      if (result.success) {
        toast.success(`已撤销 ${result.cancelled} 笔报单`)
        // Refresh to get updated status
        await get().fetchOrders()
        return true
      }
      toast.error('批量撤单失败')
      return false
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`批量撤单失败：${message}`)
      return false
    }
  },

  handleCancelStopOrder: async (stopOrderRef) => {
    try {
      const result = await cancelStopOrder(stopOrderRef)
      if (result.success) {
        toast.success('止损单已取消')
        // Optimistic: update status locally
        const stopOrders = get().stopOrders.map((s) =>
          s.stopOrderRef === stopOrderRef ? { ...s, status: 'canceled' as const } : s
        )
        set({ stopOrders })
        return true
      }
      toast.error('取消止损单失败')
      return false
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`取消止损单失败：${message}`)
      return false
    }
  },
}))
