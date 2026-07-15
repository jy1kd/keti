import axios from 'axios'
import type { ApiResponse, ContractInfo, MarketSnapshot } from './types'

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
