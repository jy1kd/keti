import { useCallback } from 'react'
import { useQueryStore, type PositionEntry } from './store'
import { useOrderStore } from '../order/store'
import { useMarketStore } from '../market/store'
import { useTabStore } from '@/stores/tabs'

const DIRECTION_MAP: Record<string, string> = { '2': '多', '3': '空' }

interface PositionProps {
  /** 可选：外部传入持仓列表；缺省读 store */
  positions?: PositionEntry[]
  /** 可选：空态文案；缺省「暂无持仓数据」 */
  emptyText?: string
}

export function Position({ positions: propPositions, emptyText = '暂无持仓数据' }: PositionProps) {
  const storePositions = useQueryStore((s) => s.positions)
  const positions = propPositions ?? storePositions
  const setSelectedInstrument = useOrderStore((s) => s.setSelectedInstrument)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)

  const onClose = useCallback(
    (instrumentID: string, posiDirection: string, volume: number, todayPosition: number) => {
      // 上期所/能源所今仓需用 'close_today'(CTP '3')，昨仓用 'close'(CTP '1')
      const offsetFlag = todayPosition > 0 ? 'close_today' : 'close'
      const direction = posiDirection === '2' ? 'sell' : 'buy' // 多→卖平, 空→买平

      // 从行情快照取对手价：平多→卖一价，平空→买一价
      let price = 0
      const snap = useMarketStore.getState().snapshots.get(instrumentID)
      if (snap) {
        if (posiDirection === '2') {
          price = snap.askPrice1 > 0 ? snap.askPrice1 : snap.lastPrice
        } else {
          price = snap.bidPrice1 > 0 ? snap.bidPrice1 : snap.lastPrice
        }
      }

      setSelectedInstrument(instrumentID)
      setOrderForm({
        instrumentID,
        direction,
        combOffsetFlag: offsetFlag,
        volumeTotalOriginal: volume,
        limitPrice: price,
      })

      // 打开报单标签页，OrderPage 挂载时读取 store 中的平仓参数
      useTabStore.getState().openTab({
        type: 'order',
        title: `📝 五档下单-${instrumentID}`,
        props: { instrumentID },
      })
    },
    [setSelectedInstrument, setOrderForm]
  )

  if (positions.length === 0) {
    return (
      <div className="position-table-wrap">
        <div className="flow-empty">{emptyText}</div>
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
