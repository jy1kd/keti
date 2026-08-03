import type { MarketSnapshot } from '@/services/types'

interface DepthQuoteProps {
  snapshot: MarketSnapshot | null
  /** 合约最小变动价位：传入时，无真实挂单价的档位用 买一/卖一 ± n×priceTick 合成兜底 */
  priceTick?: number
  onBuyClick?: (price: number) => void
  onSellClick?: (price: number) => void
}

/** CTP 用 DBL_MAX (1.7976931348623157e+308) 表示无效价格 */
const CTP_INVALID_PRICE = 1.7976931348623157e+308
const isValidPrice = (price: number) => price > 0 && price < CTP_INVALID_PRICE

/** 按 priceTick 精度格式化价格（如 0.2 → 保留1位小数，0.05 → 保留2位） */
function formatTickPrice(n: number, tick: number): string {
  const str = String(tick)
  const decimals = str.includes('.') ? str.split('.')[1].length : 0
  return n.toFixed(decimals)
}

/** 单档解析结果：真实盘口有效 或 tick 合成兜底价 */
interface DepthLevel {
  price: number
  volume: number
  /** 真实盘口挂单有效 */
  valid: boolean
  /** tick 合成兜底价；null 表示无兜底 */
  fallback: number | null
}

/**
 * DepthQuote — 五档盘口
 *
 * 布局：卖一与买一相邻在中间，卖二~卖五向上排开、买二~买五向下排开。
 * 合成：无真实挂单价时，以买一/卖一为基准向外推档位（买一/卖一本身无效时回退到最新价）。
 */
export function DepthQuote({ snapshot, priceTick, onBuyClick, onSellClick }: DepthQuoteProps) {
  if (!snapshot) {
    return <div className="depth-quote depth-quote--empty">--</div>
  }

  const last = isValidPrice(snapshot.lastPrice) ? snapshot.lastPrice : null
  const tick = priceTick && priceTick > 0 ? priceTick : null

  // 以买一/卖一为基准（无真实挂单价时回退到最新价）
  const bidBase = isValidPrice(snapshot.bidPrice1) ? snapshot.bidPrice1 : last
  const askBase = isValidPrice(snapshot.askPrice1) ? snapshot.askPrice1 : last

  const resolveLevel = (price: number, volume: number, fallback: number | null): DepthLevel => {
    if (isValidPrice(price)) return { price, volume, valid: true, fallback: null }
    return { price: fallback ?? price, volume, valid: false, fallback }
  }

  // 买档合成：买n = 买一 - (n-1)×tick（向下递减）；卖档合成：卖n = 卖一 + (n-1)×tick（向上递增）
  const bidFallback = (n: number): number | null =>
    bidBase !== null && tick !== null ? bidBase - n * tick : null
  const askFallback = (n: number): number | null =>
    askBase !== null && tick !== null ? askBase + n * tick : null

  // 买档从上到下：买一 → 买五（买一紧邻卖区）
  const bids = [
    resolveLevel(snapshot.bidPrice1, snapshot.bidVolume1, bidFallback(0)),
    resolveLevel(snapshot.bidPrice2, snapshot.bidVolume2, bidFallback(1)),
    resolveLevel(snapshot.bidPrice3, snapshot.bidVolume3, bidFallback(2)),
    resolveLevel(snapshot.bidPrice4, snapshot.bidVolume4, bidFallback(3)),
    resolveLevel(snapshot.bidPrice5, snapshot.bidVolume5, bidFallback(4)),
  ]

  // 卖档（容器 column-reverse）：视觉从下到上为 卖一 → 卖五，卖一紧邻买区
  const asks = [
    resolveLevel(snapshot.askPrice1, snapshot.askVolume1, askFallback(0)),
    resolveLevel(snapshot.askPrice2, snapshot.askVolume2, askFallback(1)),
    resolveLevel(snapshot.askPrice3, snapshot.askVolume3, askFallback(2)),
    resolveLevel(snapshot.askPrice4, snapshot.askVolume4, askFallback(3)),
    resolveLevel(snapshot.askPrice5, snapshot.askVolume5, askFallback(4)),
  ]

  // 合成档位可点击回填；完全无价的档位置灰不可点
  const isClickable = (level: DepthLevel) => level.valid || level.fallback !== null

  const renderPrice = (level: DepthLevel) => {
    if (level.valid) return level.price
    if (level.fallback !== null && tick !== null) return formatTickPrice(level.price, tick)
    return '--'
  }

  return (
    <div className="depth-quote">
      <div className="depth-quote__header">
        <span className="depth-quote__instrument">{snapshot.instrumentID}</span>
        <span className="depth-quote__last">{snapshot.lastPrice}</span>
      </div>
      <div className="depth-quote__body">
        <div className="depth-quote__asks">
          {asks.map((level, i) => (
            <div
              key={`ask-${i}`}
              className={`depth-quote__row depth-quote__row--ask${!isClickable(level) ? ' depth-quote__row--invalid' : ''}`}
              data-testid={`ask-${i + 1}`}
              onClick={() => isClickable(level) && onBuyClick?.(level.price)}
            >
              <span className="depth-quote__label">卖{i + 1}</span>
              <span className="depth-quote__price">{renderPrice(level)}</span>
              <span className="depth-quote__volume">{level.valid ? level.volume : '--'}</span>
            </div>
          ))}
        </div>
        <div className="depth-quote__bids">
          {bids.map((level, i) => (
            <div
              key={`bid-${i}`}
              className={`depth-quote__row depth-quote__row--bid${!isClickable(level) ? ' depth-quote__row--invalid' : ''}`}
              data-testid={`bid-${i + 1}`}
              onClick={() => isClickable(level) && onSellClick?.(level.price)}
            >
              <span className="depth-quote__label">买{i + 1}</span>
              <span className="depth-quote__price">{renderPrice(level)}</span>
              <span className="depth-quote__volume">{level.valid ? level.volume : '--'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
