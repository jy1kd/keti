import { useConnectionStore } from '@/stores/connection'
import './styles.css'

export function ConnectionStatus() {
  const { mdConnected, tdConnected } = useConnectionStore()

  return (
    <div className="connection-status">
      <div className="connection-item">
        <span className="label">MD</span>
        <span
          data-testid="md-indicator"
          className={`indicator ${mdConnected ? 'connected' : 'disconnected'}`}
        />
      </div>
      <div className="connection-item">
        <span className="label">TD</span>
        <span
          data-testid="td-indicator"
          className={`indicator ${tdConnected ? 'connected' : 'disconnected'}`}
        />
      </div>
    </div>
  )
}
