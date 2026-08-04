import { useCallback, useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useQueryPopupStore } from '@/modules/query/popupStore'
import { isElectron } from '@/services/electron'
import './styles.css'

interface TabBarProps {
  /** 点击 "+" 按钮时的回调 */
  onAddTab?: () => void
}

/** 可通过快捷按钮打开的标签页类型 */
const QUICK_TABS = [
  { type: 'favorites' as const, icon: '⭐', title: '⭐ 自选' },
]

interface ContextMenuState {
  tabId: string
  tabType: string
  tabTitle: string
  x: number
  y: number
}

/**
 * 标签栏组件
 *
 * 显示所有打开的标签页，支持切换、关闭、新增。
 * 键盘导航：左/右箭头切换标签，Home/End 跳转首尾。
 * 右键菜单：在新窗口打开（仅 Electron 环境）
 */
export function TabBar({ onAddTab }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const openTab = useTabStore((s) => s.openTab)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // 点击空白处关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // 按 Escape 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [contextMenu])

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

  // 右键菜单处理
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tab: { id: string; type: string; title: string }) => {
      e.preventDefault()
      setContextMenu({
        tabId: tab.id,
        tabType: tab.type,
        tabTitle: tab.title,
        x: e.clientX,
        y: e.clientY,
      })
    },
    [],
  )

  // 在新窗口打开标签
  const handleOpenInNewWindow = useCallback(async () => {
    if (!contextMenu) return
    const { tabType, tabId, tabTitle } = contextMenu

    if (isElectron()) {
      // Electron 环境：调用 IPC 打开新窗口
      const { openTabWindow } = await import('@/services/electron')
      await openTabWindow(tabType, tabId, tabTitle)
    } else {
      // Web 环境：在新标签页打开
      const url = `${window.location.origin}${window.location.pathname}#/tab/${tabType}/${tabId}`
      window.open(url, '_blank')
    }

    setContextMenu(null)
  }, [contextMenu])

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
          onContextMenu={(e) => handleContextMenu(e, tab)}
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
      <div className="tab-bar__separator" />
      {QUICK_TABS.map(({ type, icon, title }) => {
        const isOpen = tabs.some((t) => t.type === type)
        return (
          <button
            key={type}
            type="button"
            className={`tab-bar__quick${isOpen ? ' tab-bar__quick--active' : ''}`}
            aria-label={title}
            title={title}
            onClick={() => {
              if (isOpen) {
                // 已打开则激活
                const tab = tabs.find((t) => t.type === type)
                if (tab) setActiveTab(tab.id)
              } else {
                openTab({ type, title, closable: true })
              }
            }}
          >
            {icon}
          </button>
        )
      })}
      {/* 查询弹窗快捷按钮（查询为悬浮弹窗形态，非标签页） */}
      <button
        type="button"
        className="tab-bar__quick"
        aria-label="📋 查询"
        title="📋 查询"
        onClick={() => useQueryPopupStore.getState().open()}
      >
        📋
      </button>
      <button
        type="button"
        className="tab-bar__add"
        aria-label="新增标签"
        title="新增标签"
        onClick={onAddTab}
      >
        +
      </button>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-bar__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={handleOpenInNewWindow}
          >
            🪟 在新窗口打开
          </button>
        </div>
      )}
    </div>
  )
}
