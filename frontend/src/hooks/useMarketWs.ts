import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { toast } from '@/components/Toast'
import { useReconnect } from './useReconnect'
import type { MarketSnapshot, KLineData, WSMessage } from '@/services/types'

/** 周期字符串 → 毫秒 */
export const PERIOD_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '1d': 86_400_000,
}

/**
 * 将行情快照转换为 K 线数据点
 * 使用 actionDay + updateTime 构造完整 UTC epoch 时间戳（秒），与后端一致。
 * @param periodMs 周期毫秒数，用于将时间戳向下取整到周期边界
 */
function snapshotToKline(snap: MarketSnapshot, periodMs: number): KLineData {
  const [h = 0, m = 0, s = 0] = (snap.updateTime ?? '00:00:00').split(':').map(Number)
  const timeSec = h * 3600 + m * 60 + s

  // 用 actionDay 构造完整 UTC 时间戳（秒）
  let dayStartSec = 0
  const actionDay = snap.actionDay || snap.tradingDay
  if (actionDay && actionDay.length === 8) {
    // actionDay 格式 "YYYYMMDD"，CTP 时间是 UTC+8
    const year = parseInt(actionDay.slice(0, 4), 10)
    const month = parseInt(actionDay.slice(4, 6), 10) - 1
    const day = parseInt(actionDay.slice(6, 8), 10)
    // Date.UTC 返回毫秒，除以1000得到秒
    dayStartSec = Date.UTC(year, month, day) / 1000
    // CTP 时间是 UTC+8，需要减去8小时得到 UTC 时间戳
    dayStartSec -= 8 * 3600
  } else {
    // fallback: 今天零点（UTC+8）
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [y, mo, d] = todayStr.split('-').map(Number)
    dayStartSec = Date.UTC(y, mo - 1, d) / 1000 - 8 * 3600
  }

  // 完整 UTC 时间戳（秒），向下取整到周期边界
  const fullTimestampSec = dayStartSec + timeSec
  const timestampSec = Math.floor(fullTimestampSec / (periodMs / 1000)) * (periodMs / 1000)
  // 转为毫秒返回
  const timestamp = timestampSec * 1000

  return {
    timestamp,
    open: snap.openPrice,
    high: snap.highestPrice,
    low: snap.lowestPrice,
    close: snap.lastPrice,
    volume: snap.volume,
    openInterest: snap.openInterest,
  }
}

/** 批量刷新间隔（毫秒）— 100ms 内的所有行情消息合并为一次状态更新 */
const FLUSH_INTERVAL_MS = 100

/** 全局单例 WSManager 实例 */
let globalWs: WSManager | null = null

/**
 * 重置全局 WSManager 实例（仅用于测试）
 */
export function resetGlobalWs(): void {
  if (globalWs) {
    globalWs.disconnectAll()
    globalWs = null
  }
}

/**
 * WebSocket 行情推送 Hook（单例模式）
 * 全局只创建一个 WSManager 实例，连接 ws/market 端点。
 * 收到 market_data 消息时更新行情 store。
 * 内置断线重连（指数退避，最多 5 次）。
 *
 * 使用批量更新策略：将短时间内的多条消息缓冲，每 100ms 合并为一次状态更新，
 * 减少 React 重渲染次数（50 个合约从 50 次/秒降至 10 次/秒）。
 *
 * 周期从 store.currentPeriod 读取，通过 store.setPeriod 切换。
 *
 * @param wsBaseUrl WebSocket 基础地址
 */
export function useMarketWs(wsBaseUrl: string) {
  const snapshotBufferRef = useRef<MarketSnapshot[]>([])
  const klineBufferRef = useRef<Map<string, KLineData>>(new Map())
  const batchUpdate = useMarketStore((s) => s.batchUpdate)
  const appendKline = useMarketStore((s) => s.appendKline)
  const currentPeriod = useMarketStore((s) => s.currentPeriod)

  // 创建全局单例 WSManager（仅创建一次）
  if (!globalWs) {
    globalWs = new WSManager(wsBaseUrl)
  }

  const ws = globalWs
  const periodMs = PERIOD_MS[currentPeriod] ?? PERIOD_MS['5m']

  // 定时刷新缓冲区
  useEffect(() => {
    const timer = setInterval(() => {
      const snaps = snapshotBufferRef.current
      const klines = klineBufferRef.current

      if (snaps.length === 0 && klines.size === 0) return

      // 批量更新快照（一次 set 触发一次重渲染）
      if (snaps.length > 0) {
        batchUpdate(snaps)
        snapshotBufferRef.current = []
      }

      // 逐个更新 K 线（每个合约取最新一根，appendKline 内部处理去重）
      for (const [instrument, candle] of klines) {
        appendKline(instrument, candle)
      }
      klineBufferRef.current = new Map()
    }, FLUSH_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [batchUpdate, appendKline])

  // 消息处理回调 — 只缓冲，不立即更新状态
  const handleMessage = (message: WSMessage) => {
    console.log('[useMarketWs] received:', message.type, message.data)
    if (message.type === 'market_data') {
      const snap = message.data as MarketSnapshot
      // 缓冲快照
      snapshotBufferRef.current.push(snap)
      // 缓冲 K 线（同一合约多次更新只保留最新）
      klineBufferRef.current.set(snap.instrumentID, snapshotToKline(snap, periodMs))
    } else if (message.type === 'instruments_refreshed') {
      // 合约列表刷新完成
      const count = (message.data as { count: number }).count
      if (count > 0) {
        toast.success(`已更新 ${count} 个合约`)
        // 重新加载合约列表
        useContractsStore.getState().loadSubscribedContracts()
      }
      // 通知监听者 CTP 刷新完成
      window.dispatchEvent(new CustomEvent('instruments_refreshed', { detail: { count } }))
    }
  }

  // 使用 useReconnect 管理连接和重连
  const { reconnectCount, isReconnecting } = useReconnect(ws, 'market', handleMessage)

  // 组件卸载时不断开连接（单例模式，由其他组件管理生命周期）
  // 注意：不再调用 ws.disconnectAll()

  return { reconnectCount, isReconnecting }
}
