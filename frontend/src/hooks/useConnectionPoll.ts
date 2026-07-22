import { useEffect, useRef } from 'react'
import { useConnectionStore } from '@/stores/connection'
import { getConnectionStatus } from '@/services/api'

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 10_000

/**
 * 定期轮询 GET /api/connection/status，作为连接状态的权威来源。
 *
 * WebSocket 推送提供即时更新（<100ms），轮询作为兜底确保：
 * - MD/TD 状态独立（不会因心跳超时把两者绑在一起）
 * - WS 漏推或断连后状态不丢失
 * - 后端 silent 时前端仍能感知真实状态
 */
export function useConnectionPoll() {
  const setMdPhase = useConnectionStore((s) => s.setMdPhase)
  const setTdPhase = useConnectionStore((s) => s.setTdPhase)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const status = await getConnectionStatus()
        setMdPhase(status.mdConnected ? 'connected' : 'disconnected')
        setTdPhase(status.tdConnected ? 'connected' : 'disconnected')
      } catch {
        // 网络错误 → 忽略，下一轮轮询会重试
        // 不在此处设为 disconnected，以免临时网络波动误报
      }
    }

    // 首次立即查询，之后定时轮询
    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [setMdPhase, setTdPhase])
}
