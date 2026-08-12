import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSManager, WSEndpoint } from '@/services/ws'
import type { WSMessage } from '@/services/types'

type MessageHandler = (message: WSMessage) => void

/** 最大重试次数 */
const MAX_RETRIES = 5
/** 基础延迟 (ms) */
const BASE_DELAY = 1000

/**
 * WebSocket 断线重连 Hook
 * 指数退避：1s → 2s → 4s → 8s → 16s，最多 5 次。
 *
 * @param ws WSManager 实例
 * @param endpoint 要重连的端点
 * @param onMessage 消息回调（重连时重新注册）
 */
export function useReconnect(
  ws: WSManager,
  endpoint: WSEndpoint,
  onMessage?: MessageHandler,
) {
  const [reconnectCount, setReconnectCount] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const retryCountRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const scheduleReconnect = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      setIsReconnecting(false)
      return
    }

    setIsReconnecting(true)
    const delay = BASE_DELAY * Math.pow(2, retryCountRef.current)
    retryCountRef.current++
    setReconnectCount(retryCountRef.current)

    const timer = setTimeout(() => {
      if (ws.isConnected(endpoint)) {
        setIsReconnecting(false)
        return
      }
      ws.connect(endpoint, onMessageRef.current as MessageHandler)
    }, delay)

    timersRef.current.push(timer)
  }, [ws, endpoint])

  useEffect(() => {
    // 初始连接
    ws.connect(endpoint, onMessageRef.current as MessageHandler)

    // 连接建立成功 → 重置重试计数。
    // 否则每次断线都永久消耗一个名额，断线满 5 次（MAX_RETRIES）后
    // scheduleReconnect 直接放弃，行情/系统 WS 在整个应用生命周期内不再重连。
    ws.onOpen(endpoint, () => {
      retryCountRef.current = 0
      setIsReconnecting(false)
    })

    // 注册关闭回调 — 连接断开时触发重连
    ws.onClose(endpoint, () => {
      // 无论 retryCountRef 当前值如何，都应尝试重连
      // 之前的条件 `retryCountRef.current === 0` 导致第一次重连失败后永久中断
      scheduleReconnect()
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      retryCountRef.current = 0
      setIsReconnecting(false)
    }
  }, [ws, endpoint, scheduleReconnect])

  return { reconnectCount, isReconnecting }
}
