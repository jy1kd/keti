import type { ContractInfo } from '@/services/types'

/**
 * 合约步进 — 纯逻辑（解析 / 月份步进 / 品种步进）
 *
 * CTP 标准期货代码形如 `IF2608`（品种字母 + 4 位 YYMM）。
 * 期权（`IO2608-C-4700`）与套利（`SPD ...`）不在此解析范围，返回 null → 步进控件禁用。
 */

export interface ParsedInstrument {
  product: string
  /** 完整年份，如 2026 */
  year: number
  /** 1-12 */
  month: number
}

/** 解析标准期货代码 `<letters><4位YYMM>`；非标准代码返回 null */
export function parseInstrumentCode(code: string): ParsedInstrument | null {
  const m = /^([A-Za-z]+)(\d{4})$/.exec(code)
  if (!m) return null
  const product = m[1]
  const yy = Number(m[2].slice(0, 2))
  const month = Number(m[2].slice(2, 4))
  if (month < 1 || month > 12) return null
  return { product, year: 2000 + yy, month }
}

/** 由解析结果还原 YYMM 代码（年/月补零） */
export function formatInstrumentCode(p: ParsedInstrument): string {
  const yy = String(p.year % 100).padStart(2, '0')
  const mm = String(p.month).padStart(2, '0')
  return `${p.product}${yy}${mm}`
}

/** 月份 ±1（跨年进位），非期货代码返回 null */
export function stepMonth(code: string, dir: 1 | -1): string | null {
  const p = parseInstrumentCode(code)
  if (!p) return null
  let { year, month } = p
  month += dir
  if (month > 12) {
    month = 1
    year += 1
  } else if (month < 1) {
    month = 12
    year -= 1
  }
  return formatInstrumentCode({ ...p, year, month })
}

/**
 * 品种顺序（按交易所）— 上下箭头在序列内切换品种。
 * 仅收录主流活跃期货品种；未收录的品种切换返回 null（控件禁用）。
 */
const PRODUCT_ORDER: Record<string, string[]> = {
  CFFEX: ['IF', 'IH', 'IC', 'IM'],
  SHFE: ['CU', 'AL', 'ZN', 'PB', 'NI', 'SN', 'AU', 'AG', 'RB', 'HC', 'SS', 'FU', 'RU', 'SP'],
  DCE: ['A', 'B', 'C', 'CS', 'M', 'Y', 'P', 'I', 'J', 'JM', 'L', 'V', 'PP', 'EG', 'EB', 'PG', 'RR'],
  CZCE: ['SR', 'CF', 'TA', 'OI', 'RM', 'MA', 'FG', 'SA', 'UR', 'AP', 'CJ', 'SF', 'SM'],
  INE: ['SC', 'LU', 'NR', 'BC'],
  GFEX: ['SI', 'LC'],
}

/** 品种 ±1：同交易所序列内切换，返回目标品种首个可交易合约；无目标返回 null */
export function stepProduct(
  code: string,
  dir: 1 | -1,
  contracts: ContractInfo[],
): string | null {
  const p = parseInstrumentCode(code)
  if (!p) return null
  const current = contracts.find((c) => c.instrumentID === code)
  if (!current) return null
  const order = PRODUCT_ORDER[current.exchangeID]
  if (!order) return null
  const idx = order.indexOf(p.product)
  if (idx < 0) return null
  const nextIdx = idx + dir
  if (nextIdx < 0 || nextIdx >= order.length) return null
  const nextProduct = order[nextIdx]
  const target = contracts.find(
    (c) => c.productID === nextProduct && c.exchangeID === current.exchangeID && c.isTrading === 1,
  )
  return target ? target.instrumentID : null
}
