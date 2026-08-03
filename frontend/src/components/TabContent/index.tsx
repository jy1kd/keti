import { useTabStore, type Tab } from '@/stores/tabs'
import './styles.css'

/**
 * 为每个标签类型生成面板内容。
 *
 * 当前使用模块级组件或占位文本；
 * PR-R11（App.tsx 重构）会将占位文本替换为实际页面组件。
 */
function renderTabContent(tab: Tab): React.ReactNode {
  switch (tab.type) {
    case 'market':
      return <span>行情</span>
    case 'order':
      return <span>报单</span>
    case 'query':
      return <span>查询</span>
    case 'kline':
      return <span>K线</span>
    case 'favorites':
      return <span>自选</span>
    case 'settings':
      return <span>设置</span>
    case 'options':
      return <span>期权</span>
    case 'ipc-monitor':
      return <span>IPC</span>
    default:
      return <span>未知标签</span>
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
