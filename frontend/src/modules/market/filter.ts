import type { ContractInfo } from '@/services/types'

export interface MarketFilter {
  exchanges: string[]
  products: string[]
}

export const EMPTY_FILTER: MarketFilter = { exchanges: [], products: [] }

/** 交易所/品种多选过滤；空集=不限；命中 = exchange ∈ exchanges(或空) 且 product ∈ products(或空) */
export function filterByExchangeAndProduct(
  contracts: ContractInfo[],
  exchanges: string[],
  products: string[],
  getProduct: (c: ContractInfo) => string,
): ContractInfo[] {
  const exSet = exchanges.length ? new Set(exchanges) : null
  const prodSet = products.length ? new Set(products) : null
  return contracts.filter((c) => {
    if (exSet && !exSet.has(c.exchangeID)) return false
    if (prodSet && !prodSet.has(getProduct(c))) return false
    return true
  })
}

/** 筛选面板动态选项（交易所↔品种交叉联动）：
 *  - exchanges = 有合约满足「已选品种(或空)」的交易所
 *  - products  = 有合约满足「已选交易所(或空)」的品种
 *  每侧只被「另一侧」的已选项约束；保契约插入顺序（期货页已按 交易所→品种→月份 排序）。
 *  已选项若被交叉过滤掉，由调用方（ContractFilter）并回展示列表以保证可取消。 */
export function computeFilterOptions(
  contracts: ContractInfo[],
  exchanges: string[],
  products: string[],
  getProduct: (c: ContractInfo) => string,
): { exchanges: string[]; products: string[] } {
  const exSet = exchanges.length ? new Set(exchanges) : null
  const prodSet = products.length ? new Set(products) : null
  // 可选交易所：有合约满足已选品种（若有）的交易所
  const ex = new Set<string>()
  // 可选品种：有合约满足已选交易所（若有）的品种
  const prod = new Set<string>()
  for (const c of contracts) {
    if (!prodSet || prodSet.has(getProduct(c))) ex.add(c.exchangeID)
    if (!exSet || exSet.has(c.exchangeID)) prod.add(getProduct(c))
  }
  return { exchanges: [...ex], products: [...prod] }
}
