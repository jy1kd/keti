import { useEffect } from 'react'
import { useQueryStore } from './store'
import { TradeFlow } from './TradeFlow'
import { AccountQuery } from './AccountQuery'
import { StopOrderList } from './StopOrderList'
import './styles.css'

const TABS = [
  { key: 'trades' as const, label: '成交' },
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

  const renderContent = () => {
    switch (activeTab) {
      case 'trades':
        return <TradeFlow />
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
