/**
 * 盘口「我方挂单量」聚合 — 纯逻辑
 *
 * 从 `useQueryStore.orders`（refreshOrders 拉取的报单流水）中，
 * 按 当前合约 + 活动状态 + 限价 聚合未成交挂单，供 MarketDepth 档位显示与点击撤单。
 * direction：'0'=买（买入列），'1'=卖（卖出列）——CTP 字符码。
 */

/** API 返回的活动状态（CTP）：1=部分成交、2=已报排队、3=未成交 */
export const ACTIVE_ORDER_STATUSES = ['1', '2', '3']

/** 报单流水条目（对齐 queryStore RawOrder 的最小字段） */
export interface RawOrderEntry {
  orderRef: string
  instrumentID: string
  direction: string
  combOffsetFlag?: string
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded?: number
  orderStatus: string
  insertTime?: string
}

/** 单档位聚合：我方买/卖挂单的剩余量、笔数、orderRef 列表（撤单用） */
export interface MyOrderLevel {
  buyVolume: number
  sellVolume: number
  buyCount: number
  sellCount: number
  buyRefs: string[]
  sellRefs: string[]
}

export interface MyOrderAgg {
  /** 按限价索引 → 该档位我方挂单 */
  byPrice: Map<number, MyOrderLevel>
  /** 全档我方买/卖挂单笔数（汇总行 (N) 用） */
  totalBuyCount: number
  totalSellCount: number
}

const isActive = (s: string) => ACTIVE_ORDER_STATUSES.includes(s)

/** 聚合当前合约活动挂单 */
export function aggregateMyOrders(orders: RawOrderEntry[], instrumentID: string): MyOrderAgg {
  const byPrice = new Map<number, MyOrderLevel>()
  let totalBuyCount = 0
  let totalSellCount = 0

  for (const o of orders) {
    if (o.instrumentID !== instrumentID) continue
    if (!isActive(o.orderStatus)) continue
    const remaining = o.volumeTotalOriginal - (o.volumeTraded ?? 0)
    if (remaining <= 0) continue

    const level = byPrice.get(o.limitPrice) ?? {
      buyVolume: 0,
      sellVolume: 0,
      buyCount: 0,
      sellCount: 0,
      buyRefs: [],
      sellRefs: [],
    }
    if (o.direction === '0') {
      level.buyVolume += remaining
      level.buyCount += 1
      level.buyRefs.push(o.orderRef)
      totalBuyCount += 1
    } else if (o.direction === '1') {
      level.sellVolume += remaining
      level.sellCount += 1
      level.sellRefs.push(o.orderRef)
      totalSellCount += 1
    }
    byPrice.set(o.limitPrice, level)
  }

  return { byPrice, totalBuyCount, totalSellCount }
}
