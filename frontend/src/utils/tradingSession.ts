/**
 * 交易时段判定 —— 与 server/start.py 保持一致（SimNow 标准仿真 30011 仅交易时段可靠推行情）。
 *
 * 商品期货日盘: 09:00-10:15 / 10:30-11:30 / 13:30-15:00（10:15-10:30 休市）
 * 商品期货夜盘: 21:00 起，至次日 02:30（最晚收盘，覆盖贵金属；多数品种更早收）
 * 中金所 IF/IO: 09:30-11:30 / 13:00-15:00（无夜盘）—— 本工具按商品时段判定
 *
 * 周末无交易。夜盘跨日（如周一 01:30）按交易日判定；周末凌晨（周六 00:00-02:30
 * 等）与后端 select_addresses 一致判定为非交易时段。
 */
export type TradingSessionStatus = '交易时段（商品日盘）' | '交易时段（商品夜盘）' | '非交易时段'

/** 自零点起的分钟数 */
function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** 商品期货是否处于日盘/夜盘交易窗口（不区分周末，与后端 _is_commodity_trading_time 一致） */
function inTradingHours(minutes: number): boolean {
  // 夜盘 21:00 之后 → 次日 02:30 之前（跨日）
  if (minutes >= 21 * 60 || minutes < 2 * 60 + 30) return true
  // 日盘
  if (minutes >= 9 * 60 && minutes < 10 * 60 + 15) return true
  if (minutes >= 10 * 60 + 30 && minutes < 11 * 60 + 30) return true
  if (minutes >= 13 * 60 + 30 && minutes < 15 * 60) return true
  return false
}

/** 是否处于交易时段（工作日 + 日盘/夜盘），与后端 select_addresses 的 is_weekday 判定一致 */
export function isInTradingSession(date: Date = new Date()): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return false // 周末无交易
  return inTradingHours(minutesOfDay(date))
}

/** 返回交易时段状态文案（日盘 / 夜盘 / 非交易时段） */
export function getTradingSessionStatus(date: Date = new Date()): TradingSessionStatus {
  if (!isInTradingSession(date)) return '非交易时段'
  const minutes = minutesOfDay(date)
  const isNight = minutes >= 21 * 60 || minutes < 2 * 60 + 30
  return isNight ? '交易时段（商品夜盘）' : '交易时段（商品日盘）'
}
