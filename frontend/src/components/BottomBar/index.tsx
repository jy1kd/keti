import { useCallback, useState } from 'react'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import {
  openOrderFloating,
  openKlineFloating,
  openSettingsFloating,
  openIpcMonitorFloating,
  openInfiniteFloating,
} from '@/utils/openFloatingTab'
import './styles.css'

/**
 * BottomBar — 底部状态栏
 *
 * 承接原 GlobalBar 中除「工作区标签」外的全部内容：
 * - 左：连接状态（MD/TD 指示灯）
 * - 中：全局工具（报单/K线/无限下单/设置/网络监控，图标 + 中文名）
 * - 右：`>`/`<` 箭头，点击切换工具区全部展开 / 全部隐藏（max-width + opacity 动画）
 */
export function BottomBar() {
  const [toolsExpanded, setToolsExpanded] = useState(true)

  // 统一浮动窗入口：所有工具打开为浮动窗口（委托给共享 helper，与顶部菜单一致）
  const openSettings = useCallback(() => {
    openSettingsFloating()
  }, [])

  const openIpcMonitor = useCallback(() => {
    openIpcMonitorFloating()
  }, [])

  // 报单入口：优先为当前选中合约打开报单浮动窗；未选中合约时打开空白报单浮动窗
  const openOrder = useCallback(() => {
    openOrderFloating()
  }, [])

  // K线入口：打开K线浮动窗；有选中合约则直接定位到该合约
  const openKline = useCallback(() => {
    openKlineFloating()
  }, [])

  const openInfinite = useCallback(() => {
    openInfiniteFloating()
  }, [])

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar__left">
        <ConnectionStatus />
      </div>

      {/* 工具区：图标 + 中文名；箭头可整体收起/展开 */}
      <div
        className={`bottom-bar__tools${toolsExpanded ? '' : ' bottom-bar__tools--collapsed'}`}
        data-testid="bottom-bar-tools"
        aria-hidden={!toolsExpanded}
      >
        <button type="button" className="bottom-bar__tool" aria-label="五档下单" title="五档下单" onClick={openOrder}>
          <span className="bottom-bar__tool-icon">📝</span>
          <span className="bottom-bar__tool-label">五档下单</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="K线" title="K线" onClick={openKline}>
          <span className="bottom-bar__tool-icon">📈</span>
          <span className="bottom-bar__tool-label">K线</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="无限下单" title="无限下单" onClick={openInfinite}>
          <span className="bottom-bar__tool-icon">♾️</span>
          <span className="bottom-bar__tool-label">无限下单</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="设置" title="设置" onClick={openSettings}>
          <span className="bottom-bar__tool-icon">⚙</span>
          <span className="bottom-bar__tool-label">设置</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="网络监控" title="网络监控" onClick={openIpcMonitor}>
          <span className="bottom-bar__tool-icon">🔌</span>
          <span className="bottom-bar__tool-label">网络监控</span>
        </button>
      </div>

      {/* 箭头开关：展开时 `<`（点击收起），收起时 `>`（点击展开） */}
      <button
        type="button"
        className="bottom-bar__toggle"
        data-testid="bottom-bar-toggle"
        aria-label={toolsExpanded ? '收起工具' : '展开工具'}
        aria-expanded={toolsExpanded}
        title={toolsExpanded ? '收起工具' : '展开工具'}
        onClick={() => setToolsExpanded((v) => !v)}
      >
        {toolsExpanded ? '<' : '>'}
      </button>
    </footer>
  )
}
