import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { TabBar } from '@/components/TabBar'
import { PerfMonitor } from '@/components/PerfMonitor'
import {
  openOrderFloating,
  openKlineFloating,
  openQueryFloating,
  openSettingsFloating,
  openIpcMonitorFloating,
} from '@/utils/openFloatingTab'
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
 * - 右：全局工具区（📝 报单、📈 K线、📋 查询、⚙ 设置、⋯ 更多：⚡FPS 监控 / 🔌 网络监控）
 *
 * 设计原则（navigation-redesign.md §3.1）：单一事实源、冗余即删除、调试降权。
 */
export function GlobalBar({ perfVisible, onTogglePerf }: GlobalBarProps) {
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

  // 统一浮动窗入口：所有右上角工具打开为浮动窗口（标签脱离标签栏，⇩ 可停靠回标签）
  const openSettings = useCallback(() => {
    openSettingsFloating()
  }, [])

  const openIpcMonitor = useCallback(() => {
    openIpcMonitorFloating()
  }, [])

  const openQuery = useCallback(() => {
    openQueryFloating()
  }, [])

  // 报单入口：优先为当前选中合约打开报单浮动窗；未选中合约时打开空白报单浮动窗
  // 尺寸对齐原 OrderPopup 弹窗（540×400）
  const openOrder = useCallback(() => {
    openOrderFloating()
  }, [])

  // K线入口：打开K线浮动窗；有选中合约则直接定位到该合约
  const openKline = useCallback(() => {
    openKlineFloating()
  }, [])

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
          aria-label="报单"
          title="报单"
          onClick={openOrder}
        >
          📝
        </button>
        <button
          type="button"
          className="global-bar__tool"
          aria-label="K线"
          title="K线"
          onClick={openKline}
        >
          📈
        </button>
        <button
          type="button"
          className="global-bar__tool"
          aria-label="📋 查询"
          title="📋 查询"
          onClick={openQuery}
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
