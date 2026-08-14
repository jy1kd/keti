import { useCallback, useEffect, useState } from 'react'
import { useQueryStore, type OrderEntry } from './store'
import { OrderFlow } from './OrderFlow'
import './styles.css'

type OrderFilter = 'all' | 'unfilled' | 'filled'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: '全部报单' },
  { key: 'unfilled', label: '未成交报单' },
  { key: 'filled', label: '已成交报单' },
]

/** 未成交：status ∈ {2 未成交排队, 3 未成交}，无成交量且未撤 */
function isUnfilled(order: OrderEntry): boolean {
  return order.orderStatus === '2' || order.orderStatus === '3'
}

/** 已成交：status ∈ {0 全部成交, 1 部分成交}，有成交量 */
function isFilled(order: OrderEntry): boolean {
  return order.orderStatus === '0' || order.orderStatus === '1'
}

export function OrdersQuery() {
  const orders = useQueryStore((s) => s.orders)
  const fetchOrders = useQueryStore((s) => s.fetchOrders)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)
  const [filter, setFilter] = useState<OrderFilter>('all')

  // 10s 自刷新：完成后调度下一次，避免重入（对齐查询窗口节奏）
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchOrders()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchOrders])

  // C 快捷键撤销全部：输入框/文本域聚焦时不触发（沿用查询窗口语义）
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        handleCancelAll()
      }
    },
    [handleCancelAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const filtered = orders.filter((o) =>
    filter === 'all' ? true : filter === 'unfilled' ? isUnfilled(o) : isFilled(o)
  )

  return (
    <div className="orders-query">
      <div className="flow-toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`query-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <OrderFlow orders={filtered} emptyText={filter === 'all' ? undefined : '无匹配报单'} />
    </div>
  )
}
