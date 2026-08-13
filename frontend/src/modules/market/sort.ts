import type { ContractInfo } from '@/services/types'

/** 交易所展示顺序 */
const EXCHANGE_ORDER = ['SHFE', 'DCE', 'CZCE', 'CFFEX', 'INE', 'GFEX']

function exchangeRank(exchangeID: string): number {
  const i = EXCHANGE_ORDER.indexOf(exchangeID)
  return i === -1 ? EXCHANGE_ORDER.length : i
}

/** 数字自然比较：FG609 < FG610 < FG701（按数字段数值比较，非字符串序） */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** 期货排序：交易所固定顺序 → 品种字典序 → 合约月份数字升序 */
export function sortFutures(contracts: ContractInfo[]): ContractInfo[] {
  return [...contracts].sort((a, b) => {
    const ex = exchangeRank(a.exchangeID) - exchangeRank(b.exchangeID)
    if (ex !== 0) return ex
    const prod = a.productID.localeCompare(b.productID)
    if (prod !== 0) return prod
    return naturalCompare(a.instrumentID, b.instrumentID)
  })
}

/** 从标底 ID 去尾数字得品种（FG609 → FG） */
export function deriveUnderlyingProduct(underlyingInstrID: string): string {
  return underlyingInstrID.replace(/\d+$/, '')
}

export interface OptionGroup {
  underlyingID: string
  /** 期货列表中匹配到的标的合约；找不到（如指数期权 IO/HO/MO）为 undefined */
  underlying: ContractInfo | undefined
  options: ContractInfo[]
}

/** 期权分组 + 组内排序：标底自然升序；组内 到期日 → 类型(C前P后) → 行权价升序 */
export function groupOptionsByUnderlying(
  options: ContractInfo[],
  futures: ContractInfo[],
): OptionGroup[] {
  const futMap = new Map(futures.map((f) => [f.instrumentID, f]))
  const groups = new Map<string, ContractInfo[]>()
  for (const o of options) {
    const u = o.underlyingInstrID ?? ''
    if (!groups.has(u)) groups.set(u, [])
    groups.get(u)!.push(o)
  }
  const result: OptionGroup[] = []
  for (const [u, opts] of groups) {
    opts.sort((a, b) => {
      const d = (a.expireDate || '').localeCompare(b.expireDate || '')
      if (d !== 0) return d
      const t = (a.optionsType || '').localeCompare(b.optionsType || '')
      if (t !== 0) return t
      return (a.strikePrice ?? 0) - (b.strikePrice ?? 0)
    })
    result.push({ underlyingID: u, underlying: futMap.get(u), options: opts })
  }
  result.sort((a, b) => naturalCompare(a.underlyingID, b.underlyingID))
  return result
}
