import { useConnectionStore, type ConnectionState } from '@/stores/connection'
import './styles.css'

/** 状态 → 中文标签 */
const PHASE_LABEL: Record<string, string> = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  error: '连接错误',
}

/** 状态 → CSS 类名 */
const PHASE_CLASS: Record<string, string> = {
  disconnected: 'disconnected',
  connecting: 'connecting',
  connected: 'connected',
  error: 'error',
}

function formatTime(ts: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function buildTooltip(label: string, state: ConnectionState): string {
  const lines = [
    `${label} — ${PHASE_LABEL[state.phase] ?? state.phase}`,
    `上次连接: ${formatTime(state.lastConnectedAt)}`,
    `上次断开: ${formatTime(state.lastDisconnectedAt)}`,
  ]
  if (state.reconnectCount > 0) {
    lines.push(`重连次数: ${state.reconnectCount}`)
  }
  if (state.error) {
    lines.push(`错误: ${state.error}`)
  }
  return lines.join('\n')
}

export function ConnectionStatus() {
  const { md, td } = useConnectionStore()

  return (
    <div className="connection-status" role="status" aria-label="连接状态">
      <div className="connection-item" title={buildTooltip('行情', md)}>
        <span className="label">MD</span>
        <span
          data-testid="md-indicator"
          className={`indicator ${PHASE_CLASS[md.phase] ?? 'disconnected'}`}
          aria-label={`行情${PHASE_LABEL[md.phase] ?? '未连接'}`}
        />
      </div>
      <div className="connection-item" title={buildTooltip('交易', td)}>
        <span className="label">TD</span>
        <span
          data-testid="td-indicator"
          className={`indicator ${PHASE_CLASS[td.phase] ?? 'disconnected'}`}
          aria-label={`交易${PHASE_LABEL[td.phase] ?? '未连接'}`}
        />
      </div>
    </div>
  )
}
