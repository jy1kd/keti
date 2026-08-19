import './styles.css'

interface QuickActionsProps {
  instrumentID: string
  onBatchCancel: () => void
}

/** 快捷操作：批量撤单（一键反向/锁仓已下线，2026-08-19） */
export function QuickActions({ instrumentID, onBatchCancel }: QuickActionsProps) {
  const disabled = !instrumentID

  function handleBatchCancel() {
    if (disabled) return
    onBatchCancel()
  }

  return (
    <div className="quick-actions">
      <button
        type="button"
        className="qa-btn qa-batch"
        disabled={disabled}
        onClick={handleBatchCancel}
      >
        批量撤单
      </button>
    </div>
  )
}
