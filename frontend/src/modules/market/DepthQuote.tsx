import type { MarketSnapshot } from '@/services/types'

interface DepthQuoteProps {
  snapshot: MarketSnapshot | null
  onBuyClick?: (price: number) => void
  onSellClick?: (price: number) => void
}

export function DepthQuote({ snapshot }: DepthQuoteProps) {
  if (!snapshot) {
    return <div className="depth-quote depth-quote--empty">--</div>
  }

  const bids = [
    { price: snapshot.bidPrice5, volume: snapshot.bidVolume5 },
    { price: snapshot.bidPrice4, volume: snapshot.bidVolume4 },
    { price: snapshot.bidPrice3, volume: snapshot.bidVolume3 },
    { price: snapshot.bidPrice2, volume: snapshot.bidVolume2 },
    { price: snapshot.bidPrice1, volume: snapshot.bidVolume1 },
  ]

  const asks = [
    { price: snapshot.askPrice1, volume: snapshot.askVolume1 },
    { price: snapshot.askPrice2, volume: snapshot.askVolume2 },
    { price: snapshot.askPrice3, volume: snapshot.askVolume3 },
    { price: snapshot.askPrice4, volume: snapshot.askVolume4 },
    { price: snapshot.askPrice5, volume: snapshot.askVolume5 },
  ]

  return (
    <div className="depth-quote">
      <div className="depth-quote__header">
        <span className="depth-quote__instrument">{snapshot.instrumentID}</span>
        <span className="depth-quote__last">{snapshot.lastPrice}</span>
      </div>
      <div className="depth-quote__body">
        <div className="depth-quote__asks">
          {asks.map((level, i) => (
            <div key={`ask-${i}`} className="depth-quote__row depth-quote__row--ask">
              <span className="depth-quote__label">卖{i + 1}</span>
              <span className="depth-quote__price">{level.price}</span>
              <span className="depth-quote__volume">{level.volume}</span>
            </div>
          ))}
        </div>
        <div className="depth-quote__bids">
          {bids.map((level, i) => (
            <div key={`bid-${i}`} className="depth-quote__row depth-quote__row--bid">
              <span className="depth-quote__label">买{5 - i}</span>
              <span className="depth-quote__price">{level.price}</span>
              <span className="depth-quote__volume">{level.volume}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
