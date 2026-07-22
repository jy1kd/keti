import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useMarketStore } from '@/modules/market/store'
import { useConnectionStore } from '@/stores/connection'
import { useContractsStore } from '@/stores/contracts'
import { useReconnect } from './useReconnect'
import { toast } from '@/components/Toast'
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
 * 只用时分秒，不用今天的日期，避免与历史数据日期不同导致排序错误。
 * @param periodMs 周期毫秒数，用于将时间戳向下取整到周期边界
 */
function snapshotToKline(snap: MarketSnapshot, periodMs: number): KLineData {
  const [h = 0, m = 0, s = 0] = (snap.updateTime ?? '00:00:00').split(':').map(Number)
  // 只用时分秒毫秒，构造从 epoch 起的偏移量（不含日期）
  const timeMs = ((h * 3600 + m * 60 + s) * 1000) + (snap.updateMillisec ?? 0)

  // 将时间戳向下取整到周期边界
  const timestamp = Math.floor(timeMs / periodMs) * periodMs

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

/**
 * WebSocket 行情推送 Hook
 * 连接 ws/market 端点，收到 market_data 消息时更新行情 store。
 * 内置断线重连（指数退避，最多 5 次）。
 *
 * 使用批量更新策略：将短时间内的多条消息缓冲，每 100ms 合并为一次状态更新，
 * 减少 React 重渲染次数（50 个合约从 50 次/秒降至 10 次/秒）。
 *
 * @param wsBaseUrl WebSocket 基础地址
 * @param period K 线周期（如 '1m', '5m', '1h'），影响实时 K 线的时间对齐
 */
export function useMarketWs(wsBaseUrl: string, period = '5m') {
  const wsRef = useRef<WSManager | null>(null)
  const snapshotBufferRef = useRef<MarketSnapshot[]>([])
  const klineBufferRef = useRef<Map<string, KLineData>>(new Map())
  const batchUpdate = useMarketStore((s) => s.batchUpdate)
  const appendKline = useMarketStore((s) => s.appendKline)
  const setMdPhase = useConnectionStore((s) => s.setMdPhase)

  // 创建 WSManager 实例（仅创建一次）
  if (!wsRef.current) {
    wsRef.current = new WSManager(wsBaseUrl)
  }

  const ws = wsRef.current
  const periodMs = PERIOD_MS[period] ?? PERIOD_MS['5m']

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
    if (message.type === 'market_data') {
      const snap = message.data as MarketSnapshot
      // 缓冲快照
      snapshotBufferRef.current.push(snap)
      // 缓冲 K 线（同一合约多次更新只保留最新）
      klineBufferRef.current.set(snap.instrumentID, snapshotToKline(snap, periodMs))
      // 收到行情数据说明 MD 已连接
      setMdPhase('connected')
    } else if (message.type === 'instruments_refreshed') {
      const data = message.data as { count: number }
      useContractsStore.getState().loadSubscribedContracts()
        .then(() => {
          if (data.count > 0) {
            toast.success(`已更新 ${data.count} 个合约`)
          }
        })
        .catch((err) => {
          console.warn('[useMarketWs] refresh instruments failed:', err)
        })
    }
  }

  // 使用 useReconnect 管理连接和重连
  const { reconnectCount, isReconnecting } = useReconnect(ws, 'market', handleMessage)

  // 组件卸载时断开所有连接
  useEffect(() => {
    return () => {
      ws.disconnectAll()
    }
  }, [ws])

  return { reconnectCount, isReconnecting }
}
