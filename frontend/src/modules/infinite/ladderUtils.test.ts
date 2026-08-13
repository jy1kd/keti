import { describe, it, expect } from 'vitest'
import { buildPriceAxis, buildDepthMaps, isValidPrice, roundToTick } from './ladderUtils'
import type { MarketSnapshot } from '@/services/types'

function snap(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000, ...overrides,
  } as MarketSnapshot
}

describe('buildPriceAxis', () => {
  it('从跌停到涨停按 tick 生成升序价格轴', () => {
    expect(buildPriceAxis(4690, 4700, 0.2)).toEqual([
      4690, 4690.2, 4690.4, 4690.6, 4690.8,
      4691, 4691.2, 4691.4, 4691.6, 4691.8,
      4692, 4692.2, 4692.4, 4692.6, 4692.8,
      4693, 4693.2, 4693.4, 4693.6, 4693.8,
      4694, 4694.2, 4694.4, 4694.6, 4694.8,
      4695, 4695.2, 4695.4, 4695.6, 4695.8,
      4696, 4696.2, 4696.4, 4696.6, 4696.8,
      4697, 4697.2, 4697.4, 4697.6, 4697.8,
      4698, 4698.2, 4698.4, 4698.6, 4698.8,
      4699, 4699.2, 4699.4, 4699.6, 4699.8, 4700,
    ])
  })

  it('涨跌停价无效时返回空数组', () => {
    expect(buildPriceAxis(0, 4700, 0.2)).toEqual([])
    expect(buildPriceAxis(1.7976931348623157e308, 4700, 0.2)).toEqual([])
  })

  it('tick 无效时返回空数组', () => {
    expect(buildPriceAxis(4690, 4700, 0)).toEqual([])
  })

  it('tick 0.02 精度不产生浮点累积误差', () => {
    const axis = buildPriceAxis(500, 501, 0.02)
    expect(axis).toHaveLength(51)
    expect(axis[50]).toBe(501)
    expect(axis.every((p) => Math.abs(p * 50 - Math.round(p * 50)) < 1e-9)).toBe(true)
  })
})

describe('buildDepthMaps', () => {
  it('只提取有效价的五档买卖量', () => {
    const { bidVol, askVol } = buildDepthMaps(snap())
    expect(bidVol.get(4694)).toBe(10)
    expect(askVol.get(4696)).toBe(15)
    expect(bidVol.size).toBe(1)
    expect(askVol.size).toBe(1)
  })
})

describe('isValidPrice', () => {
  it('过滤 0、负数、DBL_MAX、NaN', () => {
    expect(isValidPrice(100)).toBe(true)
    expect(isValidPrice(0)).toBe(false)
    expect(isValidPrice(-1)).toBe(false)
    expect(isValidPrice(1.7976931348623157e308)).toBe(false)
    expect(isValidPrice(NaN)).toBe(false)
  })
})

describe('roundToTick', () => {
  it('按 tick 对齐并去除浮点噪声', () => {
    expect(roundToTick(4696.000000000001, 0.2)).toBe(4696)
    expect(roundToTick(4696.6, 0.2)).toBe(4696.6)
  })
})
