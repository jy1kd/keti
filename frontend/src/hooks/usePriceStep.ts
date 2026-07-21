import { useState, useEffect } from 'react'

export function usePriceStep(initialPrice: number, priceTick: number) {
  const [price, setPrice] = useState(initialPrice)

  // Sync when initialPrice changes externally
  useEffect(() => {
    setPrice(initialPrice)
  }, [initialPrice])

  const stepUp = () => {
    setPrice((prev) => {
      const next = roundToDecimals(prev + priceTick, priceTick)
      return Math.max(0, next)
    })
  }

  const stepDown = () => {
    setPrice((prev) => {
      const next = roundToDecimals(prev - priceTick, priceTick)
      return Math.max(0, next)
    })
  }

  const alignToTick = (value: number) => {
    if (priceTick <= 0) {
      setPrice(value)
      return
    }
    const rounded = Math.round(value / priceTick) * priceTick
    setPrice(roundToDecimals(rounded, priceTick))
  }

  return { price, stepUp, stepDown, alignToTick }
}

/** Round to the number of decimal places implied by the tick size (e.g. 0.05 → 2 decimals) */
function roundToDecimals(value: number, tick: number): number {
  if (tick <= 0) return value
  const decimals = Math.max(0, Math.ceil(-Math.log10(tick)))
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
