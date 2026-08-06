import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { TradeParams } from './TradeParams'
import { MarketDepth } from './MarketDepth'
import './OrderPopup.css'

interface OrderTradeBodyProps {
  /** 报单合约代码；无合约时渲染空态（由外层调用方决定是否渲染） */
  instrumentID: string
}

/**
 * OrderTradeBody — P1 报单主体（弹窗 / 标签页共用）
 *
 * 渲染 `.order-popup__body` 双栏：左列压缩参数区 `TradeParams`（200px）+ 右列三列十档盘口 `MarketDepth`。
 * `OrderPopup`（悬浮弹窗）与 `OrderPage`（报单标签页，含浮动/非浮动形态）共用此主体，
 * 保证「标签页和弹窗」视觉与交互完全一致，杜绝样式漂移。
 *
 * 复用 `OrderPopup.css` 的 `.order-popup__*` 类名；快照 / 合约 / priceTick 取值与 OrderPopup 原逻辑一致。
 */
export function OrderTradeBody({ instrumentID }: OrderTradeBodyProps) {
  const snapshots = useMarketStore((s) => s.snapshots)
  const contracts = useContractsStore((s) => s.contracts)

  const snapshot = instrumentID ? (snapshots.get(instrumentID) ?? null) : null
  const contract = instrumentID ? contracts.find((c) => c.instrumentID === instrumentID) : null
  const priceTick = contract?.priceTick ?? 0.2

  return (
    <div className="order-popup__body">
      <div className="order-popup__params">
        <TradeParams instrumentID={instrumentID} />
      </div>
      <div className="order-popup__depth">
        <MarketDepth snapshot={snapshot} priceTick={priceTick} />
      </div>
    </div>
  )
}
