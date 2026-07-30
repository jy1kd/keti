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
