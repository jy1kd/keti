import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useTabStore, type Tab } from '@/stores/tabs'
import { useFloatingWindowStore, FLOATING_CHROME_H } from '@/stores/floatingWindows'
import { startDetachDrag, detachTabAt } from '@/utils/detachDrag'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { QueryPanel } from '@/modules/query/QueryPanel'
import { OrdersQuery } from '@/modules/query/OrdersQuery'
import { PositionsQuery } from '@/modules/query/PositionsQuery'
import { OptionsPanel } from '@/modules/options/OptionsPanel'
import { TQuoteView } from '@/modules/options/TQuoteView'
import { CollectionsPage } from '@/pages/CollectionsPage'
import { CollectionPage } from '@/pages/CollectionPage'
import { OrderPage } from '@/pages/OrderPage'
import { KLinePage } from '@/pages/KLinePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { IPCMonitorPage } from '@/pages/IPCMonitorPage'
import { InfiniteOrderPage } from '@/pages/InfiniteOrderPage'
import './styles.css'

/**
 * 安全地从 tab.props 中提取 instrumentID 字符串。
 * 使用运行时类型守卫，避免 `as string` 断言掩藏非字符串值传入的 bug。
 */
function getInstrumentID(props: Record<string, unknown>): string | undefined {
  return typeof props.instrumentID === 'string' ? props.instrumentID : undefined
}

/**
 * 安全地从 tab.props 中提取 collectionId 字符串（收藏夹标签页用）。
 */
function getCollectionId(props: Record<string, unknown>): string {
  return typeof props.collectionId === 'string' ? props.collectionId : ''
}

/**
 * 为每个标签类型生成面板内容。
 *
 * market 类型已集成 MarketPanel；
 * order 类型已集成 OrderPage；
 * kline 类型已集成 KLinePage；
 * query 类型已集成 QueryPanel（全局账户查询）；
 * 其他类型使用占位文本，后续 PR 会逐步替换为实际页面组件。
 */
function renderTabContent(tab: Tab, floating: boolean): React.ReactNode {
  switch (tab.type) {
    case 'market':
      return <MarketPanel />
    case 'order':
      return (
        <OrderPage
          instrumentID={getInstrumentID(tab.props)}
          floating={floating}
          tabId={tab.id}
        />
      )
    case 'kline':
      return <KLinePage instrumentID={getInstrumentID(tab.props)} tabId={tab.id} />
    case 'infinite':
      return (
        <InfiniteOrderPage
          instrumentID={getInstrumentID(tab.props)}
          floating={floating}
          tabId={tab.id}
        />
      )
    case 'collections':
      return <CollectionsPage />
    case 'collection':
      return <CollectionPage collectionId={getCollectionId(tab.props)} tabId={tab.id} />
    case 'query':
      return <QueryPanel />
    case 'query-orders':
      return <OrdersQuery />
    case 'query-positions':
      return <PositionsQuery />
    case 'settings':
      return <SettingsPage />
    case 'options':
      return <OptionsPanel />
    case 'tquote':
      return <TQuoteView instrumentID={getInstrumentID(tab.props)} tabId={tab.id} />
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

  // 切标签后：若焦点落在被隐藏（aria-hidden="true"）的面板内则 blur。display:none 面板
  // 无法保留焦点，且浏览器对「aria-hidden 祖先进 contains focused descendant」报警
  // （如 collections-page 按钮聚焦时切走标签）。同一 commit 内 aria-hidden 已随
  // activeTabId 更新，effect 在 commit 后跑、能看到新隐藏态。
  useEffect(() => {
    const el = document.activeElement as HTMLElement | null
    if (el && el.closest('.tab-content__panel[aria-hidden="true"]')) {
      el.blur()
    }
  }, [activeTabId])

  // 主窗口内容区展示的有效活跃标签：若活跃标签已浮动（脱离为弹窗），主窗口回退到
  // 默认行情标签页，保证「拖出弹窗后主窗口下方不空白」。正常路径下 detachTabAt 已
  // 把活跃标签切回 market，这里是渲染层的兜底（任何路径漏切时仍不空白）。
  const activeIsFloating = activeTabId ? !!windows[activeTabId] : false
  const effectiveActiveId = activeIsFloating
    ? (tabs.find((t) => t.type === 'market')?.id ?? tabs.find((t) => !windows[t.id])?.id ?? activeTabId)
    : activeTabId

  // 浮动面板渲染到顶层 overlay：与 FloatingWindow chrome 同层，脱离 .tab-content 的
  // flex/overflow/层叠上下文，避免「内容区空白/被裁剪/错位」。首次提交后 overlay 已存在，
  // 浮动面板在其后的渲染中总能找到目标容器。
  const overlayEl = typeof document !== 'undefined' ? document.getElementById('floating-overlay') : null

  return (
    <div className="tab-content">
      {tabs.map((tab) => {
        const isActive = tab.id === effectiveActiveId
        const floating = windows[tab.id]
        const panel = (
          <div
            key={tab.id}
            role="tabpanel"
            aria-labelledby={tab.id}
            aria-hidden={floating ? false : !isActive}
            className={`tab-content__panel${floating ? ' tab-content__panel--floating' : ''}`}
            onPointerDownCapture={() => {
              // 捕获阶段置顶：即使页面内部组件 stopPropagation 也能将弹窗带到最前
              if (floating) {
                useFloatingWindowStore.getState().focus(tab.id)
              }
            }}
            onPointerDown={(e) => {
              if (floating) return
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
            {renderTabContent(tab, !!floating)}
          </div>
        )
        if (floating && overlayEl) {
          return createPortal(panel, overlayEl, tab.id)
        }
        return panel
      })}
    </div>
  )
}
