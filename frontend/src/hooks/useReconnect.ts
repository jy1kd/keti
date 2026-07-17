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
        retryCountRef.current = 0
        return
      }
      ws.connect(endpoint, onMessageRef.current as MessageHandler)
      // 连接后等待 onclose 事件触发下一次重连
    }, delay)

    timersRef.current.push(timer)
  }, [ws, endpoint])

  useEffect(() => {
    // 初始连接
    ws.connect(endpoint, onMessageRef.current as MessageHandler)

    // 监听连接断开事件（通过轮询检测）
    const checkInterval = setInterval(() => {
      if (!ws.isConnected(endpoint) && retryCountRef.current === 0) {
        scheduleReconnect()
      }
    }, 1000)

    return () => {
      clearInterval(checkInterval)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      retryCountRef.current = 0
      setIsReconnecting(false)
    }
  }, [ws, endpoint, scheduleReconnect])

  return { reconnectCount, isReconnecting }
}
