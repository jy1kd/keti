import { lazy, Suspense } from 'react'
import { useTabStore, type Tab } from '@/stores/tabs'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { FavoritesPage } from '@/pages/FavoritesPage'
import './styles.css'

// 懒加载其他页面组件（后续 PR 集成）
// const OrderPage = lazy(() => import('@/pages/OrderPage'))
// const QueryPage = lazy(() => import('@/pages/QueryPage'))
// const KLinePage = lazy(() => import('@/pages/KLinePage'))

/**
 * 为每个标签类型生成面板内容。
 *
 * market 类型已集成 MarketPanel；
 * 其他类型使用占位文本，后续 PR 会逐步替换为实际页面组件。
 */
function renderTabContent(tab: Tab): React.ReactNode {
  switch (tab.type) {
    case 'market':
      return <MarketPanel />
    case 'order':
      // TODO: PR-R14 报单标签页
      return <div className="tab-placeholder">📝 报单标签页（PR-R14）</div>
    case 'query':
      // TODO: PR-R15 查询标签页
      return <div className="tab-placeholder">📋 查询标签页（PR-R15）</div>
    case 'kline':
      // TODO: PR-R16 K线标签页
      return <div className="tab-placeholder">📈 K线标签页（PR-R16）</div>
    case 'favorites':
      return <FavoritesPage />
    case 'settings':
      // TODO: PR-R17 设置标签页
      return <div className="tab-placeholder">⚙ 设置标签页（PR-R17）</div>
    case 'options':
      return <div className="tab-placeholder">📉 期权标签页</div>
    case 'ipc-monitor':
      // TODO: PR-R18 IPC监控标签页
      return <div className="tab-placeholder">🔌 IPC监控标签页（PR-R18）</div>
    default:
      return <div className="tab-placeholder">未知标签</div>
  }
}

/**
 * TabContent — 标签内容容器
 *
 * 根据 activeTabId 显示对应标签面板，其他面板通过 CSS display:none 隐藏，
 * 保证切换标签时各面板状态不丢失。
 */
export function TabContent() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)

  return (
    <div className="tab-content">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            role="tabpanel"
            aria-labelledby={tab.id}
            aria-hidden={!isActive}
            className="tab-content__panel"
            style={{ display: isActive ? 'block' : 'none' }}
          >
            {renderTabContent(tab)}
          </div>
        )
      })}
    </div>
  )
}
