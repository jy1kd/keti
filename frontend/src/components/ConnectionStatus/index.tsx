import { useConnectionStore } from '@/stores/connection'
import './styles.css'

export function ConnectionStatus() {
  const { mdConnected, tdConnected } = useConnectionStore()

  return (
    <div className="connection-status" role="status" aria-label="连接状态">
      <div className="connection-item">
        <span className="label">MD</span>
        <span
          data-testid="md-indicator"
          className={`indicator ${mdConnected ? 'connected' : 'disconnected'}`}
          aria-label={`行情${mdConnected ? '已连接' : '未连接'}`}
        />
      </div>
      <div className="connection-item">
        <span className="label">TD</span>
        <span
          data-testid="td-indicator"
          className={`indicator ${tdConnected ? 'connected' : 'disconnected'}`}
          aria-label={`交易${tdConnected ? '已连接' : '未连接'}`}
        />
      </div>
    </div>
  )
}
