import { useCallback } from 'react'
import { TabBar } from '@/components/TabBar'
import { openFloatingTab } from '@/utils/openFloatingTab'
import './styles.css'

/**
 * GlobalBar — 全局顶栏（仅承载工作区标签）
 *
 * 原「连接状态 + 全局工具」已迁至底部状态栏 BottomBar。
 * 保留 + 新增标签入口（打开设置浮动窗）。
 */
export function GlobalBar() {
  // 新增标签入口：打开设置浮动窗（与 BottomBar 的 ⚙ 设置一致）
  const openSettings = useCallback(() => {
    openFloatingTab({ type: 'settings', title: '⚙ 设置' })
  }, [])

  return (
    <header className="global-bar">
      <TabBar onAddTab={openSettings} />
    </header>
  )
}
