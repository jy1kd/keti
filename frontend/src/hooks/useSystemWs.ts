import { useEffect, useRef } from 'react'
import { useConnectionStore } from '../stores/connection'
import type { WSMessage } from '../services/types'

/**
 * System WebSocket hook — listens for connection_status messages
 * and updates the connection store.
 *
 * PRD F4.3: 连接状态推送
 */
export function useSystemWs() {
  const setMdConnected = useConnectionStore((s) => s.setMdConnected)
  const setTdConnected = useConnectionStore((s) => s.setTdConnected)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'connection_status') {
          const data = msg.data as { mdConnected?: boolean; tdConnected?: boolean }
          if (data.mdConnected !== undefined) {
            setMdConnected(data.mdConnected)
          }
          if (data.tdConnected !== undefined) {
            setTdConnected(data.tdConnected)
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      // Connection error — mark as disconnected
      setMdConnected(false)
      setTdConnected(false)
    }

    ws.onclose = () => {
      // Connection closed — mark as disconnected
      setMdConnected(false)
      setTdConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [setMdConnected, setTdConnected])

  return wsRef
}
