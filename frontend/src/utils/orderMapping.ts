// ============================================================
// 报单字段映射 — 前端字符串格式 ↔ CTP 字符码
// 根据 task.md PR-10 的前后端字段映射表
// ============================================================

// --- 前端 → CTP ---

const DIRECTION_TO_CTP: Record<string, string> = {
  buy: '0',
  sell: '1',
}

const OFFSET_TO_CTP: Record<string, string> = {
  open: '0',
  close: '1',
  close_today: '3',
}

const PRICE_TYPE_TO_CTP: Record<string, string> = {
  limit: '2',
  market: '1',
}

const TIME_CONDITION_TO_CTP: Record<string, string> = {
  gfd: '1',
  fok: '2',
  fak: '3',
}

const COMB_HEDGE_TO_CTP: Record<string, string> = {
  speculation: '1',
  arbitrage: '2',
  hedge: '3',
}

// --- CTP → 前端 ---

const DIRECTION_FROM_CTP: Record<string, string> = {
  '0': 'buy',
  '1': 'sell',
}

const OFFSET_FROM_CTP: Record<string, string> = {
  '0': 'open',
  '1': 'close',
  '3': 'close_today',
}

const ORDER_STATUS_FROM_CTP: Record<string, string> = {
  '0': 'all_traded',
  '1': 'partial',
  '2': 'no_traded',
  '5': 'canceled',
}

// --- 导出函数 ---

export function toCtpDirection(direction: string): string {
  return DIRECTION_TO_CTP[direction]
}

export function toCtpOffsetFlag(offsetFlag: string): string {
  return OFFSET_TO_CTP[offsetFlag]
}

export function toCtpPriceType(priceType: string): string {
  return PRICE_TYPE_TO_CTP[priceType]
}

export function toCtpTimeCondition(timeCondition: string): string {
  return TIME_CONDITION_TO_CTP[timeCondition]
}

export function toCtpHedgeFlag(combHedgeFlag: string): string {
  return COMB_HEDGE_TO_CTP[combHedgeFlag] ?? '1'
}

export function fromCtpDirection(ctpDirection: string): string {
  return DIRECTION_FROM_CTP[ctpDirection]
}

export function fromCtpOffsetFlag(ctpOffsetFlag: string): string {
  return OFFSET_FROM_CTP[ctpOffsetFlag]
}

export function fromCtpOrderStatus(ctpStatus: string): string {
  return ORDER_STATUS_FROM_CTP[ctpStatus]
}

export interface OrderRequestForm {
  instrumentID: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  orderPriceType: 'limit' | 'market'
  timeCondition: 'gfd' | 'fok' | 'fak'
  combHedgeFlag?: 'speculation' | 'arbitrage' | 'hedge'
  limitPrice: number
  volumeTotalOriginal: number
  stopPrice?: number
}

export interface CtpOrderRequest {
  instrumentID: string
  direction: string
  offsetFlag: string
  priceType: string
  timeCondition: string
  volumeCondition: string
  hedgeFlag: string
  limitPrice: number
  volumeTotalOriginal: number
  stopPrice?: number
}

export function convertOrderRequest(form: OrderRequestForm): CtpOrderRequest {
  const timeCondition = toCtpTimeCondition(form.timeCondition)
  // volumeCondition: FOK → CV ("3"), FAK / GFD → AV ("1")
  const volumeCondition = timeCondition === '2' ? '3' : '1'

  const result: CtpOrderRequest = {
    instrumentID: form.instrumentID,
    direction: toCtpDirection(form.direction),
    offsetFlag: toCtpOffsetFlag(form.combOffsetFlag),
    priceType: toCtpPriceType(form.orderPriceType),
    timeCondition,
    volumeCondition,
    hedgeFlag: toCtpHedgeFlag(form.combHedgeFlag ?? 'speculation'),
    limitPrice: form.limitPrice,
    volumeTotalOriginal: form.volumeTotalOriginal,
  }
  if (form.stopPrice !== undefined) {
    result.stopPrice = form.stopPrice
  }
  return result
}
