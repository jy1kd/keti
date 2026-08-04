import { useState, useEffect, useRef, useCallback } from 'react'
import './IPCMonitorPage.css'

interface MonitorMessage {
  id: string
  timestamp: number
  direction: 'in' | 'out'
  channel: string
  data?: unknown
}

type FilterType = 'all' | 'market' | 'order' | 'system' | 'navigate' | 'api'

const FILTER_LABELS: Record<FilterType, string> = {
  all: '全部',
  market: '行情',
  order: '报单',
  system: '系统',
  navigate: '导航',
  api: 'API',
}

function matchesFilter(channel: string, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'market') return channel.includes('market') || channel.includes('ws/market')
  if (filter === 'order') return channel.includes('order') || channel.includes('trade')
  if (filter === 'system') return channel.includes('system') || channel.includes('connection') || channel.includes('backend') || channel.includes('ws/system')
  if (filter === 'navigate') return channel.includes('navigate') || channel.includes('tab')
  if (filter === 'api') return channel.startsWith('api/')
  return true
}

// 全局消息存储（跨组件共享）
let globalMessages: MonitorMessage[] = []
let globalListeners: Set<(msg: MonitorMessage) => void> = new Set()
let idCounter = 0

function addMessage(msg: Omit<MonitorMessage, 'id'>) {
  const message: MonitorMessage = { ...msg, id: String(++idCounter) }
  globalMessages = [...globalMessages.slice(-999), message] // 保留最近 1000 条
  globalListeners.forEach((listener) => listener(message))
}

// 拦截 WebSocket 消息（仅监听，不修改原始行为）
function setupWebSocketInterceptor() {
  const originalWebSocket = window.WebSocket

  // 使用 Proxy 代理 WebSocket 构造函数
  const handler: ProxyHandler<typeof originalWebSocket> = {
    construct(target, args) {
      const ws = new target(...args)
      const url = args[0]
      const urlStr = typeof url === 'string' ? url : url.toString()

      let channel = 'ws/unknown'
      if (urlStr.includes('/ws/market')) channel = 'ws/market'
      else if (urlStr.includes('/ws/system')) channel = 'ws/system'
      else if (urlStr.includes('/ws/order')) channel = 'ws/order'
      else if (urlStr.includes('/ws/position')) channel = 'ws/position'

      // 监听消息（不修改原始行为）
      ws.addEventListener('message', (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          addMessage({ timestamp: Date.now(), direction: 'in', channel, data })
        } catch {
          addMessage({ timestamp: Date.now(), direction: 'in', channel, data: event.data })
        }
      })

      // 拦截 send 方法
      const originalSend = ws.send.bind(ws)
      ws.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data
          addMessage({ timestamp: Date.now(), direction: 'out', channel, data: parsed })
        } catch {
          addMessage({ timestamp: Date.now(), direction: 'out', channel, data })
        }
        return originalSend(data)
      }

      return ws
    },
  }

  // 使用 try-catch 处理可能的只读属性错误
  try {
    window.WebSocket = new Proxy(originalWebSocket, handler)
  } catch (e) {
    console.warn('[IPC Monitor] Failed to intercept WebSocket:', e)
  }
}

// 拦截 fetch API
function setupFetchInterceptor() {
  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method || 'GET'
    const startTime = Date.now()

    // 记录请求
    addMessage({
      timestamp: startTime,
      direction: 'out',
      channel: `api/${method}`,
      data: { url, method, body: init?.body },
    })

    try {
      const response = await originalFetch(input, init)
      const endTime = Date.now()

      // 记录响应
      addMessage({
        timestamp: endTime,
        direction: 'in',
        channel: `api/${method}`,
        data: { url, status: response.status, duration: endTime - startTime },
      })

      return response
    } catch (error) {
      const endTime = Date.now()
      addMessage({
        timestamp: endTime,
        direction: 'in',
        channel: `api/${method}`,
        data: { url, error: String(error), duration: endTime - startTime },
      })
      throw error
    }
  }
}

// 初始化拦截器（立即执行，确保在 WebSocket 连接之前）
let interceptorInitialized = false
function initInterceptors() {
  if (interceptorInitialized) return
  interceptorInitialized = true
  setupWebSocketInterceptor()
  setupFetchInterceptor()
}

// 立即初始化拦截器（模块加载时执行）
initInterceptors()

/**
 * IPCMonitorPage — 网络监控标签页
 *
 * 用于调试网络通信，支持消息过滤、暂停、清空、导出。
 * 拦截 WebSocket 和 API 请求，显示通信数据。
 */
export function IPCMonitorPage() {
  const [messages, setMessages] = useState<MonitorMessage[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [paused, setPaused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 统一使用 WebSocket + fetch 拦截器（Web 和 Electron 渲染进程行为一致）
    initInterceptors()

    // 加载已有消息
    setMessages([...globalMessages])

    // 监听新消息
    const listener = (msg: MonitorMessage) => {
      if (!paused) {
        setMessages((prev) => [...prev, msg])
      }
    }
    globalListeners.add(listener)

    return () => {
      globalListeners.delete(listener)
    }
  }, [paused])

  // 自动滚动到底部
  useEffect(() => {
    if (!paused && messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, paused])

  // 过滤消息
  const filteredMessages = messages.filter((msg) => matchesFilter(msg.channel, filter))

  // 清空消息
  const handleClear = useCallback(() => {
    globalMessages = []
    setMessages([])
    setSelectedId(null)
  }, [])

  // 导出消息
  const handleExport = useCallback(() => {
    const data = JSON.stringify(filteredMessages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ipc-messages-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredMessages])

  // 选中的消息
  const selectedMessage = selectedId ? messages.find((m) => m.id === selectedId) : null

  return (
    <div className="ipc-monitor-page">
      <div className="ipc-monitor-page__header">
        <h2>📡 网络监控</h2>
        <div className="ipc-monitor-page__controls">
          <div className="ipc-monitor-page__filters">
            {(Object.entries(FILTER_LABELS) as [FilterType, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-btn ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ipc-monitor-page__actions">
            <button
              type="button"
              className={`action-btn ${paused ? 'paused' : ''}`}
              onClick={() => setPaused(!paused)}
            >
              {paused ? '▶ 继续' : '⏸ 暂停'}
            </button>
            <button type="button" className="action-btn" onClick={handleClear}>
              🗑 清空
            </button>
            <button type="button" className="action-btn" onClick={handleExport}>
              📥 导出
            </button>
          </div>
        </div>
        <div className="ipc-monitor-page__stats">
          共 {filteredMessages.length} 条消息
          <span className="ipc-monitor-page__mode">
            （WebSocket + API）
          </span>
        </div>
      </div>

      <div className="ipc-monitor-page__content">
        <div className="ipc-monitor-page__list">
          {filteredMessages.length === 0 ? (
            <div className="ipc-monitor-page__empty">
              暂无消息，等待 WebSocket 连接或 API 请求...
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`ipc-message ${selectedId === msg.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(msg.id)}
              >
                <span className={`ipc-message__direction ${msg.direction}`}>
                  {msg.direction === 'in' ? '←' : '→'}
                </span>
                <span className="ipc-message__channel">{msg.channel}</span>
                <span className="ipc-message__time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <span className="ipc-message__preview">
                  {msg.data ? JSON.stringify(msg.data).slice(0, 50) : '—'}
                </span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedMessage && (
          <div className="ipc-monitor-page__detail">
            <h3>消息详情</h3>
            <div className="detail-row">
              <span className="detail-label">方向：</span>
              <span className={`detail-value ${selectedMessage.direction}`}>
                {selectedMessage.direction === 'in' ? '接收 ←' : '发送 →'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">通道：</span>
              <span className="detail-value">{selectedMessage.channel}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">时间：</span>
              <span className="detail-value">
                {new Date(selectedMessage.timestamp).toLocaleString()}
              </span>
            </div>
            {selectedMessage.data && (
              <div className="detail-row">
                <span className="detail-label">数据：</span>
                <pre className="detail-value detail-data">
                  {JSON.stringify(selectedMessage.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
