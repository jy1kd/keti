import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useMarketStore } from '@/modules/market/store'
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
 * @param periodMs 周期毫秒数，用于将时间戳向下取整到周期边界
 */
function snapshotToKline(snap: MarketSnapshot, periodMs: number): KLineData {
  const now = new Date()
  const [h = 0, m = 0, s = 0] = (snap.updateTime ?? '00:00:00').split(':').map(Number)
  now.setHours(h, m, s, snap.updateMillisec ?? 0)

  // 将时间戳向下取整到周期边界
  const timestamp = Math.floor(now.getTime() / periodMs) * periodMs

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

/**
 * WebSocket 行情推送 Hook
 * 连接 ws/market 端点，收到 market_data 消息时更新行情 store。
 * 内置断线重连（指数退避，最多 5 次）。
 *
 * @param wsBaseUrl WebSocket 基础地址
 * @param period K 线周期（如 '1m', '5m', '1h'），影响实时 K 线的时间对齐
 */
export function useMarketWs(wsBaseUrl: string, period = '5m') {
  const wsRef = useRef<WSManager | null>(null)
  const updateSnapshot = useMarketStore((s) => s.updateSnapshot)
  const appendKline = useMarketStore((s) => s.appendKline)

  // 创建 WSManager 实例（仅创建一次）
  if (!wsRef.current) {
    wsRef.current = new WSManager(wsBaseUrl)
  }

  const ws = wsRef.current
  const periodMs = PERIOD_MS[period] ?? PERIOD_MS['5m']

  // 消息处理回调
  const handleMessage = (message: WSMessage) => {
    if (message.type === 'market_data') {
      const snap = message.data as MarketSnapshot
      updateSnapshot(snap)
      appendKline(snap.instrumentID, snapshotToKline(snap, periodMs))
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
