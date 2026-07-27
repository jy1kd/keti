import { useEffect, useRef } from 'react'
import { useQueryStore } from './store'

const DIRECTION_MAP: Record<string, string> = { '0': '买', '1': '卖' }
const OFFSET_MAP: Record<string, string> = { '0': '开仓', '1': '平仓', '2': '强平', '3': '平今', '4': '平昨' }

export function TradeFlow() {
  const trades = useQueryStore((s) => s.trades)
  const newTradeIDs = useQueryStore((s) => s.newTradeIDs)
  const clearNewTradeID = useQueryStore((s) => s.clearNewTradeID)

  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    for (const id of newTradeIDs) {
      if (!timerRef.current.has(id)) {
        const timer = setTimeout(() => {
          clearNewTradeID(id)
          timerRef.current.delete(id)
        }, 2000)
        timerRef.current.set(id, timer)
      }
    }
    return () => {
      for (const timer of timerRef.current.values()) clearTimeout(timer)
    }
  }, [newTradeIDs, clearNewTradeID])

  if (trades.length === 0) {
    return (
      <div className="trade-flow">
        <div className="flow-empty">暂无成交数据</div>
      </div>
    )
  }

  return (
    <div className="trade-flow">
      <div className="flow-toolbar">
        <span className="flow-count">{trades.length} 笔</span>
      </div>
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>成交号</th>
              <th>合约</th>
              <th>买卖</th>
              <th>开平</th>
              <th>价格</th>
              <th>数量</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.tradeID}
                className={newTradeIDs.has(trade.tradeID) ? 'row-new' : ''}
              >
                <td className="col-ref">{trade.tradeID}</td>
                <td className="col-instrument">{trade.instrumentID}</td>
                <td className={`col-direction ${trade.direction === '0' ? 'buy' : 'sell'}`}>
                  {DIRECTION_MAP[trade.direction] ?? trade.direction}
                </td>
                <td className="col-offset">{OFFSET_MAP[trade.offsetFlag] ?? trade.offsetFlag}</td>
                <td className="col-price">{trade.price}</td>
                <td className="col-volume">{trade.volume}</td>
                <td className="col-time">{trade.tradeTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
