import { useEffect, useRef } from 'react'
import { WSManager } from '@/services/ws'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot, WSMessage } from '@/services/types'

/**
 * WebSocket 行情推送 Hook
 * 连接 ws/market 端点，收到 market_data 消息时更新行情 store。
 */
export function useMarketWs(wsBaseUrl: string) {
  const wsRef = useRef<WSManager | null>(null)
  const updateSnapshot = useMarketStore((s) => s.updateSnapshot)

  useEffect(() => {
    const ws = new WSManager(wsBaseUrl)
    wsRef.current = ws

    ws.connect('market', (message: WSMessage) => {
      if (message.type === 'market_data') {
        updateSnapshot(message.data as MarketSnapshot)
      }
    })

    return () => {
      ws.disconnectAll()
    }
  }, [wsBaseUrl, updateSnapshot])
}
