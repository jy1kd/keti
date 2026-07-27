import axios from 'axios'
import type { ApiResponse, ContractInfo, MarketSnapshot, KLineData, OptionChain } from './types'
import { convertOrderRequest } from '../utils/orderMapping'
import type { OrderRequestForm } from '../utils/orderMapping'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器：统一处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      '网络异常'
    console.error('[API Error]', message)
    return Promise.reject(error)
  }
)

/**
 * 通用 GET 请求
 */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const { data } = await api.get<ApiResponse<T>>(url, { params })
  return data
}

/**
 * 通用 POST 请求
 */
export async function post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  const { data } = await api.post<ApiResponse<T>>(url, body)
  return data
}

// ── 行情 API ────────────────────────────────────────────────────────

interface InstrumentsResponse {
  instruments: ContractInfo[]
  count: number
}

interface SubscribeResponse {
  success: boolean
  added: string[]
  alreadySubscribed: string[]
}

interface SnapshotsResponse {
  snapshots: Record<string, MarketSnapshot>
}

/** 获取合约列表，支持 keyword 模糊搜索 */
export async function getInstruments(keyword?: string): Promise<InstrumentsResponse> {
  const params = keyword ? { keyword } : undefined
  const { data } = await api.get<InstrumentsResponse>('/api/market/instruments', { params })
  return data
}

/** 订阅行情 */
export async function subscribeMarket(instruments: string[]): Promise<SubscribeResponse> {
  const { data } = await api.post<SubscribeResponse>('/api/market/subscribe', { instruments })
  return data
}

/** 获取行情快照，不传参数则获取全部 */
export async function getSnapshots(instruments?: string[]): Promise<SnapshotsResponse> {
  const params = instruments?.length ? { instruments: instruments.join(',') } : undefined
  const { data } = await api.get<SnapshotsResponse>('/api/market/snapshots', { params })
  return data
}

// ── K线 API ────────────────────────────────────────────────────────

interface KlineResponse {
  instrumentID: string
  period: string
  bars: KLineData[]
}

/** 获取K线数据 */
export async function getKlineData(instrument: string, period: string, count?: number): Promise<KlineResponse> {
  const { data } = await api.get<KlineResponse>('/api/market/kline', {
    params: { instrument, period, count },
  })
  // 后端返回 time 字符串，前端需要 timestamp 毫秒数
  if (data.bars) {
    data.bars = data.bars.map((bar: KLineData & { time?: string }) => ({
      ...bar,
      timestamp: bar.timestamp ?? (bar.time ? new Date(bar.time).getTime() : 0),
    }))
  }
  return data
}

// ── 报单 API ────────────────────────────────────────────────────────

interface OrderSubmitResponse {
  success: boolean
  orderRef: string
  error?: string
}

interface CancelResponse {
  success: boolean
  message?: string
}

/** 提交报单，自动转换前端字段 → CTP 字段 */
export async function submitOrder(order: OrderRequestForm): Promise<OrderSubmitResponse> {
  const ctpOrder = convertOrderRequest(order)
  const { data } = await api.post<OrderSubmitResponse>('/api/order/insert', ctpOrder)
  return data
}

/** 撤单 */
export async function cancelOrder(orderRef: string): Promise<CancelResponse> {
  const { data } = await api.post<CancelResponse>('/api/order/cancel', { orderRef })
  return data
}

// ── 连接状态 API ────────────────────────────────────────────────────────

export interface ConnectionStatusResponse {
  loggedIn: boolean
  mdConnected: boolean
  tdConnected: boolean
}

/** 查询 CTP 连接状态（MD/TD 独立） */
export async function getConnectionStatus(): Promise<ConnectionStatusResponse> {
  const { data } = await api.get<ConnectionStatusResponse>('/api/connection/status')
  return data
}

// ── 合约查询 API ──────────────────────────────────────────────────────

interface RefreshResponse {
  status: string
}

/** 触发后端从 CTP 刷新全量合约列表 */
export async function refreshInstruments(): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>('/api/market/instruments/refresh')
  return data
}

// ── 合约搜索 API ────────────────────────────────────────────────────

interface ExchangesResponse {
  exchanges: string[]
}

interface ProductsResponse {
  products: string[]
}

interface PresetResponse {
  instruments: string[]
  updatedAt: string | null
}

/** 获取交易所列表 */
export async function getExchanges(): Promise<ExchangesResponse> {
  const { data } = await api.get<ExchangesResponse>('/api/market/instruments/exchanges')
  return data
}

/** 获取指定交易所下的品种列表 */
export async function getProducts(exchange: string): Promise<ProductsResponse> {
  const { data } = await api.get<ProductsResponse>('/api/market/instruments/products', {
    params: { exchange },
  })
  return data
}

/** 按交易所+品种搜索合约 */
export async function searchInstruments(
  exchange: string,
  product: string,
  keyword?: string
): Promise<InstrumentsResponse> {
  const params: Record<string, string> = { exchange, product }
  if (keyword) params.keyword = keyword
  const { data } = await api.get<InstrumentsResponse>('/api/market/instruments/search', { params })
  return data
}

/** 获取预设合约列表 */
export async function getPresetInstruments(): Promise<PresetResponse> {
  const { data } = await api.get<PresetResponse>('/api/market/preset')
  return data
}

/** 按 ID 列表批量获取合约详情 */
export async function getInstrumentsByIds(ids: string[]): Promise<InstrumentsResponse> {
  const { data } = await api.get<InstrumentsResponse>('/api/market/instruments', {
    params: { ids: ids.join(',') },
  })
  return data
}

/** 刷新预设合约（自动检测主力合约） */
export async function refreshPresetInstruments(): Promise<{ success: boolean; instruments: string[] }> {
  const { data } = await api.post<{ success: boolean; instruments: string[] }>('/api/market/preset/refresh')
  return data
}

// ── 期权 API ──────────────────────────────────────────────────────────

interface OptionUnderlyingsResponse {
  underlyings: string[]
}

/** 获取可用的期权标的列表（轻量级，不加载全部期权链） */
export async function getOptionUnderlyings(): Promise<OptionUnderlyingsResponse> {
  const { data } = await api.get<OptionUnderlyingsResponse>('/api/market/options/underlyings')
  return data
}

interface OptionChainsResponse {
  chains: OptionChain[]
}

/** 获取期权T型报价数据 */
export async function getOptionChains(underlying?: string, expireDate?: string): Promise<OptionChainsResponse> {
  const params: Record<string, string | undefined> = { underlying, expire_date: expireDate }
  const { data } = await api.get<OptionChainsResponse>('/api/market/option_chain', { params })
  return data
}

interface VolatilityResponse {
  volatility: Array<{
    instrumentID: string
    impliedVolatility: number
    underlyingPrice: number
    strikePrice: number
    timeToExpiry: number
    riskFreeRate: number
    optionType: string
  }>
}

/** 获取期权隐含波动率（Black-Scholes 计算，依赖后端行情快照） */
export async function getVolatility(underlying?: string): Promise<VolatilityResponse> {
  const params = underlying ? { underlying } : undefined
  const { data } = await api.get<VolatilityResponse>('/api/market/volatility', { params })
  return data
}

// ── 退订 API ────────────────────────────────────────────────────────

interface UnsubscribeResponse {
  success: boolean
  removed: number
}

/** 退订行情 */
export async function unsubscribeMarket(instruments: string[]): Promise<UnsubscribeResponse> {
  const { data } = await api.post<UnsubscribeResponse>('/api/market/unsubscribe', { instruments })
  return data
}

// ── PR-15: 快捷功能 API ────────────────────────────────────────────────

interface CancelAllResponse {
  success: boolean
  cancelled: number
  failed: number
  errors: string[]
}

interface ReverseResponse {
  success: boolean
  message: string
}

interface LockResponse {
  success: boolean
  message: string
}

interface PositionsResponse {
  positions: Array<{
    instrumentID: string
    posiDirection: string
    position: number
    positionProfit: number
  }>
  count: number
}

interface OrdersResponse {
  orders: Array<{
    orderRef: string
    instrumentID: string
    direction: string
    combOffsetFlag: string
    limitPrice: number
    volumeTotalOriginal: number
    orderStatus: string
  }>
  count: number
}

/** 批量撤单 — 撤销所有未成交报单
 *  TODO: PR-16 查询面板中"批量撤单"按钮将使用此函数 */
export async function cancelAllOrders(): Promise<CancelAllResponse> {
  const { data } = await api.post<CancelAllResponse>('/api/order/cancel_all')
  return data
}

/** 一键反向 — 平仓并反向开仓 */
export async function reversePosition(instrumentID: string): Promise<ReverseResponse> {
  const { data } = await api.post<ReverseResponse>('/api/order/reverse', { instrumentID })
  return data
}

/** 一键锁仓 — 反手锁仓或双开锁仓 */
export async function lockPosition(instrumentID: string): Promise<LockResponse> {
  const { data } = await api.post<LockResponse>('/api/order/lock', { instrumentID })
  return data
}

/** 查询持仓列表（缓存） */
export async function getPositions(): Promise<PositionsResponse> {
  const { data } = await api.get<PositionsResponse>('/api/query/positions')
  return data
}

/** 刷新持仓（触发 CTP 查询） */
export async function refreshPositions(): Promise<PositionsResponse> {
  const { data } = await api.post<PositionsResponse>('/api/query/positions/refresh')
  return data
}

/** 查询报单列表（缓存） */
export async function getOrders(): Promise<OrdersResponse> {
  const { data } = await api.get<OrdersResponse>('/api/query/orders')
  return data
}

/** 刷新报单（触发 CTP 查询） */
export async function refreshOrders(): Promise<OrdersResponse> {
  const { data } = await api.post<OrdersResponse>('/api/query/orders/refresh')
  return data
}

// ── PR-16: 查询面板 API ──────────────────────────────────────────────

interface TradesResponse {
  trades: Array<{
    tradeID: string
    orderRef: string
    instrumentID: string
    direction: string
    offsetFlag: string
    price: number
    volume: number
    tradeTime: string
  }>
  count: number
}

interface AccountResponse {
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

interface StopOrdersResponse {
  stopOrders: Array<{
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
  }>
  count: number
}

interface ContractsResponse {
  contracts: Array<{
    instrumentID: string
    instrumentName: string
    exchangeID: string
    productID: string
    volumeMultiple: number
    priceTick: number
    expireDate: string
    isTrading: boolean
  }>
  count: number
}

/** 查询成交流水（缓存） */
export async function getTrades(): Promise<TradesResponse> {
  const { data } = await api.get<TradesResponse>('/api/query/trades')
  return data
}

/** 刷新成交（触发 CTP 查询） */
export async function refreshTrades(): Promise<TradesResponse> {
  const { data } = await api.post<TradesResponse>('/api/query/trades/refresh')
  return data
}

/** 查询账户资金（缓存） */
export async function getAccount(): Promise<AccountResponse> {
  const { data } = await api.get<AccountResponse>('/api/query/account')
  return data
}

/** 刷新账户资金（触发 CTP 查询） */
export async function refreshAccount(): Promise<AccountResponse> {
  const { data } = await api.post<AccountResponse>('/api/query/account/refresh')
  return data
}

/** 查询止损单列表 */
export async function getStopOrders(): Promise<StopOrdersResponse> {
  const { data } = await api.get<StopOrdersResponse>('/api/order/stop/list')
  return data
}

/** 提交止损单 */
export async function submitStopOrder(params: {
  instrumentID: string
  direction: string
  offsetFlag: string
  limitPrice: number
  volume: number
  stopPrice: number
}): Promise<{ success: boolean; stopOrderID?: string; message?: string }> {
  const { data } = await api.post('/api/order/stop', params)
  return data
}

/** 取消止损单 */
export async function cancelStopOrder(stopOrderID: string): Promise<CancelResponse> {
  const { data } = await api.post<CancelResponse>('/api/order/stop/cancel', { stopOrderID })
  return data
}

/** 查询合约信息（keyword 搜索 instrumentID/instrumentName/exchangeID/productID） */
export async function getContracts(keyword?: string): Promise<ContractsResponse> {
  const params = keyword ? { keyword } : undefined
  const { data } = await api.get<ContractsResponse>('/api/query/contracts', { params })
  return data
}
