import type { WSMessage } from './types'

export type WSEndpoint = 'market' | 'order' | 'position' | 'stop' | 'system'

type MessageCallback = (message: WSMessage) => void

type CloseCallback = (event: CloseEvent) => void

export class WSManager {
  private baseUrl: string
  private connections: Map<string, WebSocket> = new Map()
  private callbacks: Map<string, MessageCallback> = new Map()
  private closeCallbacks: Map<string, CloseCallback> = new Map()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * 建立指定端点的 WebSocket 连接
   */
  connect(endpoint: WSEndpoint, onMessage?: MessageCallback): void {
    // 若已存在同端点连接，先关闭
    if (this.connections.has(endpoint)) {
      const old = this.connections.get(endpoint)
      if (old) {
        // 移除旧回调防止旧连接触发消息和关闭事件
        old.onmessage = null
        old.onclose = null
        old.onerror = null
        old.close()
      }
      this.connections.delete(endpoint)
    }

    const url = `${this.baseUrl}/ws/${endpoint}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)

        // 服务端 heartbeat ping → 自动回复 pong，不传给业务回调
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        const cb = this.callbacks.get(endpoint)
        if (cb) cb(message)
      } catch {
        console.error('[WS] 消息解析失败:', event.data)
      }
    }

    ws.onopen = () => {
      console.log(`[WS] ${endpoint} connected`)
    }

    ws.onclose = (event) => {
      console.log(`[WS] ${endpoint} closed (code=${event.code})`)
      const closeCb = this.closeCallbacks.get(endpoint)
      if (closeCb) closeCb(event)
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
   * 注册连接关闭回调（用于重连）
   */
  onClose(endpoint: WSEndpoint, callback: CloseCallback): void {
    this.closeCallbacks.set(endpoint, callback)
  }

  /**
   * 断开指定端点
   */
  disconnect(endpoint: WSEndpoint): void {
    const ws = this.connections.get(endpoint)
    if (ws) {
      // 清除所有回调，防止关闭过程中触发旧消息
      ws.onmessage = null
      ws.onerror = null
      ws.onopen = null
      ws.onclose = null
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      // CONNECTING 状态不调用 close()（浏览器会报 "closed before established"）
      // 清除回调后它会自然超时关闭，不会触发任何业务逻辑
      this.connections.delete(endpoint)
      this.callbacks.delete(endpoint)
      this.closeCallbacks.delete(endpoint)
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
