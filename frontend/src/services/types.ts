// ============================================================
// 数据模型定义 — 与 design.md 第4.6节一致
// 字段命名统一使用 camelCase，与 CTP 回调数据一致
// ============================================================

// --- 行情 ---

export interface MarketSnapshot {
  instrumentID: string
  lastPrice: number
  bidPrice1: number
  bidVolume1: number
  bidPrice2: number
  bidVolume2: number
  bidPrice3: number
  bidVolume3: number
  bidPrice4: number
  bidVolume4: number
  bidPrice5: number
  bidVolume5: number
  askPrice1: number
  askVolume1: number
  askPrice2: number
  askVolume2: number
  askPrice3: number
  askVolume3: number
  askPrice4: number
  askVolume4: number
  askPrice5: number
  askVolume5: number
  volume: number
  openInterest: number
  openPrice: number
  highestPrice: number
  lowestPrice: number
  closePrice: number
  settlementPrice: number
  preClosePrice: number
  preSettlementPrice: number
  upperLimitPrice: number
  lowerLimitPrice: number
  turnover: number
  averagePrice: number
  exchangeID: string
  tradingDay: string
  actionDay: string
  updateTime: string
  updateMillisec: number
}

export interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  openInterest: number
}

export interface DepthData {
  instrumentID: string
  bids: Array<{ price: number; volume: number }>
  asks: Array<{ price: number; volume: number }>
  updateTime: string
}

export interface VolatilityData {
  instrumentID: string
  underlyingPrice: number
  strikePrice: number
  impliedVolatility: number
  timeToExpiry: number
  riskFreeRate: number
  optionType: string  // '1'=看涨(call), '2'=看跌(put)
  updateTime: string
}

// --- 报单 ---

export interface OrderRequest {
  instrumentID: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  combHedgeFlag?: 'speculation' | 'arbitrage' | 'hedge'
  limitPrice: number
  volumeTotalOriginal: number
  orderPriceType: 'limit' | 'market'
  timeCondition: 'gfd' | 'fok' | 'fak'
  stopPrice?: number
}

export interface OrderRecord {
  orderRef: string
  orderSysID: string
  orderLocalID: string
  instrumentID: string
  exchangeID: string
  brokerID: string
  investorID: string
  userID: string
  direction: string  // '0'=买, '1'=卖
  combOffsetFlag: string  // '0'=开仓, '1'=平仓, '3'=平今
  combHedgeFlag: string
  orderPriceType: string
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded: number
  volumeTotal: number
  orderStatus: string  // '0'=全部成交, '1'=部分成交, '3'=未成交, '5'=已撤单
  orderSubmitStatus: string
  statusMsg: string
  timeCondition: string
  volumeCondition: string
  insertDate: string
  insertTime: string
  cancelTime: string
  updateTime: string
  tradingDay: string
  frontID: number
  sessionID: number
  stopPrice: number
  // --- 以下字段由后端返回，前端暂未使用 ---
  orderType?: string
  businessUnit?: string
  traderID?: string
}

// OrderStatus 与 OrderRecord 相同，保留别名兼容旧代码
export type OrderStatus = OrderRecord

export interface StopOrderRequest {
  instrumentID: string
  exchangeID?: string
  direction: string      // '0'=买, '1'=卖
  offsetFlag: string     // '0'=开仓, '1'=平仓, '3'=平今
  limitPrice: number
  volume: number
  stopPrice: number
  triggerPriceType?: string  // '1'=市价, '2'=限价（默认限价）
}

export interface StopOrder {
  stopOrderID: string
  instrumentID: string
  exchangeID?: string
  direction: string
  offsetFlag: string
  limitPrice: number
  volume: number
  stopPrice: number
  triggerPriceType?: string  // '1'=市价, '2'=限价
  status: string
  orderRef?: string
  createdAt: string
  triggeredAt?: string
}

// --- 成交/持仓/账户 ---

export interface TradeRecord {
  tradeID: string
  orderRef: string
  instrumentID: string
  direction: string  // '0'=买, '1'=卖
  offsetFlag: string  // '0'=开仓, '1'=平仓, '3'=平今
  price: number
  volume: number
  tradeTime: string
  // --- 以下字段由后端返回，前端暂未使用 ---
  exchangeID?: string
  hedgeFlag?: string
  tradeDate?: string
  tradingDay?: string
  tradeType?: string
  tradeSource?: string
  traderID?: string
  orderLocalID?: string
  participantID?: string
  sequenceNo?: number
  businessUnit?: string
  orderSysID?: string
  brokerID?: string
  investorID?: string
  userID?: string
}

export interface PositionRecord {
  instrumentID: string
  posiDirection: string  // '2'=多头, '3'=空头
  position: number
  positionCost: number
  positionProfit: number
  openCost: number
  useMargin: number
  todayPosition: number
  ydPosition: number
  tradingDay: string
  // --- 以下字段由后端返回，前端暂未使用 ---
  brokerID?: string
  investorID?: string
  exchangeID?: string
  hedgeFlag?: string
  positionDate?: string
  closeProfit?: number
  exchangeMargin?: number
}

export interface AccountInfo {
  accountID: string
  balance: number
  available: number
  frozenMargin: number
  currMargin: number
  commission: number
  closeProfit: number
  positionProfit: number
  deposit: number
  withdraw: number
  preBalance: number
  tradingDay: string
  // --- 以下字段由后端返回，前端暂未使用 ---
  brokerID?: string
}

// --- 合约/报价 ---

export interface ContractInfo {
  instrumentID: string
  instrumentName: string
  exchangeID: string
  productID: string
  volumeMultiple: number
  priceTick: number
  expireDate: string
  isTrading: number  // 0=不可交易, 1=可交易
  productClass: string  // "1"=期货, "2"=期权, "3"=组合
  /** 期权标的合约 ID（期权有值，如 "FG609"） */
  underlyingInstrID?: string
  /** 期权类型："1"=看涨(call), "2"=看跌(put) */
  optionsType?: string
  /** 行权价（期权有值） */
  strikePrice?: number
}

export interface QuoteDepth {
  instrumentID: string
  bidPrices: number[]
  bidVolumes: number[]
  askPrices: number[]
  askVolumes: number[]
  updateTime: string
}

// --- 期权 ---

export interface OptionContract {
  instrumentID: string
  instrumentName: string
  underlying: string
  optionsType: string  // '1'=看涨(call), '2'=看跌(put) — 注意：复数，与后端 CTP 字段一致
  strikePrice: number
  expireDate: string
  volumeMultiple: number
  priceTick: number
  isTrading: number  // 0=不可交易, 1=可交易
}

export interface OptionQuote {
  instrumentID: string
  strikePrice: number
  lastPrice: number
  bidPrice: number
  askPrice: number
  volume: number
  openInterest: number
  impliedVolatility: number
}

export interface OptionChain {
  underlying: string
  expireDate: string
  calls: OptionQuote[]
  puts: OptionQuote[]
  updateTime: string
}

// --- WebSocket 消息 ---

export type WSMessageType =
  | 'market_data'
  | 'order_return'
  | 'trade_return'
  | 'position_update'
  | 'stop_order_update'
  | 'connection_status'
  | 'instruments_refreshed'
  | 'ping'
  | 'error'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  data: T
}

export interface ConnectionStatusData {
  mdConnected: boolean
  tdConnected: boolean
  message: string
}

export interface ErrorData {
  code: string
  message: string
  relatedRef?: string
}

// --- API 响应 ---

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    ctpErrorID?: number
    ctpErrorMsg?: string
  }
}

// --- 用户偏好 ---

export interface HotKeyConfig {
  // 交易快捷键
  buy: string
  sell: string
  cancel: string
  reverse: string
  lock: string
  batchCancel: string
  // 导航快捷键
  openOrder: string
  openKline: string
  openSettings: string
  [action: string]: string
}

/** 快捷交易配置 */
export interface QuickTradeConfig {
  lock: {
    priceMode: 'counterparty' | 'market'
    offsetTicks: number
    timeCondition: 'gfd' | 'fak'
  }
  reverse: {
    close: {
      priceMode: 'counterparty' | 'market'
      offsetTicks: number
      timeCondition: 'gfd' | 'fak'
    }
    open: {
      priceMode: 'counterparty' | 'market'
      offsetTicks: number
      timeCondition: 'gfd' | 'fak'
    }
    executionMode: 'serial' | 'parallel'
  }
  confirmBeforeExecute: boolean
}

export interface UserPreferences {
  hotKeys: HotKeyConfig
  quickTradeConfig?: QuickTradeConfig
}
