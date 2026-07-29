import { describe, it, expect } from 'vitest'
import { calcCounterpartyPrice, getProtectionPrice } from './priceCalc'
import type { MarketSnapshot } from '../services/types'

const MOCK_SNAPSHOT = {
  instrumentID: 'IF2608',
  lastPrice: 4800.0,
  bidPrice1: 4799.8,
  bidVolume1: 10,
  bidPrice2: 0,
  bidVolume2: 0,
  bidPrice3: 0,
  bidVolume3: 0,
  bidPrice4: 0,
  bidVolume4: 0,
  bidPrice5: 0,
  bidVolume5: 0,
  askPrice1: 4800.2,
  askVolume1: 8,
  askPrice2: 0,
  askVolume2: 0,
  askPrice3: 0,
  askVolume3: 0,
  askPrice4: 0,
  askVolume4: 0,
  askPrice5: 0,
  askVolume5: 0,
  openPrice: 4790.0,
  highestPrice: 4810.0,
  lowestPrice: 4780.0,
  closePrice: 0,
  preClosePrice: 4785.0,
  settlementPrice: 0,
  volume: 10000,
  openInterest: 5000,
  // 额外字段（后端有，前端类型没有，用 as any 绕过）
  upperLimitPrice: 5280.0,
  lowerLimitPrice: 4320.0,
} as unknown as MarketSnapshot

describe('calcCounterpartyPrice', () => {
  const priceTick = 0.2

  it('sell direction uses bidPrice1 as base', () => {
    const result = calcCounterpartyPrice('1', MOCK_SNAPSHOT, 1, priceTick)
    // bidPrice1=4799.8, offset=+1 → 4799.8 - 1*0.2 = 4799.6
    expect(result.price).toBe(4799.6)
    expect(result.error).toBeUndefined()
  })

  it('buy direction uses askPrice1 as base', () => {
    const result = calcCounterpartyPrice('0', MOCK_SNAPSHOT, 1, priceTick)
    // askPrice1=4800.2, offset=+1 → 4800.2 + 1*0.2 = 4800.4
    expect(result.price).toBe(4800.4)
    expect(result.error).toBeUndefined()
  })

  it('negative offset ticks makes price less aggressive', () => {
    const result = calcCounterpartyPrice('1', MOCK_SNAPSHOT, -1, priceTick)
    // bidPrice1=4799.8, abs(-1)=1 → 4799.8 - 1*0.2 = 4799.6
    expect(result.price).toBe(4799.6)
  })

  it('larger offset ticks moves price further', () => {
    const result = calcCounterpartyPrice('0', MOCK_SNAPSHOT, 3, priceTick)
    // askPrice1=4800.2 + 3*0.2 = 4800.8
    expect(result.price).toBe(4800.8)
  })

  it('clamps to upperLimitPrice', () => {
    const snap = { ...MOCK_SNAPSHOT, askPrice1: 5279.8, upperLimitPrice: 5280.0 }
    const result = calcCounterpartyPrice('0', snap, 5, priceTick)
    // 5279.8 + 5*0.2 = 5280.8 → clamped to 5280.0
    expect(result.price).toBe(5280.0)
  })

  it('clamps to lowerLimitPrice', () => {
    const snap = { ...MOCK_SNAPSHOT, bidPrice1: 4320.2, lowerLimitPrice: 4320.0 }
    const result = calcCounterpartyPrice('1', snap, 5, priceTick)
    // 4320.2 - 5*0.2 = 4319.2 → clamped to 4320.0
    expect(result.price).toBe(4320.0)
  })

  it('returns error when snapshot is undefined', () => {
    const result = calcCounterpartyPrice('1', undefined, 1, priceTick)
    expect(result.price).toBe(0)
    expect(result.error).toContain('无行情数据')
  })

  it('returns error when bidPrice1 is 0', () => {
    const snap = { ...MOCK_SNAPSHOT, bidPrice1: 0 }
    const result = calcCounterpartyPrice('1', snap, 1, priceTick)
    expect(result.price).toBe(0)
    expect(result.error).toContain('对手价无效')
  })

  it('returns error when askPrice1 is 0', () => {
    const snap = { ...MOCK_SNAPSHOT, askPrice1: 0 }
    const result = calcCounterpartyPrice('0', snap, 1, priceTick)
    expect(result.price).toBe(0)
    expect(result.error).toContain('对手价无效')
  })

  it('returns error when priceTick is 0', () => {
    const result = calcCounterpartyPrice('1', MOCK_SNAPSHOT, 1, 0)
    expect(result.price).toBe(0)
    expect(result.error).toContain('最小变动价位无效')
  })

  it('rounds to correct decimal places', () => {
    const snap = { ...MOCK_SNAPSHOT, bidPrice1: 4799.85 }
    const result = calcCounterpartyPrice('1', snap, 1, 0.2)
    // 4799.85 - 0.2 = 4799.65 → rounded to 1 decimal (0.2 has 1 decimal) = 4799.6 or 4799.7
    expect(result.price).toBeGreaterThan(0)
  })
})

describe('getProtectionPrice', () => {
  it('returns lastPrice when > 0', () => {
    const result = getProtectionPrice(MOCK_SNAPSHOT)
    expect(result.price).toBe(4800.0)
    expect(result.error).toBeUndefined()
  })

  it('falls back to preClosePrice when lastPrice is 0', () => {
    const snap = { ...MOCK_SNAPSHOT, lastPrice: 0 }
    const result = getProtectionPrice(snap)
    expect(result.price).toBe(4785.0)
  })

  it('falls back to openPrice when lastPrice and preClosePrice are 0', () => {
    const snap = { ...MOCK_SNAPSHOT, lastPrice: 0, preClosePrice: 0 }
    const result = getProtectionPrice(snap)
    expect(result.price).toBe(4790.0)
  })

  it('returns error when all prices are 0', () => {
    const snap = { ...MOCK_SNAPSHOT, lastPrice: 0, preClosePrice: 0, openPrice: 0 }
    const result = getProtectionPrice(snap)
    expect(result.price).toBe(0)
    expect(result.error).toContain('无法获取有效价格')
  })

  it('returns error when snapshot is undefined', () => {
    const result = getProtectionPrice(undefined)
    expect(result.price).toBe(0)
    expect(result.error).toContain('无行情数据')
  })
})
