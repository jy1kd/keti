import { useOrderPopupStore } from './popupStore'
import './FooterBar.css'

/**
 * FooterBar — ⑦ 底部工具条
 *
 * 居中 ∧/∨ 切换精简态 / 完整态（popupStore.expanded，与标题栏 `—` 等价）。
 */
export function FooterBar() {
  const expanded = useOrderPopupStore((s) => s.expanded)
  const toggleExpanded = useOrderPopupStore((s) => s.toggleExpanded)

  return (
    <div className="order-popup__footer" data-testid="order-popup-footer">
      <button
        type="button"
        className="order-popup__footer-toggle"
        data-testid="op-footer-toggle"
        onClick={toggleExpanded}
        aria-label={expanded ? '收起完整态' : '展开完整态'}
        title={expanded ? '收起完整态' : '展开完整态'}
      >
        <span className="order-popup__footer-arrow">{expanded ? '∨' : '∧'}</span>
        <span className="order-popup__footer-text">{expanded ? '收起' : '展开完整态'}</span>
      </button>
    </div>
  )
}
