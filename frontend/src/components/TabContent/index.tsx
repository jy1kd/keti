import { useTabStore, type Tab } from '@/stores/tabs'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { OrderPage } from '@/pages/OrderPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { IPCMonitorPage } from '@/pages/IPCMonitorPage'
import './styles.css'

/**
 * 安全地从 tab.props 中提取 instrumentID 字符串。
 * 使用运行时类型守卫，避免 `as string` 断言掩藏非字符串值传入的 bug。
 */
function getInstrumentID(props: Record<string, unknown>): string | undefined {
  return typeof props.instrumentID === 'string' ? props.instrumentID : undefined
}

/**
 * 为每个标签类型生成面板内容。
 *
 * market 类型已集成 MarketPanel；
 * order 类型已集成 OrderPage；
 * 其他类型使用占位文本，后续 PR 会逐步替换为实际页面组件。
 * （query 自重构后为悬浮弹窗形态，见 QueryPopup，不再是标签页。）
 */
function renderTabContent(tab: Tab): React.ReactNode {
  switch (tab.type) {
    case 'market':
      return <MarketPanel />
    case 'order':
      return <OrderPage instrumentID={getInstrumentID(tab.props)} />
    case 'kline':
      // TODO: PR-R16 K线标签页
      return <div className="tab-placeholder">📈 K线标签页（PR-R16）</div>
    case 'favorites':
      return <FavoritesPage />
    case 'settings':
      return <SettingsPage />
    case 'options':
      return <div className="tab-placeholder">📉 期权标签页</div>
    case 'ipc-monitor':
      return <IPCMonitorPage />
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
