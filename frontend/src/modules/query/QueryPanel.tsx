import { useQueryStore } from './store'
import './styles.css'

const TABS = [
  { key: 'orders' as const, label: '报单' },
  { key: 'trades' as const, label: '成交' },
  { key: 'positions' as const, label: '持仓' },
  { key: 'account' as const, label: '资金' },
]

export function QueryPanel() {
  const { activeTab, setActiveTab } = useQueryStore()

  return (
    <section className="query-panel">
      <div className="panel-header">
        <h2>查询面板</h2>
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
      </div>
      <div className="panel-content">
        {/* 查询内容将在 PR-16 实现 */}
      </div>
    </section>
  )
}
