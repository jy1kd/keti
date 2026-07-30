import type { KLineData } from '@/services/types'

/**
 * 计算成交量移动平均线
 * @param data K线数据数组
 * @param period 周期（如5、10、20）
 * @returns 每个数据点的成交量MA值，数据不足时返回null
 */
export function calcVolumeMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].volume
    }
    return sum / period
  })
}

/**
 * 计算布林带（BOLL）
 * @param data K线数据数组
 * @param period 周期（默认20）
 * @returns { upper, middle, lower } 每个数据点的布林带值
 */
export function calcBoll(data: KLineData[], period: number = 20): {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
} {
  if (data.length === 0) {
    return { upper: [], middle: [], lower: [] }
  }

  const middle: (number | null)[] = []
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      middle.push(null)
      upper.push(null)
      lower.push(null)
      continue
    }

    // 计算MA
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close
    }
    const ma = sum / period

    // 计算标准差
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      variance += (data[j].close - ma) ** 2
    }
    const std = Math.sqrt(variance / period)

    middle.push(ma)
    upper.push(ma + 2 * std)
    lower.push(ma - 2 * std)
  }

  return { upper, middle, lower }
}

/**
 * 计算KDJ指标
 * @param data K线数据数组
 * @param period 周期（默认9）
 * @returns { k, d, j } 每个数据点的KDJ值
 */
export function calcKDJ(data: KLineData[], period: number = 9): {
  k: (number | null)[]
  d: (number | null)[]
  j: (number | null)[]
} {
  if (data.length === 0) {
    return { k: [], d: [], j: [] }
  }

  const k: (number | null)[] = []
  const d: (number | null)[] = []
  const j: (number | null)[] = []

  let prevK = 50
  let prevD = 50

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      k.push(null)
      d.push(null)
      j.push(null)
      continue
    }

    // 计算RSV
    let highest = -Infinity
    let lowest = Infinity
    for (let x = i - period + 1; x <= i; x++) {
      highest = Math.max(highest, data[x].high)
      lowest = Math.min(lowest, data[x].low)
    }

    const rsv = highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100

    // 计算K、D、J
    const kValue = (2 / 3) * prevK + (1 / 3) * rsv
    const dValue = (2 / 3) * prevD + (1 / 3) * kValue
    const jValue = 3 * kValue - 2 * dValue

    k.push(kValue)
    d.push(dValue)
    j.push(jValue)

    prevK = kValue
    prevD = dValue
  }

  return { k, d, j }
}

/**
 * 计算RSI指标
 * @param data K线数据数组
 * @param period 周期（默认14）
 * @returns 每个数据点的RSI值
 */
export function calcRSI(data: KLineData[], period: number = 14): (number | null)[] {
  if (data.length === 0) {
    return []
  }

  const result: (number | null)[] = []

  // RSI需要至少 period + 1 个数据点（因为需要计算涨跌幅）
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null)
      continue
    }

    // 计算涨幅和跌幅
    let gainSum = 0
    let lossSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const change = data[j].close - data[j - 1].close
      if (change > 0) {
        gainSum += change
      } else {
        lossSum += Math.abs(change)
      }
    }

    const avgGain = gainSum / period
    const avgLoss = lossSum / period

    if (avgLoss === 0) {
      result.push(100)
    } else {
      const rs = avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }

  return result
}
