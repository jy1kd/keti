import { describe, it, expect } from 'vitest'
import {
  parseInstrumentCode,
  formatInstrumentCode,
  stepMonth,
  stepProduct,
} from './contractStep'
import type { ContractInfo } from '@/services/types'

function contract(instrumentID: string, exchangeID = 'CFFEX'): ContractInfo {
  return {
    instrumentID,
    instrumentName: instrumentID,
    exchangeID,
    productID: instrumentID.replace(/\d+$/, ''),
    volumeMultiple: 1,
    priceTick: 0.2,
    expireDate: '2026-08-15',
    isTrading: 1,
    productClass: '1',
  }
}

describe('parseInstrumentCode', () => {
  it('解析标准期货代码 → 品种/年/月', () => {
    expect(parseInstrumentCode('IF2608')).toEqual({ product: 'IF', year: 2026, month: 8 })
    expect(parseInstrumentCode('au2608')).toEqual({ product: 'au', year: 2026, month: 8 })
    expect(parseInstrumentCode('rb2510')).toEqual({ product: 'rb', year: 2025, month: 10 })
  })

  it('非标准期货代码返回 null（期权 / 套利 / 空串）', () => {
    expect(parseInstrumentCode('IO2608-C-4700')).toBeNull()
    expect(parseInstrumentCode('SPD IF2608-IF2609')).toBeNull()
    expect(parseInstrumentCode('')).toBeNull()
    expect(parseInstrumentCode('IF')).toBeNull()
  })

  it('月份越界返回 null（13 月不合法）', () => {
    expect(parseInstrumentCode('IF2613')).toBeNull()
    expect(parseInstrumentCode('IF2600')).toBeNull()
  })
})

describe('formatInstrumentCode', () => {
  it('年/月补零还原 YYMM', () => {
    expect(formatInstrumentCode({ product: 'IF', year: 2027, month: 1 })).toBe('IF2701')
    expect(formatInstrumentCode({ product: 'rb', year: 2025, month: 12 })).toBe('rb2512')
  })
})

describe('stepMonth 相邻月份步进', () => {
  it('月份 +1 / -1（不跨年）', () => {
    expect(stepMonth('IF2608', 1)).toBe('IF2609')
    expect(stepMonth('IF2608', -1)).toBe('IF2607')
  })

  it('跨年：12月 +1 → 次年 1 月；1 月 -1 → 上年 12 月', () => {
    expect(stepMonth('IF2612', 1)).toBe('IF2701')
    expect(stepMonth('IF2601', -1)).toBe('IF2512')
  })

  it('非期货代码步进返回 null', () => {
    expect(stepMonth('IO2608-C-4700', 1)).toBeNull()
  })
})

describe('stepProduct 品种步进（同交易所）', () => {
  // CFFEX 品种顺序：IF → IH → IC → IM；相邻月份合约都存在时返回首个活跃合约
  const contracts: ContractInfo[] = [
    contract('IF2608'),
    contract('IF2609'),
    contract('IH2608'),
    contract('IC2608'),
    contract('IM2608'),
  ]

  it('IF → IH（下一个品种），返回该品种首个活跃合约', () => {
    expect(stepProduct('IF2608', 1, contracts)).toBe('IH2608')
  })

  it('IH → IF（上一个品种）', () => {
    expect(stepProduct('IH2608', -1, contracts)).toBe('IF2608')
  })

  it('最后一个品种再往后 → null（不可切）', () => {
    expect(stepProduct('IM2608', 1, contracts)).toBeNull()
  })

  it('非当前品种序列内的代码 → null', () => {
    expect(stepProduct('CU2608', 1, contracts)).toBeNull()
  })

  it('目标品种无活跃合约 → null', () => {
    const withoutIM = contracts.filter((c) => c.instrumentID !== 'IM2608')
    // IC 之后应切 IM，但 IM 不存在 → null
    expect(stepProduct('IC2608', 1, withoutIM)).toBeNull()
  })

  it('目标品种存在但全部不可交易 → null', () => {
    const withInactiveIM = [...contracts, contract('IM2608')].map((c) =>
      c.instrumentID === 'IM2608' ? { ...c, isTrading: 0 } : c,
    )
    expect(stepProduct('IC2608', 1, withInactiveIM)).toBeNull()
  })
})
