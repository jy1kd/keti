import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { optionsSpec } from './optionsSpec'

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const opt: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }

describe('optionsSpec', () => {
  it('列定义含 类型/行权价', () => {
    expect(optionsSpec.columns.map((c) => c.field)).toEqual(
      expect.arrayContaining(['contractType', 'strikePrice']),
    )
  })

  it('标底行 kind=underlying 且类型列为「标」', () => {
    const r = optionsSpec.buildRecord(fut, undefined, false)
    expect(r.kind).toBe('underlying')
    expect(r.contractType).toBe('标')
  })

  it('期权行 kind=option 且类型列 C/P、行权价填充', () => {
    const r = optionsSpec.buildRecord(opt, undefined, false)
    expect(r.kind).toBe('option')
    expect(r.contractType).toBe('C')
    expect(r.strikePrice).toBe(1300)
  })

  it('标底行记录只含名称与 kind，行情字段置空', () => {
    const r = optionsSpec.buildRecord(fut /* productClass '1' FG609 */, undefined, false)
    expect(r.kind).toBe('underlying')
    expect(r.instrumentID).toBe('FG609')
    expect(r.contractType).toBe('标')
    // 不再填充行情数据字段（整行合并后只显示名称）
    expect(r.lastPrice).toBeUndefined()
    expect(r.change).toBeUndefined()
    expect(r.bidPrice1).toBeUndefined()
  })
})
