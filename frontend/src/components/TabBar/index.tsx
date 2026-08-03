import { useTabStore } from '@/stores/tabs'
import './styles.css'

/**
 * 标签栏组件
 *
 * 显示所有打开的标签页，支持切换、关闭、新增。
 */
export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          className={`tab-bar__tab${tab.id === activeTabId ? ' tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-bar__title">{tab.title}</span>
          {tab.closable && (
            <span
              role="button"
              aria-label="关闭标签"
              className="tab-bar__close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button
        className="tab-bar__add"
        aria-label="新增标签"
        title="新增标签"
      >
        +
      </button>
    </div>
  )
}
