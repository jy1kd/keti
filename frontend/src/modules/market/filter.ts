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
