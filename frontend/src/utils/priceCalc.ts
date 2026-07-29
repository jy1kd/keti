/**
 * 对价限价计算工具函数
 *
 * 对价限价 = 对手价 ± N 跳 × priceTick
 * - 卖出（平多/开空）：基准 = bidPrice1，偏移方向：减 N 跳
 * - 买入（平空/开多）：基准 = askPrice1，偏移方向：加 N 跳
 */

import type { MarketSnapshot } from '../services/types'

interface PriceCalcResult {
  price: number
  error?: string
}

/**
 * 计算对价限价
 *
 * @param direction - "0"=买入, "1"=卖出
 * @param snapshot - 行情快照
 * @param offsetTicks - 偏移跳数（正数=更激进，更容易成交）
 * @param priceTick - 最小变动价位
 * @returns 计算结果，包含价格或错误信息
 */
export function calcCounterpartyPrice(
  direction: string,
  snapshot: MarketSnapshot | undefined,
  offsetTicks: number,
  priceTick: number,
): PriceCalcResult {
  if (!snapshot) {
    return { price: 0, error: '无行情数据，无法计算对价' }
  }

  if (priceTick <= 0) {
    return { price: 0, error: '最小变动价位无效' }
  }

  // 确定基准价
  let basePrice: number
  if (direction === '1') {
    // 卖出 → 对手价 = bidPrice1（买一价）
    basePrice = snapshot.bidPrice1
  } else {
    // 买入 → 对手价 = askPrice1（卖一价）
    basePrice = snapshot.askPrice1
  }

  if (!basePrice || basePrice <= 0) {
    return { price: 0, error: '对手价无效，请检查行情' }
  }

  // 计算偏移后的价格
  let price: number
  if (direction === '1') {
    // 卖出：比买一低 N 跳（更激进，更易成交）
    price = basePrice - Math.abs(offsetTicks) * priceTick
  } else {
    // 买入：比卖一高 N 跳（更激进，更易成交）
    price = basePrice + Math.abs(offsetTicks) * priceTick
  }

  // 边界校验：不能超过涨跌停
  if (snapshot.upperLimitPrice > 0 && price > snapshot.upperLimitPrice) {
    price = snapshot.upperLimitPrice
  }
  if (snapshot.lowerLimitPrice > 0 && price < snapshot.lowerLimitPrice) {
    price = snapshot.lowerLimitPrice
  }

  // 四舍五入到 priceTick 的精度
  const decimals = Math.max(0, Math.ceil(-Math.log10(priceTick)))
  price = Number(price.toFixed(decimals))

  return { price }
}

/**
 * 获取市价单保护价（前端回退逻辑）
 * 回退顺序：lastPrice → preClosePrice → openPrice
 */
export function getProtectionPrice(
  snapshot: MarketSnapshot | undefined,
): PriceCalcResult {
  if (!snapshot) {
    return { price: 0, error: '无行情数据，请先订阅行情' }
  }

  for (const key of ['lastPrice', 'preClosePrice', 'openPrice'] as const) {
    const val = snapshot[key]
    if (typeof val === 'number' && val > 0) {
      return { price: val }
    }
  }

  return { price: 0, error: '无法获取有效价格' }
}
