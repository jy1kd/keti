import { describe, it, expect } from 'vitest'
import {
  toCtpDirection,
  toCtpOffsetFlag,
  toCtpPriceType,
  toCtpTimeCondition,
  toCtpHedgeFlag,
  fromCtpDirection,
  fromCtpOffsetFlag,
  fromCtpOrderStatus,
  convertOrderRequest,
} from './orderMapping'

describe('toCtpDirection', () => {
  it("converts 'buy' to '0'", () => {
    expect(toCtpDirection('buy')).toBe('0')
  })

  it("converts 'sell' to '1'", () => {
    expect(toCtpDirection('sell')).toBe('1')
  })
})

describe('toCtpOffsetFlag', () => {
  it("converts 'open' to '0'", () => {
    expect(toCtpOffsetFlag('open')).toBe('0')
  })

  it("converts 'close' to '1'", () => {
    expect(toCtpOffsetFlag('close')).toBe('1')
  })

  it("converts 'close_today' to '3'", () => {
    expect(toCtpOffsetFlag('close_today')).toBe('3')
  })
})

describe('toCtpPriceType', () => {
  it("converts 'limit' to '2'", () => {
    expect(toCtpPriceType('limit')).toBe('2')
  })

  it("converts 'market' to '1'", () => {
    expect(toCtpPriceType('market')).toBe('1')
  })
})

describe('toCtpTimeCondition', () => {
  it("converts 'gfd' to '3'", () => {
    expect(toCtpTimeCondition('gfd')).toBe('3')
  })

  it("converts 'fok' to '1' (IOC)", () => {
    expect(toCtpTimeCondition('fok')).toBe('1')
  })

  it("converts 'fak' to '1' (IOC)", () => {
    expect(toCtpTimeCondition('fak')).toBe('1')
  })
})

describe('toCtpHedgeFlag', () => {
  it("converts 'speculation' to '1'", () => {
    expect(toCtpHedgeFlag('speculation')).toBe('1')
  })

  it("converts 'arbitrage' to '2'", () => {
    expect(toCtpHedgeFlag('arbitrage')).toBe('2')
  })

  it("converts 'hedge' to '3'", () => {
    expect(toCtpHedgeFlag('hedge')).toBe('3')
  })
})

describe('fromCtpDirection', () => {
  it("converts '0' to 'buy'", () => {
    expect(fromCtpDirection('0')).toBe('buy')
  })

  it("converts '1' to 'sell'", () => {
    expect(fromCtpDirection('1')).toBe('sell')
  })
})

describe('fromCtpOffsetFlag', () => {
  it("converts '0' to 'open'", () => {
    expect(fromCtpOffsetFlag('0')).toBe('open')
  })

  it("converts '1' to 'close'", () => {
    expect(fromCtpOffsetFlag('1')).toBe('close')
  })

  it("converts '3' to 'close_today'", () => {
    expect(fromCtpOffsetFlag('3')).toBe('close_today')
  })
})

describe('fromCtpOrderStatus', () => {
  it("converts '0' to 'all_traded'", () => {
    expect(fromCtpOrderStatus('0')).toBe('all_traded')
  })

  it("converts '1' to 'partial'", () => {
    expect(fromCtpOrderStatus('1')).toBe('partial')
  })

  it("converts '2' to 'no_traded'", () => {
    expect(fromCtpOrderStatus('2')).toBe('no_traded')
  })

  it("converts '5' to 'canceled'", () => {
    expect(fromCtpOrderStatus('5')).toBe('canceled')
  })
})

describe('convertOrderRequest', () => {
  it('converts frontend OrderRequest to CTP format', () => {
    const form = {
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    }

    const result = convertOrderRequest(form)

    expect(result).toEqual({
      instrumentID: 'IF2608',
      direction: '0',
      offsetFlag: '0',
      priceType: '2',
      timeCondition: '3',
      volumeCondition: '1',
      hedgeFlag: '1',
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    })
  })

  it('maps combHedgeFlag to hedgeFlag in CTP output', () => {
    const form = {
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      combHedgeFlag: 'hedge' as const,
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    }

    const result = convertOrderRequest(form)
    expect(result.hedgeFlag).toBe('3')
  })

  it('defaults hedgeFlag to 1 (speculation) when combHedgeFlag is not provided', () => {
    const form = {
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    }

    const result = convertOrderRequest(form)
    expect(result.hedgeFlag).toBe('1')
  })

  it('passes through stopPrice when present (stop order)', () => {
    const form = {
      instrumentID: 'IF2608',
      direction: 'sell' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4790.0,
      volumeTotalOriginal: 1,
      stopPrice: 4780.0,
    }

    const result = convertOrderRequest(form)

    expect(result.stopPrice).toBe(4780.0)
  })

  it('omit stopPrice when not present (normal order)', () => {
    const form = {
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4800.0,
      volumeTotalOriginal: 1,
    }

    const result = convertOrderRequest(form)

    expect(result).not.toHaveProperty('stopPrice')
  })

  it('sets volumeCondition=CV(3) for FOK and AV(1) for FAK/GFD', () => {
    // FOK → CV
    const fok = convertOrderRequest({
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'fok' as const,
      limitPrice: 4800,
      volumeTotalOriginal: 1,
    })
    expect(fok.volumeCondition).toBe('3')

    // FAK → AV
    const fak = convertOrderRequest({
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'fak' as const,
      limitPrice: 4800,
      volumeTotalOriginal: 1,
    })
    expect(fak.volumeCondition).toBe('1')

    // GFD → AV
    const gfd = convertOrderRequest({
      instrumentID: 'IF2608',
      direction: 'buy' as const,
      combOffsetFlag: 'open' as const,
      orderPriceType: 'limit' as const,
      timeCondition: 'gfd' as const,
      limitPrice: 4800,
      volumeTotalOriginal: 1,
    })
    expect(gfd.volumeCondition).toBe('1')
  })

  it('converts a sell+fok market order correctly', () => {
    const form = {
      instrumentID: 'au2508',
      direction: 'sell' as const,
      combOffsetFlag: 'close_today' as const,
      orderPriceType: 'market' as const,
      timeCondition: 'fok' as const,
      limitPrice: 0,
      volumeTotalOriginal: 3,
    }

    const result = convertOrderRequest(form)

    expect(result).toEqual({
      instrumentID: 'au2508',
      direction: '1',
      offsetFlag: '3',
      priceType: '1',
      timeCondition: '1',
      volumeCondition: '3',
      hedgeFlag: '1',
      limitPrice: 0,
      volumeTotalOriginal: 3,
    })
  })
})
