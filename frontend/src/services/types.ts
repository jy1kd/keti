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
  optionType: 'call' | 'put'
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
  instrumentID: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded: number
  orderStatus: 'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected'
  statusMsg: string
  insertTime: string
}

export interface OrderStatus {
  orderRef: string
  instrumentID: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded: number
  orderStatus: 'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected'
  statusMsg: string
  insertTime: string
}

export interface StopOrderRequest {
  instrumentID: string
  direction: 'buy' | 'sell'
  combOffsetFlag: 'open' | 'close' | 'close_today'
  combHedgeFlag?: 'speculation' | 'arbitrage' | 'hedge'
  limitPrice: number
  volumeTotalOriginal: number
  stopPrice: number
  timeCondition: 'gfd' | 'fok' | 'fak'
}

export interface StopOrder {
  stopOrderID: string
  instrumentID: string
  direction: string
  offsetFlag: string
  limitPrice: number
  volume: number
  stopPrice: number
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
  direction: 'buy' | 'sell'
  offsetFlag: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  tradeTime: string
}

export interface PositionRecord {
  instrumentID: string
  posiDirection: 'long' | 'short'
  position: number
  positionCost: number
  positionProfit: number
  openCost: number
  useMargin: number
  todayPosition: number
  ydPosition: number
  tradingDay: string
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
  isTrading: boolean
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
  optionsType: 'call' | 'put'
  strikePrice: number
  expireDate: string
  volumeMultiple: number
  priceTick: number
  isTrading: boolean
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
  buy: string
  sell: string
  cancel: string
  [action: string]: string
}

export interface UserPreferences {
  selectedContracts: string[]
  hotKeys: HotKeyConfig
}
