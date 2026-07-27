import { useCallback } from 'react'
import { useQueryStore } from './store'
import { useOrderStore } from '../order/store'

const DIRECTION_MAP: Record<string, string> = { '2': '多', '3': '空' }

export function Position() {
  const positions = useQueryStore((s) => s.positions)
  const setSelectedInstrument = useOrderStore((s) => s.setSelectedInstrument)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)

  const onClose = useCallback(
    (instrumentID: string, posiDirection: string, volume: number, todayPosition: number) => {
      // 上期所/能源所今仓需用 'close_today'(CTP '3')，昨仓用 'close'(CTP '1')
      const offsetFlag = todayPosition > 0 ? 'close_today' : 'close'
      setSelectedInstrument(instrumentID)
      setOrderForm({
        instrumentID,
        direction: posiDirection === '2' ? 'sell' : 'buy', // 多→卖平, 空→买平
        combOffsetFlag: offsetFlag,
        volumeTotalOriginal: volume,
      })
    },
    [setSelectedInstrument, setOrderForm]
  )

  if (positions.length === 0) {
    return (
      <div className="position-table-wrap">
        <div className="flow-empty">暂无持仓数据</div>
      </div>
    )
  }

  return (
    <div className="position-table-wrap">
      <div className="flow-toolbar">
        <span className="flow-count">{positions.length} 个合约</span>
      </div>
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th>合约</th>
              <th>方向</th>
              <th>持仓量</th>
              <th>持仓盈亏</th>
              <th>开仓成本</th>
              <th>占用保证金</th>
              <th>今仓</th>
              <th>昨仓</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => (
              <tr key={`${pos.instrumentID}-${pos.posiDirection}-${i}`}>
                <td className="col-instrument">{pos.instrumentID}</td>
                <td className={`col-direction ${pos.posiDirection === '2' ? 'buy' : 'sell'}`}>
                  {DIRECTION_MAP[pos.posiDirection] ?? pos.posiDirection}
                </td>
                <td className="col-volume">{pos.position}</td>
                <td className={`col-profit ${pos.positionProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {pos.positionProfit.toFixed(2)}
                </td>
                <td className="col-cost">{pos.openCost.toFixed(2)}</td>
                <td className="col-margin">{pos.useMargin.toFixed(2)}</td>
                <td className="col-today">{pos.todayPosition}</td>
                <td className="col-yesterday">{pos.ydPosition}</td>
                <td className="col-action">
                  <button
                    className="btn-cancel"
                    onClick={() => onClose(pos.instrumentID, pos.posiDirection, pos.position, pos.todayPosition)}
                  >
                    平仓
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
