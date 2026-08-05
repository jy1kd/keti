import { useTabStore, type Tab } from '@/stores/tabs'
import { useFloatingWindowStore, FLOATING_CHROME_H } from '@/stores/floatingWindows'
import { startDetachDrag, detachTabAt } from '@/utils/detachDrag'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { QueryPanel } from '@/modules/query/QueryPanel'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { OrderPage } from '@/pages/OrderPage'
import { KLinePage } from '@/pages/KLinePage'
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
 * kline 类型已集成 KLinePage；
 * query 类型已集成 QueryPanel（全局账户查询，放大自 QueryPopup）；
 * 其他类型使用占位文本，后续 PR 会逐步替换为实际页面组件。
 */
function renderTabContent(tab: Tab): React.ReactNode {
  switch (tab.type) {
    case 'market':
      return <MarketPanel />
    case 'order':
      return <OrderPage instrumentID={getInstrumentID(tab.props)} />
    case 'kline':
      return <KLinePage instrumentID={getInstrumentID(tab.props)} />
    case 'favorites':
      return <FavoritesPage />
    case 'query':
      return <QueryPanel />
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
  const windows = useFloatingWindowStore((s) => s.windows)

  return (
    <div className="tab-content">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const floating = windows[tab.id]
        return (
          <div
            key={tab.id}
            role="tabpanel"
            aria-labelledby={tab.id}
            aria-hidden={floating ? false : !isActive}
            className={`tab-content__panel${floating ? ' tab-content__panel--floating' : ''}`}
            onPointerDown={(e) => {
              if (floating) {
                useFloatingWindowStore.getState().focus(tab.id)
                return
              }
              if (!tab.closable) return
              if (e.button !== 0) return
              const target = e.target as HTMLElement
              if (target.closest('button, input, select, a, [data-no-drag]')) return
              if (!target.closest('[data-drag-handle]')) return
              startDetachDrag({
                event: e.nativeEvent,
                sourceEl: e.currentTarget,
                canDetach: () => tab.closable,
                ghostKind: 'content',
                getContentNode: () => e.currentTarget,
                onDetach: (pos) => detachTabAt(tab.id, pos),
              })
            }}
            style={{
              display: floating ? 'block' : isActive ? 'block' : 'none',
              ...(floating && {
                position: 'fixed',
                left: floating.x,
                top: floating.y + FLOATING_CHROME_H,
                width: floating.w,
                height: floating.h - FLOATING_CHROME_H,
                zIndex: floating.z,
              }),
            }}
          >
            {renderTabContent(tab)}
          </div>
        )
      })}
    </div>
  )
}
