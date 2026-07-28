interface SpreadDisplayProps {
  bidPrice: number
  askPrice: number
}

const CTP_INVALID_PRICE = 1.7976931348623157e+308
const isValidPrice = (p: number) => p > 0 && p < CTP_INVALID_PRICE

export function SpreadDisplay({ bidPrice, askPrice }: SpreadDisplayProps) {
  if (!isValidPrice(bidPrice) || !isValidPrice(askPrice)) {
    return (
      <div className="spread-display">
        <span className="spread-display__label">价差</span>
        <span className="spread-display__value">--</span>
      </div>
    )
  }

  const spread = askPrice - bidPrice

  return (
    <div className="spread-display">
      <span className="spread-display__label">价差</span>
      <span className="spread-display__value">{spread.toFixed(2)}</span>
    </div>
  )
}
