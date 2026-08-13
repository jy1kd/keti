import type { MarketSnapshot } from '@/services/types'

export const CTP_INVALID_PRICE = 1.7976931348623157e308

export function isValidPrice(p: number): boolean {
  return Number.isFinite(p) && p > 0 && p < CTP_INVALID_PRICE
}

export function tickDecimals(tick: number): number {
  const str = String(tick)
  return str.includes('.') ? str.split('.')[1].length : 0
}

export function formatTickPrice(n: number, tick: number): string {
  return n.toFixed(tickDecimals(tick))
}

export function roundToTick(v: number, tick: number): number {
  const decimals = tickDecimals(tick)
  return Number((Math.round(v / tick) * tick).toFixed(decimals))
}

/** 从跌停到涨停生成升序、tick 对齐的完整价格轴；无效输入返回空数组。 */
export function buildPriceAxis(lowerLimit: number, upperLimit: number, tick: number): number[] {
  if (tick <= 0) return []
  if (!isValidPrice(lowerLimit) || !isValidPrice(upperLimit)) return []
  const lower = Math.round(lowerLimit / tick) * tick
  const upper = Math.round(upperLimit / tick) * tick
  if (upper <= lower) return []
  const steps = Math.round((upper - lower) / tick)
  const decimals = tickDecimals(tick)
  const out: number[] = new Array(steps + 1)
  for (let i = 0; i <= steps; i++) {
    out[i] = Number((lower + i * tick).toFixed(decimals))
  }
  return out
}

/** 提取快照五档买/卖量到 price→volume 映射（仅有效价）。 */
export function buildDepthMaps(snapshot: MarketSnapshot): {
  bidVol: Map<number, number>
  askVol: Map<number, number>
} {
  const bidVol = new Map<number, number>()
  const askVol = new Map<number, number>()
  const levels: Array<[number, number, number, number]> = [
    [snapshot.bidPrice1, snapshot.bidVolume1, snapshot.askPrice1, snapshot.askVolume1],
    [snapshot.bidPrice2, snapshot.bidVolume2, snapshot.askPrice2, snapshot.askVolume2],
    [snapshot.bidPrice3, snapshot.bidVolume3, snapshot.askPrice3, snapshot.askVolume3],
    [snapshot.bidPrice4, snapshot.bidVolume4, snapshot.askPrice4, snapshot.askVolume4],
    [snapshot.bidPrice5, snapshot.bidVolume5, snapshot.askPrice5, snapshot.askVolume5],
  ]
  for (const [bp, bv, ap, av] of levels) {
    if (isValidPrice(bp) && bv > 0) bidVol.set(bp, bv)
    if (isValidPrice(ap) && av > 0) askVol.set(ap, av)
  }
  return { bidVol, askVol }
}
