import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { computeFilterOptions, filterByExchangeAndProduct } from './filter'
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

describe('computeFilterOptions', () => {
  const list = [
    c('FG609', 'CZCE', 'FG'), c('cu2609', 'SHFE', 'cu'),
    c('MA609', 'CZCE', 'MA'), c('MA610', 'CZCE', 'MA'),
  ]
  it('未选任何筛选时列出全部交易所与品种', () => {
    const r = computeFilterOptions(list, [], [], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE', 'SHFE'])
    expect(r.products).toEqual(['FG', 'cu', 'MA'])
  })
  it('选品种后交易所只剩有该品种的交易所', () => {
    const r = computeFilterOptions(list, [], ['MA'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
  })
  it('选交易所后品种只剩该所有合约的品种', () => {
    const r = computeFilterOptions(list, ['SHFE'], [], (x) => x.productID)
    expect(r.products).toEqual(['cu'])
  })
  it('已选品种与已选交易所交集（不影响可用项）', () => {
    const r = computeFilterOptions(list, ['CZCE'], ['FG'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
    expect(r.products).toEqual(['FG', 'MA'])
  })
})
