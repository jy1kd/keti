interface SpreadDisplayProps {
  bidPrice: number
  askPrice: number
}

export function SpreadDisplay({ bidPrice, askPrice }: SpreadDisplayProps) {
  if (bidPrice === 0 && askPrice === 0) {
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
      <span className="spread-display__value">{spread}</span>
    </div>
  )
}
