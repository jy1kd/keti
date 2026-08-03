import { useCallback, type KeyboardEvent } from 'react'
import { useTabStore } from '@/stores/tabs'
import './styles.css'

interface TabBarProps {
  /** 点击 "+" 按钮时的回调 */
  onAddTab?: () => void
}

/**
 * 标签栏组件
 *
 * 显示所有打开的标签页，支持切换、关闭、新增。
 * 键盘导航：左/右箭头切换标签，Home/End 跳转首尾。
 */
export function TabBar({ onAddTab }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
      if (currentIndex === -1) return

      let nextIndex: number | null = null

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length
          break
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = tabs.length - 1
          break
        default:
          return
      }

      e.preventDefault()
      setActiveTab(tabs[nextIndex].id)
    },
    [tabs, activeTabId, setActiveTab],
  )

  return (
    <div
      className="tab-bar"
      role="tablist"
      aria-label="标签栏"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
          className={`tab-bar__tab${tab.id === activeTabId ? ' tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveTab(tab.id)
            }
          }}
        >
          <span className="tab-bar__title">{tab.title}</span>
          {tab.closable && (
            <button
              type="button"
              aria-label="关闭标签"
              className="tab-bar__close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="tab-bar__add"
        aria-label="新增标签"
        title="新增标签"
        onClick={onAddTab}
      >
        +
      </button>
    </div>
  )
}
