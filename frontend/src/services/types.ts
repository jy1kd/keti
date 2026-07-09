// ============================================================
// 数据模型定义 — 与 design.md 第4.6节一致
// ============================================================

// --- 行情 ---

export interface MarketSnapshot {
  instrument_id: string
  last_price: number
  bid_price1: number
  bid_volume1: number
  bid_price2: number
  bid_volume2: number
  bid_price3: number
  bid_volume3: number
  bid_price4: number
  bid_volume4: number
  bid_price5: number
  bid_volume5: number
  ask_price1: number
  ask_volume1: number
  ask_price2: number
  ask_volume2: number
  ask_price3: number
  ask_volume3: number
  ask_price4: number
  ask_volume4: number
  ask_price5: number
  ask_volume5: number
  volume: number
  open_interest: number
  open_price: number
  high_price: number
  low_price: number
  pre_close_price: number
  spread: number
  update_time: string
}

export interface KLineData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  open_interest: number
}

export interface DepthData {
  instrument_id: string
  bids: Array<{ price: number; volume: number }>
  asks: Array<{ price: number; volume: number }>
  update_time: string
}

export interface VolatilityData {
  instrument_id: string
  implied_volatility: number
  update_time: string
}

// --- 报单 ---

export interface OrderRequest {
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  order_type: 'limit' | 'market'
  time_condition: 'gfd' | 'fok' | 'fak'
  stop_price?: number
}

export interface OrderRecord {
  order_ref: string
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  volume_traded: number
  order_status: 'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected'
  status_msg: string
  insert_time: string
}

export interface OrderStatus {
  order_ref: string
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  volume_traded: number
  order_status: 'submitted' | 'partial' | 'all_traded' | 'canceled' | 'rejected'
  status_msg: string
  insert_time: string
}

export interface StopOrderRequest {
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  stop_price: number
  time_condition: 'gfd' | 'fok' | 'fak'
}

export interface StopOrder {
  stop_order_ref: string
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  stop_price: number
  status: 'pending' | 'triggered' | 'trigger_failed' | 'canceled'
  triggered_order_ref?: string
  created_at: string
  triggered_at?: string
}

// --- 成交/持仓/账户 ---

export interface TradeRecord {
  trade_id: string
  order_ref: string
  instrument_id: string
  direction: 'buy' | 'sell'
  offset: 'open' | 'close' | 'close_today'
  price: number
  volume: number
  trade_time: string
}

export interface PositionRecord {
  instrument_id: string
  direction: 'long' | 'short'
  position: number
  position_cost: number
  position_profit: number
  today_position: number
  yd_position: number
  update_time: string
}

export interface AccountInfo {
  account_id: string
  balance: number
  available: number
  frozen_margin: number
  frozen_cash: number
  commission: number
  close_profit: number
  position_profit: number
  risk_ratio: number
  update_time: string
}

// --- 合约/报价 ---

export interface ContractInfo {
  instrument_id: string
  instrument_name: string
  exchange_id: string
  product_id: string
  volume_multiple: number
  price_tick: number
  expire_date: string
  is_trading: boolean
}

export interface QuoteDepth {
  instrument_id: string
  bid_prices: number[]
  bid_volumes: number[]
  ask_prices: number[]
  ask_volumes: number[]
  update_time: string
}

// --- 期权 ---

export interface OptionContract {
  instrument_id: string
  instrument_name: string
  underlying: string
  option_type: 'call' | 'put'
  strike_price: number
  expire_date: string
  volume_multiple: number
  price_tick: number
  is_trading: boolean
}

export interface OptionQuote {
  instrument_id: string
  strike_price: number
  last_price: number
  bid_price: number
  ask_price: number
  volume: number
  open_interest: number
  implied_volatility: number
}

export interface OptionChain {
  underlying: string
  expire_date: string
  calls: OptionQuote[]
  puts: OptionQuote[]
  update_time: string
}

// --- WebSocket 消息 ---

export type WSMessageType =
  | 'market_data'
  | 'order_return'
  | 'trade_return'
  | 'position_update'
  | 'stop_order_update'
  | 'connection_status'
  | 'error'

export interface WSMessage<T = unknown> {
  type: WSMessageType
  data: T
}

export interface ConnectionStatusData {
  md_connected: boolean
  td_connected: boolean
  message: string
}

export interface ErrorData {
  code: string
  message: string
  related_ref?: string
}

// --- API 响应 ---

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    ctp_error_id?: number
    ctp_error_msg?: string
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
