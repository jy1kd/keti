import { useEffect, useRef, useCallback } from 'react'
import { useQueryStore } from './store'

/** CTP orderStatus → 中文映射 */
const STATUS_MAP: Record<string, string> = {
  '0': '全部成交',
  '1': '部分成交',
  '2': '未成交(排队)',
  '3': '未成交',
  '5': '已撤单',
}

/** CTP direction → 中文映射 */
const DIRECTION_MAP: Record<string, string> = {
  '0': '买',
  '1': '卖',
}

/** CTP offsetFlag → 中文映射 */
const OFFSET_MAP: Record<string, string> = {
  '0': '开仓',
  '1': '平仓',
  '2': '强平',
  '3': '平今',
  '4': '平昨',
}

/** 判断报单是否处于活跃状态（可撤单） */
function isActiveOrder(status: string): boolean {
  return status === '1' || status === '2' || status === '3'
}

export function OrderFlow() {
  const orders = useQueryStore((s) => s.orders)
  const newOrderRefs = useQueryStore((s) => s.newOrderRefs)
  const clearNewOrderRef = useQueryStore((s) => s.clearNewOrderRef)
  const handleCancelOrder = useQueryStore((s) => s.handleCancelOrder)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)

  // Auto-clear highlight after 2s
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    // 只为新增的 ref 创建计时器，不重置已有的
    for (const ref of newOrderRefs) {
      if (!timerRef.current.has(ref)) {
        const timer = setTimeout(() => {
          clearNewOrderRef(ref)
          timerRef.current.delete(ref)
        }, 2000)
        timerRef.current.set(ref, timer)
      }
    }
    // 清理已不在 newOrderRefs 中的计时器
    for (const [ref, timer] of timerRef.current) {
      if (!newOrderRefs.has(ref)) {
        clearTimeout(timer)
        timerRef.current.delete(ref)
      }
    }
  }, [newOrderRefs, clearNewOrderRef])

  const onCancel = useCallback(
    (orderRef: string) => {
      handleCancelOrder(orderRef)
    },
    [handleCancelOrder]
  )

  const onCancelAll = useCallback(() => {
    handleCancelAll()
  }, [handleCancelAll])

  if (orders.length === 0) {
    return (
      <div className="order-flow">
        <div className="flow-toolbar">
          <button className="btn-cancel-all" disabled>撤销全部</button>
        </div>
        <div className="flow-empty">暂无报单数据</div>
      </div>
    )
  }

  return (
    <div className="order-flow">
      <div className="flow-toolbar">
        <button className="btn-cancel-all" onClick={onCancelAll}>撤销全部</button>
        <span className="flow-count">{orders.length} 笔</span>
      </div>
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>报单号</th>
              <th>合约</th>
              <th>买卖</th>
              <th>开平</th>
              <th>价格</th>
              <th>委托量</th>
              <th>成交量</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.orderRef}
                className={newOrderRefs.has(order.orderRef) ? 'row-new' : ''}
              >
                <td className="col-ref">{order.orderRef}</td>
                <td className="col-instrument">{order.instrumentID}</td>
                <td className={`col-direction ${order.direction === '0' ? 'buy' : 'sell'}`}>
                  {DIRECTION_MAP[order.direction] ?? order.direction}
                </td>
                <td className="col-offset">{OFFSET_MAP[order.combOffsetFlag] ?? order.combOffsetFlag}</td>
                <td className="col-price">{order.limitPrice}</td>
                <td className="col-volume">{order.volumeTotalOriginal}</td>
                <td className="col-traded">{order.volumeTraded ?? 0}</td>
                <td className="col-status">{STATUS_MAP[order.orderStatus] ?? order.orderStatus}</td>
                <td className="col-time">{order.insertTime ?? '-'}</td>
                <td className="col-action">
                  {isActiveOrder(order.orderStatus) && (
                    <button
                      className="btn-cancel"
                      onClick={() => onCancel(order.orderRef)}
                    >
                      撤单
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
