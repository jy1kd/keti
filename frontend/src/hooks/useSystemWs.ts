import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useConnectionStore } from '@/stores/connection'
import { useReconnect } from './useReconnect'
import type { WSMessage } from '@/services/types'

/**
 * System WebSocket Hook
 *
 * 连接 /ws/system 端点，监听 connection_status 推送实现即时状态更新。
 * MD/TD 状态的权威来源是 GET /api/connection/status 的定期轮询
 *（见 useConnectionPoll）；WS 推送作为即时补充（延迟 <100ms）。
 *
 * 不再使用心跳超时 — 轮询本身就是心跳，且不会把 MD/TD 绑在一起。
 */
export function useSystemWs(wsBaseUrl: string) {
  const wsRef = useRef<WSManager | null>(null)
  const setMdPhase = useConnectionStore((s) => s.setMdPhase)
  const setTdPhase = useConnectionStore((s) => s.setTdPhase)

  if (!wsRef.current) {
    wsRef.current = new WSManager(wsBaseUrl)
  }
  const ws = wsRef.current

  const handleMessage = (message: WSMessage) => {
    if (message.type === 'connection_status') {
      const data = message.data as {
        mdConnected?: boolean
        tdConnected?: boolean
        reason?: number
      }

      // MD 状态即时更新
      if (data.mdConnected !== undefined) {
        setMdPhase(data.mdConnected ? 'connected' : 'disconnected')
      }

      // TD 状态即时更新
      if (data.tdConnected !== undefined) {
        setTdPhase(data.tdConnected ? 'connected' : 'disconnected')
      }
    }
    // instruments_refreshed 已由 useMarketWs 统一处理，此处不再重复
  }

  const { reconnectCount } = useReconnect(ws, 'system', handleMessage)

  // 不再无条件设置 connecting 状态 — 避免重载时闪烁
  // 连接状态由 connection_status WS 消息或轮询决定

  // 清理
  useEffect(() => {
    return () => {
      ws.disconnectAll()
    }
  }, [ws])

  return { reconnectCount }
}
