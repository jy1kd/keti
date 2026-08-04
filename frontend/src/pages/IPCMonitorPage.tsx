import { useState, useEffect, useRef, useCallback } from 'react'
import { isElectron } from '@/services/electron'
import './IPCMonitorPage.css'

interface IPCMessage {
  id: string
  timestamp: number
  direction: 'in' | 'out'
  channel: string
  data?: unknown
}

type FilterType = 'all' | 'market' | 'order' | 'system' | 'navigate'

const FILTER_LABELS: Record<FilterType, string> = {
  all: '全部',
  market: '行情',
  order: '报单',
  system: '系统',
  navigate: '导航',
}

function matchesFilter(channel: string, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'market') return channel.includes('market') || channel.includes('ws')
  if (filter === 'order') return channel.includes('order') || channel.includes('trade')
  if (filter === 'system') return channel.includes('system') || channel.includes('connection') || channel.includes('backend')
  if (filter === 'navigate') return channel.includes('navigate') || channel.includes('tab')
  return true
}

/**
 * IPCMonitorPage — IPC 监控标签页
 *
 * 用于调试 IPC 通信，支持消息过滤、暂停、清空、导出。
 */
export function IPCMonitorPage() {
  const [messages, setMessages] = useState<IPCMessage[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [paused, setPaused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const idCounterRef = useRef(0)

  // 模拟 IPC 消息（实际项目中应该从 Electron IPC 获取）
  useEffect(() => {
    if (!isElectron()) return

    // 这里应该监听实际的 IPC 消息
    // 目前使用模拟数据进行演示
    const mockMessages: IPCMessage[] = [
      { id: '1', timestamp: Date.now(), direction: 'in', channel: 'market:data', data: { instrumentID: 'IF2608', lastPrice: 4585.6 } },
      { id: '2', timestamp: Date.now() + 100, direction: 'out', channel: 'order:submit', data: { instrumentID: 'IF2608', direction: 'buy' } },
      { id: '3', timestamp: Date.now() + 200, direction: 'in', channel: 'system:status', data: { connected: true } },
    ]

    setMessages(mockMessages)
  }, [])

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
        <h2>🔌 IPC 监控</h2>
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
        </div>
      </div>

      <div className="ipc-monitor-page__content">
        <div className="ipc-monitor-page__list">
          {filteredMessages.length === 0 ? (
            <div className="ipc-monitor-page__empty">
              {isElectron() ? '暂无 IPC 消息' : 'IPC 监控仅在 Electron 环境下可用'}
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
