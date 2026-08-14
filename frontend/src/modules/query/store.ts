import { create } from 'zustand'
import {
  refreshOrders,
  refreshPositions,
  refreshAccount,
  cancelOrder,
  cancelAllOrders,
} from '../../services/api'
import type { AccountInfo } from '../../services/types'
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
export type OrderEntry = RawOrder
export type PositionEntry = RawPosition

interface QueryStore {
  // Data
  orders: OrderEntry[]
  positions: PositionEntry[]
  account: AccountInfo | null

  // New order highlight tracking
  newOrderRefs: Set<string>
  clearNewOrderRef: (ref: string) => void

  // Control（轮询门控，报单面板读取；恒 false，无置位方）
  isPaused: boolean

  // Fetch methods
  fetchOrders: () => Promise<void>
  fetchPositions: () => Promise<void>
  fetchAccount: () => Promise<void>

  // Incremental update (from WebSocket)
  upsertOrder: (order: OrderEntry) => void

  // Actions
  handleCancelOrder: (orderRef: string) => Promise<boolean>
  handleCancelAll: () => Promise<boolean>
}

export const useQueryStore = create<QueryStore>((set, get) => ({
  // Data
  orders: [],
  positions: [],
  account: null,

  // Highlight tracking
  newOrderRefs: new Set<string>(),
  clearNewOrderRef: (ref) => {
    const next = new Set(get().newOrderRefs)
    next.delete(ref)
    set({ newOrderRefs: next })
  },

  // Control
  isPaused: false,

  // ── Fetch methods ──────────────────────────────────────────────

  fetchOrders: async () => {
    try {
      const res = await refreshOrders()
      if (res && typeof res === 'object' && 'orders' in res) {
        set({ orders: res.orders ?? [] })
      }
    } catch {
      // Silently fail
    }
  },

  fetchPositions: async () => {
    try {
      const res = await refreshPositions()
      if (res && typeof res === 'object' && 'positions' in res) {
        set({ positions: (res.positions ?? []) as unknown as RawPosition[] })
      }
    } catch {
      // Silently fail
    }
  },

  fetchAccount: async () => {
    try {
      const res = await refreshAccount()
      if (res && typeof res === 'object' && 'balance' in res) {
        set({ account: res })
      }
    } catch {
      // Silently fail
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
        toast.success(`已撤销 ${result.succeeded} 笔报单`)
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
}))
