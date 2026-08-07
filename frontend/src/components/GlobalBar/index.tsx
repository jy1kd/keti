import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { TabBar } from '@/components/TabBar'
import { PerfMonitor } from '@/components/PerfMonitor'
import { useTabStore } from '@/stores/tabs'
import { useQueryPopupStore } from '@/modules/query/popupStore'
import './styles.css'

interface GlobalBarProps {
  /** 性能监控（⚡FPS）是否可见 */
  perfVisible: boolean
  /** 切换性能监控 */
  onTogglePerf: () => void
}

/**
 * GlobalBar — 全局栏（合并原 status-bar + tab-bar 为一行）
 *
 * 一行承载三层信息：
 * - 左：连接状态（MD/TD 指示灯）
 * - 中：工作区标签（TabBar 整体迁入，保留拖拽分离 / 横滚 / 右键菜单）
 * - 右：全局工具区（📋 查询、⚙ 设置、⋯ 更多：⚡FPS 监控 / 🔌 网络监控）
 *
 * 设计原则（navigation-redesign.md §3.1）：单一事实源、冗余即删除、调试降权。
 */
export function GlobalBar({ perfVisible, onTogglePerf }: GlobalBarProps) {
  const openTab = useTabStore((s) => s.openTab)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // 点击 ⋯ 菜单外部关闭
  useEffect(() => {
    if (!moreOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [moreOpen])

  // Escape 关闭 ⋯ 菜单
  useEffect(() => {
    if (!moreOpen) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moreOpen])

  const openSettings = useCallback(() => {
    openTab({ type: 'settings', title: '⚙ 设置' })
  }, [openTab])

  const openIpcMonitor = useCallback(() => {
    openTab({ type: 'ipc-monitor', title: '📡 网络监控' })
  }, [openTab])

  return (
    <header className="global-bar">
      <div className="global-bar__left">
        <ConnectionStatus />
      </div>

      {/* 工作区标签：TabBar 整体迁入，占用中间剩余宽度，支持横向滚动 */}
      <TabBar onAddTab={openSettings} />

      <div className="global-bar__tools">
        <button
          type="button"
          className="global-bar__tool"
          aria-label="📋 查询"
          title="📋 查询"
          onClick={() => useQueryPopupStore.getState().open()}
        >
          📋
        </button>
        <button
          type="button"
          className="global-bar__tool"
          aria-label="设置"
          title="设置"
          onClick={openSettings}
        >
          ⚙
        </button>

        {/* FPS 徽标：仅 perfVisible 时内联显示，不占主行 */}
        {perfVisible && (
          <span className="global-bar__fps" data-testid="global-bar-fps" title="FPS 监控 (Ctrl+Shift+M)">
            ⚡<PerfMonitor visible />
          </span>
        )}

        {/* ⋯ 更多菜单：收敛调试功能 */}
        <div className="global-bar__more" ref={moreRef}>
          <button
            type="button"
            className="global-bar__tool"
            aria-label="更多"
            title="更多"
            aria-expanded={moreOpen}
            onClick={(e) => {
              e.stopPropagation()
              setMoreOpen((o) => !o)
            }}
          >
            ⋯
          </button>
          {moreOpen && (
            <div className="global-bar__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="global-bar__menu-item"
                aria-pressed={perfVisible}
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePerf()
                  setMoreOpen(false)
                }}
              >
                <span className="global-bar__menu-label">⚡FPS 监控</span>
                {perfVisible && <span className="global-bar__menu-check">✓</span>}
              </button>
              <button
                type="button"
                role="menuitem"
                className="global-bar__menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  openIpcMonitor()
                  setMoreOpen(false)
                }}
              >
                <span className="global-bar__menu-label">🔌 网络监控</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
