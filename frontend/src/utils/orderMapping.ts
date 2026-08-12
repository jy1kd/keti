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
  arbitrage: '2',  // 套利合约走限价单
}

const TIME_CONDITION_TO_CTP: Record<string, string> = {
  gfd: '3',  // GFD
  fok: '1',  // FOK uses IOC
  fak: '1',  // FAK uses IOC
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
  '2': 'no_traded_queuing',
  '3': 'no_traded',
  '5': 'canceled',
  'a': 'unknown',
}

// --- 导出函数 ---

export function toCtpDirection(direction: string): string {
  return DIRECTION_TO_CTP[direction] ?? '0'
}

export function toCtpOffsetFlag(offsetFlag: string): string {
  return OFFSET_TO_CTP[offsetFlag] ?? '0'
}

export function toCtpPriceType(priceType: string): string {
  return PRICE_TYPE_TO_CTP[priceType] ?? '2'
}

export function toCtpTimeCondition(timeCondition: string): string {
  return TIME_CONDITION_TO_CTP[timeCondition] ?? '3'
}

export function toCtpHedgeFlag(combHedgeFlag: string): string {
  return COMB_HEDGE_TO_CTP[combHedgeFlag] ?? '1'
}

export function fromCtpDirection(ctpDirection: string): string {
  return DIRECTION_FROM_CTP[ctpDirection] ?? 'unknown'
}

export function fromCtpOffsetFlag(ctpOffsetFlag: string): string {
  return OFFSET_FROM_CTP[ctpOffsetFlag] ?? 'unknown'
}

export function fromCtpOrderStatus(ctpStatus: string): string {
  return ORDER_STATUS_FROM_CTP[ctpStatus] ?? 'unknown'
}

export interface OrderRequestForm {
  instrumentID: string
  exchangeID?: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  orderPriceType: 'limit' | 'market' | 'arbitrage'
  timeCondition: 'gfd' | 'fok' | 'fak'
  combHedgeFlag?: 'speculation' | 'arbitrage' | 'hedge'
  limitPrice: number
  volumeTotalOriginal: number
  stopPrice?: number
  productClass?: string  // 1=期货, 2=期权（服务端数量上限校验用）
  arbitrageLeg1?: string  // 套利腿1合约代码
  arbitrageLeg2?: string  // 套利腿2合约代码
}

export interface CtpOrderRequest {
  instrumentID: string
  exchangeID?: string
  direction: string
  offsetFlag: string
  priceType: string
  timeCondition: string
  volumeCondition: string
  hedgeFlag: string
  limitPrice: number
  volumeTotalOriginal: number
  stopPrice?: number
  productClass?: string
}

export function convertOrderRequest(form: OrderRequestForm): CtpOrderRequest {
  const timeCondition = toCtpTimeCondition(form.timeCondition)
  // volumeCondition: FOK → CV ("3"), FAK / GFD → AV ("1")
  const VOLUME_CONDITION_FOR_TC: Record<string, string> = {
    gfd: '1',  // GFD → AV (any volume)
    fok: '3',  // FOK → CV (complete volume)
    fak: '1',  // FAK → AV (any volume)
  }
  const volumeCondition = VOLUME_CONDITION_FOR_TC[form.timeCondition] ?? '1'

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
  if (form.exchangeID) {
    result.exchangeID = form.exchangeID
  }
  if (form.stopPrice !== undefined) {
    result.stopPrice = form.stopPrice
  }
  if (form.productClass) {
    result.productClass = form.productClass
  }
  return result
}
