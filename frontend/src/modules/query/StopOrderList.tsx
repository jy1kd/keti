import { useCallback } from 'react'
import { useQueryStore } from './store'

const STATUS_MAP: Record<string, string> = {
  pending: '待触发',
  triggered: '已触发',
  trigger_failed: '触发失败',
  canceled: '已取消',
}

const DIRECTION_MAP: Record<string, string> = { '0': '买', '1': '卖', buy: '买', sell: '卖' }
const OFFSET_MAP: Record<string, string> = { '0': '开仓', '1': '平仓', '2': '强平', '3': '平今', '4': '平昨' }

export function StopOrderList() {
  const stopOrders = useQueryStore((s) => s.stopOrders)
  const handleCancelStopOrder = useQueryStore((s) => s.handleCancelStopOrder)

  const onCancel = useCallback(
    (id: string) => {
      handleCancelStopOrder(id)
    },
    [handleCancelStopOrder]
  )

  if (stopOrders.length === 0) {
    return (
      <div className="stop-order-list">
        <div className="flow-empty">暂无止损单</div>
      </div>
    )
  }

  return (
    <div className="stop-order-list">
      <div className="flow-toolbar">
        <span className="flow-count">{stopOrders.length} 笔</span>
      </div>
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>止损单号</th>
              <th>合约</th>
              <th>方向</th>
              <th>开平</th>
              <th>止损价</th>
              <th>委托价</th>
              <th>数量</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {stopOrders.map((s) => (
              <tr key={s.stopOrderID}>
                <td className="col-ref">{s.stopOrderID}</td>
                <td className="col-instrument">{s.instrumentID}</td>
                <td className={`col-direction ${s.direction === 'buy' ? 'buy' : 'sell'}`}>
                  {DIRECTION_MAP[s.direction] ?? s.direction}
                </td>
                <td className="col-offset">{OFFSET_MAP[s.offsetFlag] ?? s.offsetFlag}</td>
                <td className="col-price">{s.stopPrice}</td>
                <td className="col-price">{s.limitPrice}</td>
                <td className="col-volume">{s.volume}</td>
                <td className="col-status">{STATUS_MAP[s.status] ?? s.status}</td>
                <td className="col-time">{s.createdAt}</td>
                <td className="col-action">
                  {s.status === 'pending' && (
                    <button className="btn-cancel" onClick={() => onCancel(s.stopOrderID)}>
                      取消
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
