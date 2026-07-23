import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useConnectionStore } from '@/stores/connection'
import { useContractsStore } from '@/stores/contracts'
import { useReconnect } from './useReconnect'
import { toast } from '@/components/Toast'
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
    } else if (message.type === 'instruments_refreshed') {
      const data = message.data as { count: number }
      useContractsStore.getState().loadSubscribedContracts()
        .then(() => {
          if (data.count > 0) {
            toast.success(`已更新 ${data.count} 个合约`)
          }
          // 通知监听者 CTP 刷新完成
          window.dispatchEvent(new CustomEvent('instruments_refreshed', { detail: { count: data.count } }))
        })
        .catch((err) => {
          console.warn('[useSystemWs] refresh instruments failed:', err)
        })
    } else if (message.type === 'ping') {
      // 心跳 — 无需处理
    }
  }

  const { reconnectCount } = useReconnect(ws, 'system', handleMessage)

  // 同步重连计数到 store
  useEffect(() => {
    useConnectionStore.getState().setMdReconnectCount(reconnectCount)
    useConnectionStore.getState().setTdReconnectCount(reconnectCount)
  }, [reconnectCount])

  // 连接时标记为 connecting
  useEffect(() => {
    setMdPhase('connecting')
    setTdPhase('connecting')
  }, [setMdPhase, setTdPhase])

  // 清理
  useEffect(() => {
    return () => {
      ws.disconnectAll()
    }
  }, [ws])

  return { reconnectCount }
}
