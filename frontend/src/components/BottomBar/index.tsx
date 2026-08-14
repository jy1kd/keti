import { ConnectionStatus } from '@/components/ConnectionStatus'
import './styles.css'

/**
 * BottomBar — 底部状态栏
 *
 * 仅承载 MD/TD 连接状态指示灯（右下角）。
 * 全部浮动窗入口已统一收敛到顶部原生菜单（行情/交易/查询/设置），
 * 底部不再重复摆放工具按钮。
 */
export function BottomBar() {
  return (
    <footer className="bottom-bar">
      <ConnectionStatus />
    </footer>
  )
}
