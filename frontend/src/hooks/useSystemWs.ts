import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useConnectionStore } from '@/stores/connection'
import { useContractsStore } from '@/stores/contracts'
import { useReconnect } from './useReconnect'
import { toast } from '@/components/Toast'
import type { WSMessage } from '@/services/types'

/** 心跳超时（毫秒）— 后端每 5s 推送一次，超过 15s 未收到视为断线 */
const HEARTBEAT_TIMEOUT_MS = 15_000

/**
 * System WebSocket Hook
 * 连接 ws/system 端点，监听 connection_status 消息更新连接状态。
 * 内置断线重连（指数退避，最多 5 次）+ 心跳超时检测。
 */
export function useSystemWs(wsBaseUrl: string) {
  const wsRef = useRef<WSManager | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setMdPhase = useConnectionStore((s) => s.setMdPhase)
  const setTdPhase = useConnectionStore((s) => s.setTdPhase)

  if (!wsRef.current) {
    wsRef.current = new WSManager(wsBaseUrl)
  }
  const ws = wsRef.current

  // 重置心跳定时器
  const resetHeartbeat = () => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setTimeout(() => {
      // 超时未收到消息 → 标记为断线
      setMdPhase('disconnected')
      setTdPhase('disconnected')
    }, HEARTBEAT_TIMEOUT_MS)
  }

  const handleMessage = (message: WSMessage) => {
    // 任何消息都重置心跳（后端定期推送 connection_status 或 ping）
    resetHeartbeat()

    if (message.type === 'connection_status') {
      const data = message.data as {
        mdConnected?: boolean
        tdConnected?: boolean
        status?: string
        reason?: number
      }

      // 处理 MD 状态
      if (data.mdConnected !== undefined) {
        setMdPhase(data.mdConnected ? 'connected' : 'disconnected')
      }

      // 处理 TD 状态
      if (data.tdConnected !== undefined) {
        setTdPhase(data.tdConnected ? 'connected' : 'disconnected')
      }

      // 处理通用断线事件
      if (data.status === 'disconnected') {
        setMdPhase('disconnected', `断线原因: ${data.reason}`)
        setTdPhase('disconnected', `断线原因: ${data.reason}`)
      }
    } else if (message.type === 'instruments_refreshed') {
      const data = message.data as { count: number }
      useContractsStore.getState().loadSubscribedContracts()
        .then(() => {
          if (data.count > 0) {
            toast.success(`已更新 ${data.count} 个合约`)
          }
        })
        .catch((err) => {
          console.warn('[useSystemWs] refresh instruments failed:', err)
        })
    } else if (message.type === 'ping') {
      // 心跳响应 — 心跳定时器已在上面重置
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
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current)
      ws.disconnectAll()
    }
  }, [ws])

  return { reconnectCount }
}
