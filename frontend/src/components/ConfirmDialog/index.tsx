import './styles.css'

interface ConfirmDialogProps {
  title: string
  details: Array<{ label: string; value: string }>
  warning?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, details, warning, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" data-testid="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        <div className="confirm-details">
          {details.map((d) => (
            <div key={d.label} className="confirm-detail-row">
              <span className="confirm-detail-label">{d.label}:</span>
              <span className="confirm-detail-value">{d.value}</span>
            </div>
          ))}
        </div>
        {warning && <div className="confirm-warning">{warning}</div>}
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="confirm-ok-btn" onClick={onConfirm}>
            确认执行
          </button>
        </div>
      </div>
    </div>
  )
}
