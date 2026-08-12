import { useEffect, useRef } from 'react'
import { useConnectionStore } from '@/stores/connection'
import { getConnectionStatus } from '@/services/api'
import { getTradingSessionStatus } from '@/utils/tradingSession'

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
  /** 已打印过的前置地址（去重） */
  const lastMdFrontRef = useRef<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const status = await getConnectionStatus()
        setMdPhase(status.mdConnected ? 'connected' : 'disconnected')
        setTdPhase(status.tdConnected ? 'connected' : 'disconnected')
        // 打印实际连接的 CTP 行情前置（区分标准仿真 30011 / 7x24 40011），
        // 仅首次与变化时打印，避免每 10s 刷屏
        if (status.mdFront && status.mdFront !== lastMdFrontRef.current) {
          lastMdFrontRef.current = status.mdFront
          // 末尾标注当前是否在交易时段（与后端 start.py 判定一致，便于区分
          // “已连但非交易时段无行情”属正常）
          console.info(
            `[CTP 行情前置] ${status.mdFront}${status.mdConnected ? ' (connected)' : ' (disconnected)'} [${getTradingSessionStatus()}]`,
          )
        }
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
