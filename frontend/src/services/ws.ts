import type { WSMessage } from './types'

export type WSEndpoint = 'market' | 'order' | 'position' | 'stop' | 'system'

type MessageCallback = (message: WSMessage) => void

export class WSManager {
  private baseUrl: string
  private connections: Map<string, WebSocket> = new Map()
  private callbacks: Map<string, MessageCallback> = new Map()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * 建立指定端点的 WebSocket 连接
   */
  connect(endpoint: WSEndpoint, onMessage?: MessageCallback): void {
    // 若已存在同端点连接，先关闭
    if (this.connections.has(endpoint)) {
      this.connections.get(endpoint)?.close()
      this.connections.delete(endpoint)
    }

    const url = `${this.baseUrl}/ws/${endpoint}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      // 连接就绪
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        const cb = this.callbacks.get(endpoint)
        if (cb) cb(message)
      } catch {
        console.error('[WS] 消息解析失败:', event.data)
      }
    }

    ws.onerror = () => {
      console.error(`[WS] ${endpoint} 连接错误`)
    }

    this.connections.set(endpoint, ws)
    if (onMessage) {
      this.callbacks.set(endpoint, onMessage)
    }
  }

  /**
   * 断开指定端点
   */
  disconnect(endpoint: WSEndpoint): void {
    const ws = this.connections.get(endpoint)
    if (ws) {
      ws.close()
      this.connections.delete(endpoint)
      this.callbacks.delete(endpoint)
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    for (const endpoint of this.connections.keys()) {
      this.disconnect(endpoint as WSEndpoint)
    }
  }

  /**
   * 检查指定端点是否已连接
   */
  isConnected(endpoint: WSEndpoint): boolean {
    const ws = this.connections.get(endpoint)
    return ws != null && ws.readyState === WebSocket.OPEN
  }

  /**
   * 发送消息
   */
  send(endpoint: WSEndpoint, data: unknown): void {
    const ws = this.connections.get(endpoint)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }
}
