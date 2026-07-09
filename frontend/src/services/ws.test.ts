import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WSManager } from './ws'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  readyState = 1 // OPEN
  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close() {
    this.readyState = 3
  }

  send(_data: string) {}
}

describe('WSManager', () => {
  let manager: WSManager
  const origWebSocket = globalThis.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    manager = new WSManager('ws://localhost:8000')
  })

  afterEach(() => {
    globalThis.WebSocket = origWebSocket
    manager.disconnectAll()
  })

  it('创建时无活跃连接', () => {
    expect(manager.isConnected('market')).toBe(false)
    expect(manager.isConnected('order')).toBe(false)
  })

  it('connect 建立指定端点的 WebSocket 连接', () => {
    manager.connect('market')
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8000/ws/market')
  })

  it('connect 后触发 onopen，isConnected 返回 true', () => {
    manager.connect('market')
    MockWebSocket.instances[0].onopen?.()
    expect(manager.isConnected('market')).toBe(true)
  })

  it('onmessage 解析 JSON 并调用回调', () => {
    const callback = vi.fn()
    manager.connect('market', callback)
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ type: 'market_data', data: { instrument_id: 'au2406' } }),
    })
    expect(callback).toHaveBeenCalledWith({ type: 'market_data', data: { instrument_id: 'au2406' } })
  })

  it('disconnect 关闭指定端点的连接', () => {
    manager.connect('market')
    manager.disconnect('market')
    expect(manager.isConnected('market')).toBe(false)
  })

  it('disconnectAll 关闭所有连接', () => {
    manager.connect('market')
    manager.connect('order')
    manager.disconnectAll()
    expect(manager.isConnected('market')).toBe(false)
    expect(manager.isConnected('order')).toBe(false)
  })

  it('connect 同一端点两次，先关闭旧连接再建立新连接', () => {
    manager.connect('market')
    manager.connect('market')
    // 旧连接被关闭，新连接建立
    expect(MockWebSocket.instances).toHaveLength(2)
    expect(MockWebSocket.instances[0].readyState).toBe(3) // CLOSED
  })
})
