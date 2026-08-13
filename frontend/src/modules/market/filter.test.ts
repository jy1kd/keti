import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { filterByExchangeAndProduct } from './filter'
import { deriveUnderlyingProduct } from './sort'

const c = (instrumentID: string, exchangeID: string, productID: string, underlyingInstrID?: string): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1', underlyingInstrID })

describe('filterByExchangeAndProduct', () => {
  const list = [c('FG609', 'CZCE', 'FG'), c('cu2609', 'SHFE', 'cu'), c('MA609', 'CZCE', 'MA')]

  it('空集 = 不限', () => {
    expect(filterByExchangeAndProduct(list, [], [], (x) => x.productID).length).toBe(3)
  })

  it('多交易所命中', () => {
    const r = filterByExchangeAndProduct(list, ['SHFE'], [], (x) => x.productID)
    expect(r.map((x) => x.instrumentID)).toEqual(['cu2609'])
  })

  it('交易所与品种叠加（AND）', () => {
    const r = filterByExchangeAndProduct(list, ['CZCE'], ['FG'], (x) => x.productID)
    expect(r.map((x) => x.instrumentID)).toEqual(['FG609'])
  })

  it('期权按标底品种过滤', () => {
    const opts = [c('FG609-C-1300', 'CZCE', 'FGC', 'FG609'), c('MA609-C-1000', 'CZCE', 'MAC', 'MA609')]
    const r = filterByExchangeAndProduct(opts, [], ['FG'], (x) => deriveUnderlyingProduct(x.underlyingInstrID ?? ''))
    expect(r.map((x) => x.instrumentID)).toEqual(['FG609-C-1300'])
  })
})
