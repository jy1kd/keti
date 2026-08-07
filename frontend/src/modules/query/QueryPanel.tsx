import { useEffect, useCallback } from 'react'
import { useQueryStore } from './store'
import { OrderFlow } from './OrderFlow'
import { TradeFlow } from './TradeFlow'
import { Position } from './Position'
import { AccountQuery } from './AccountQuery'
import { StopOrderList } from './StopOrderList'
import './styles.css'

const TABS = [
  { key: 'orders' as const, label: '报单' },
  { key: 'trades' as const, label: '成交' },
  { key: 'positions' as const, label: '持仓' },
  { key: 'account' as const, label: '资金' },
  { key: 'stop_orders' as const, label: '止损单' },
]

export function QueryPanel() {
  const activeTab = useQueryStore((s) => s.activeTab)
  const setActiveTab = useQueryStore((s) => s.setActiveTab)
  const isPaused = useQueryStore((s) => s.isPaused)
  const isLoading = useQueryStore((s) => s.isLoading)
  const togglePause = useQueryStore((s) => s.togglePause)
  const refreshAll = useQueryStore((s) => s.refreshAll)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)

  // Initial data load
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Auto-refresh: 完成后再调度下一次，避免重入
  useEffect(() => {
    if (isPaused) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(async () => {
        await refreshAll()
        schedule()
      }, 10000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [isPaused, refreshAll])

  // 注意：WebSocket 行情推送由 MarketPanel 中的 useMarketWs 单例管理

  // C key shortcut — cancel all active orders (when orders tab is active)
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        // Ignore if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        if (activeTab === 'orders') {
          handleCancelAll()
        }
      }
    },
    [activeTab, handleCancelAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrderFlow />
      case 'trades':
        return <TradeFlow />
      case 'positions':
        return <Position />
      case 'account':
        return <AccountQuery />
      case 'stop_orders':
        return <StopOrderList />
      default:
        return null
    }
  }

  return (
    <section className="query-panel" data-testid="query-panel">
      <div className="panel-header" data-drag-handle>
        <div className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="panel-controls">
          <button
            className={`btn-pause ${isPaused ? 'paused' : ''}`}
            onClick={togglePause}
          >
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            className="btn-refresh"
            onClick={() => refreshAll()}
            disabled={isLoading || isPaused}
          >
            {isLoading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>
      <div className="panel-content">
        {renderContent()}
      </div>
    </section>
  )
}
