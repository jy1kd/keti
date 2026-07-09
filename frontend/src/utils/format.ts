/**
 * 格式化价格 — 保留2位小数，无效值返回 '--'
 */
export function formatPrice(price: number): string {
  if (price == null || price <= 0) return '--'
  return price.toFixed(2)
}

/**
 * 格式化数量 — 加千分位逗号
 */
export function formatVolume(volume: number): string {
  if (volume == null) return '--'
  return volume.toLocaleString('en-US')
}

/**
 * 格式化时间 — 已是 HH:MM:SS 则原样返回，空值返回 '--'
 */
export function formatTime(time: string): string {
  if (!time) return '--'
  return time
}

/**
 * 格式化涨跌 — 正数带+号，保留2位小数
 */
export function formatChange(change: number): string {
  if (change > 0) return `+${change.toFixed(2)}`
  if (change < 0) return change.toFixed(2)
  return '0.00'
}

/**
 * 格式化涨跌幅 — 带+/-号和%，保留2位小数
 */
export function formatPercent(percent: number): string {
  if (percent > 0) return `+${percent.toFixed(2)}%`
  if (percent < 0) return `${percent.toFixed(2)}%`
  return '0.00%'
}
