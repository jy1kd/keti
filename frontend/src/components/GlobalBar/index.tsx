import { TabBar } from '@/components/TabBar'
import './styles.css'

/**
 * GlobalBar — 全局顶栏（仅承载工作区标签）
 *
 * 原「连接状态 + 全局工具」已迁至底部状态栏 BottomBar；
 * 新增标签入口由 TabBar 的 `+` 悬停选择栏承担（停靠打开 order/kline/query/settings）。
 */
export function GlobalBar() {
  return (
    <header className="global-bar">
      <TabBar />
    </header>
  )
}
