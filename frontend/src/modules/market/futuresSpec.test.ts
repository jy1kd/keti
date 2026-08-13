import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { futuresSpec } from './futuresSpec'

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }

describe('futuresSpec', () => {
  it('列定义含合约/品种/交易所/最新价等', () => {
    expect(futuresSpec.columns.map((c) => c.field)).toEqual(
      expect.arrayContaining(['instrumentID', 'productName', 'exchangeID', 'lastPrice', 'change']),
    )
  })

  it('无快照时 buildRecord 产出 kind=normal 与占位行情', () => {
    const r = futuresSpec.buildRecord(fut, undefined, false)
    expect(r.kind).toBe('normal')
    expect(r.instrumentID).toBe('FG609')
    expect(r.lastPrice).toBe('--')
  })
})
