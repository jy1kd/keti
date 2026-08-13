import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { sortFutures, deriveUnderlyingProduct, groupOptionsByUnderlying, naturalCompare } from './sort'

const fut = (instrumentID: string, exchangeID: string, productID: string): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1' })

const opt = (instrumentID: string, exchangeID: string, productID: string, underlyingInstrID: string, optionsType: string, strikePrice: number, expireDate = '20260930'): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate, isTrading: 1, productClass: '2', underlyingInstrID, optionsType, strikePrice })

describe('naturalCompare', () => {
  it('数字段按数值比较而非字符串', () => {
    expect(['FG701', 'FG609', 'FG610'].sort(naturalCompare)).toEqual(['FG609', 'FG610', 'FG701'])
  })
})

describe('sortFutures', () => {
  it('按 交易所顺序 → 品种 → 月份数字 排序', () => {
    const input = [
      fut('FG610', 'CZCE', 'FG'),
      fut('cu2609', 'SHFE', 'cu'),
      fut('FG609', 'CZCE', 'FG'),
      fut('FG701', 'CZCE', 'FG'),
      fut('MA609', 'CZCE', 'MA'),
    ]
    const out = sortFutures(input).map((c) => c.instrumentID)
    // SHFE 在 CZCE 前
    expect(out[0]).toBe('cu2609')
    // CZCE 内：FG < MA；FG 内月份数字升序
    expect(out.slice(1)).toEqual(['FG609', 'FG610', 'FG701', 'MA609'])
  })

  it('不修改入参数组', () => {
    const input = [fut('FG610', 'CZCE', 'FG'), fut('FG609', 'CZCE', 'FG')]
    sortFutures(input)
    expect(input.map((c) => c.instrumentID)).toEqual(['FG610', 'FG609'])
  })
})

describe('deriveUnderlyingProduct', () => {
  it('去掉标的 ID 尾部数字得到品种', () => {
    expect(deriveUnderlyingProduct('FG609')).toBe('FG')
    expect(deriveUnderlyingProduct('p2609')).toBe('p')
  })
})

describe('groupOptionsByUnderlying', () => {
  it('按标底分组并组内排序：到期日 → 类型(C前P后) → 行权价升序', () => {
    const futures = [fut('FG609', 'CZCE', 'FG'), fut('FG610', 'CZCE', 'FG')]
    const options = [
      opt('FG609-C-1300', 'CZCE', 'FGC', 'FG609', '1', 1300),
      opt('FG609-C-1200', 'CZCE', 'FGC', 'FG609', '1', 1200),
      opt('FG609-P-1250', 'CZCE', 'FGP', 'FG609', '2', 1250),
      opt('FG610-C-1300', 'CZCE', 'FGC', 'FG610', '1', 1300),
    ]
    const groups = groupOptionsByUnderlying(options, futures)
    expect(groups.map((g) => g.underlyingID)).toEqual(['FG609', 'FG610'])
    expect(groups[0].underlying?.instrumentID).toBe('FG609')
    expect(groups[0].options.map((o) => o.instrumentID)).toEqual(['FG609-C-1200', 'FG609-C-1300', 'FG609-P-1250'])
    expect(groups[1].options.map((o) => o.instrumentID)).toEqual(['FG610-C-1300'])
  })

  it('标底不在期货列表时 underlying 为 undefined', () => {
    const groups = groupOptionsByUnderlying([opt('IO2609-C-4000', 'CFFEX', 'IO', 'IO2609', '1', 4000)], [])
    expect(groups[0].underlying).toBeUndefined()
  })
})
