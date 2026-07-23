import { useState } from 'react'
import './styles.css'

interface OrderItem {
  orderRef: string
  instrumentID: string
  direction: string
  combOffsetFlag?: string
  limitPrice?: number
  volumeTotalOriginal?: number
  orderStatus: string
}

interface BatchCancelProps {
  orders: OrderItem[]
  onCancelOrder: (orderRef: string) => Promise<boolean>
  onClose?: () => void
}

const STATUS_LABEL: Record<string, string> = {
  no_traded: '未成交',
  partial: '部分成交',
  submitted: '已提交',
}

const DIRECTION_LABEL: Record<string, string> = {
  buy: '买',
  sell: '卖',
}

const OFFSET_LABEL: Record<string, string> = {
  open: '开',
  close: '平',
  close_today: '平今',
}

export function BatchCancel({ orders, onCancelOrder, onClose }: BatchCancelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cancelling, setCancelling] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null)

  const allSelected = orders.length > 0 && selected.size === orders.length

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orders.map((o) => o.orderRef)))
    }
  }

  function toggleOrder(orderRef: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderRef)) {
        next.delete(orderRef)
      } else {
        next.add(orderRef)
      }
      return next
    })
  }

  async function handleCancelSelected() {
    if (selected.size === 0) return

    setCancelling(true)
    setResults(null)

    const orderRefs = Array.from(selected)
    const results_ = await Promise.allSettled(
      orderRefs.map((ref) => onCancelOrder(ref))
    )

    let success = 0
    let failed = 0
    for (const r of results_) {
      if (r.status === 'fulfilled' && r.value) success++
      else failed++
    }

    setResults({ success, failed })
    setSelected(new Set())
    setCancelling(false)
  }

  if (orders.length === 0) {
    return (
      <div className="batch-cancel">
        <div className="batch-cancel-header">
          <h3>批量撤单</h3>
        </div>
        <div className="batch-cancel-empty">没有可撤销的报单</div>
      </div>
    )
  }

  return (
    <div className="batch-cancel">
      <div className="batch-cancel-header">
        <h3>批量撤单</h3>
        <div className="batch-cancel-actions">
          <button
            type="button"
            className="select-toggle-btn"
            onClick={toggleSelectAll}
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
          <button
            type="button"
            className="cancel-selected-btn"
            disabled={selected.size === 0 || cancelling}
            onClick={handleCancelSelected}
          >
            {cancelling ? '撤销中...' : `撤销选中 (${selected.size})`}
          </button>
          {onClose && (
            <button type="button" className="close-btn" onClick={onClose}>
              关闭
            </button>
          )}
        </div>
      </div>

      {results && (
        <div className="batch-cancel-results">
          {results.success > 0 && <span className="result-success">成功 {results.success}</span>}
          {results.failed > 0 && <span className="result-failed">失败 {results.failed}</span>}
        </div>
      )}

      <div className="batch-cancel-list">
        {orders.map((order) => (
          <label
            key={order.orderRef}
            className={`order-item ${selected.has(order.orderRef) ? 'selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(order.orderRef)}
              onChange={() => toggleOrder(order.orderRef)}
              disabled={cancelling}
            />
            <span className="order-ref">{order.orderRef}</span>
            <span className="order-instrument">{order.instrumentID}</span>
            <span className={`order-dir dir-${order.direction}`}>
              {DIRECTION_LABEL[order.direction] ?? order.direction}
            </span>
            <span className="order-offset">
              {OFFSET_LABEL[order.combOffsetFlag ?? ''] ?? order.combOffsetFlag ?? '—'}
            </span>
            <span className="order-price">{order.limitPrice != null ? order.limitPrice : '—'}</span>
            <span className="order-vol">{order.volumeTotalOriginal != null ? order.volumeTotalOriginal : '—'}</span>
            <span className={`order-status status-${order.orderStatus}`}>
              {STATUS_LABEL[order.orderStatus] ?? order.orderStatus}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
