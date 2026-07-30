import { describe, it, expect } from 'vitest'
import { calcVolumeMA, calcBoll, calcKDJ, calcRSI } from './indicators'
import type { KLineData } from '@/services/types'

// Helper to create KLineData
function makeKLine(overrides: Partial<KLineData> = {}): KLineData {
  return {
    timestamp: 1000,
    open: 100,
    high: 105,
    low: 98,
    close: 103,
    volume: 500,
    openInterest: 1000,
    ...overrides,
  }
}

describe('calcVolumeMA', () => {
  it('空数据返回空数组', () => {
    expect(calcVolumeMA([], 5)).toEqual([])
  })

  it('数据不足返回null', () => {
    const data = [makeKLine({ volume: 100 }), makeKLine({ volume: 200 })]
    expect(calcVolumeMA(data, 5)).toEqual([null, null])
  })

  it('正常数据返回正确MA值', () => {
    const data = [
      makeKLine({ volume: 100 }),
      makeKLine({ volume: 200 }),
      makeKLine({ volume: 300 }),
      makeKLine({ volume: 400 }),
      makeKLine({ volume: 500 }),
    ]
    // MA5 of volume: (100+200+300+400+500)/5 = 300
    expect(calcVolumeMA(data, 5)).toEqual([null, null, null, null, 300])
  })
})

describe('calcBoll', () => {
  it('空数据返回空对象', () => {
    expect(calcBoll([], 20)).toEqual({ upper: [], middle: [], lower: [] })
  })

  it('数据不足返回null', () => {
    const data = [makeKLine({ close: 100 }), makeKLine({ close: 105 })]
    const result = calcBoll(data, 20)
    expect(result.upper).toEqual([null, null])
    expect(result.middle).toEqual([null, null])
    expect(result.lower).toEqual([null, null])
  })

  it('正常数据返回正确的布林带', () => {
    // 创建20个数据点
    const data = Array.from({ length: 20 }, (_, i) =>
      makeKLine({ close: 100 + i })
    )
    const result = calcBoll(data, 20)
    // 最后一个点应该有值
    expect(result.upper[19]).not.toBeNull()
    expect(result.middle[19]).not.toBeNull()
    expect(result.lower[19]).not.toBeNull()
    // middle = MA20 of close
    const expectedMiddle = data.reduce((sum, d) => sum + d.close, 0) / 20
    expect(result.middle[19]).toBeCloseTo(expectedMiddle, 2)
  })
})

describe('calcKDJ', () => {
  it('空数据返回空对象', () => {
    expect(calcKDJ([], 9)).toEqual({ k: [], d: [], j: [] })
  })

  it('数据不足返回null', () => {
    const data = [makeKLine(), makeKLine()]
    const result = calcKDJ(data, 9)
    expect(result.k).toEqual([null, null])
    expect(result.d).toEqual([null, null])
    expect(result.j).toEqual([null, null])
  })

  it('正常数据返回KDJ值', () => {
    const data = Array.from({ length: 10 }, (_, i) =>
      makeKLine({
        high: 110 + i,
        low: 90 + i,
        close: 100 + i,
      })
    )
    const result = calcKDJ(data, 9)
    // 第9个点开始有值
    expect(result.k[8]).not.toBeNull()
    expect(result.d[8]).not.toBeNull()
    expect(result.j[8]).not.toBeNull()
  })
})

describe('calcRSI', () => {
  it('空数据返回空数组', () => {
    expect(calcRSI([], 14)).toEqual([])
  })

  it('数据不足返回null', () => {
    const data = [makeKLine({ close: 100 }), makeKLine({ close: 105 })]
    expect(calcRSI(data, 14)).toEqual([null, null])
  })

  it('正常数据返回RSI值', () => {
    // 需要至少 period + 1 个数据点
    const data = Array.from({ length: 20 }, (_, i) =>
      makeKLine({ close: 100 + (i % 2 === 0 ? 1 : -1) })
    )
    const result = calcRSI(data, 14)
    // 第15个点开始有值（需要 period + 1 个数据点）
    expect(result[14]).not.toBeNull()
    // RSI应该在0-100之间
    expect(result[14]).toBeGreaterThanOrEqual(0)
    expect(result[14]).toBeLessThanOrEqual(100)
  })
})
