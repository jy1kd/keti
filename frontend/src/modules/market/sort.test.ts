import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { sortFutures, deriveUnderlyingProduct, groupOptionsByUnderlying, naturalCompare, syntheticUnderlyingContract, resolveUnderlyingInstrumentID } from './sort'

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

describe('resolveUnderlyingInstrumentID', () => {
  it('underlyingInstrID 完整（含数字）时直接使用', () => {
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'FG610-C-1300', underlyingInstrID: 'FG610' })).toBe('FG610')
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'cu2609C90000', underlyingInstrID: 'cu2609' })).toBe('cu2609')
  })

  it('underlyingInstrID 只有品种（无数字）时从 instrumentID 推断完整标底', () => {
    // CZCE：underlyingInstrID='FG'（品种），instrumentID 'FG611C2225' → FG611
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'FG611C2225', underlyingInstrID: 'FG' })).toBe('FG611')
  })

  it('underlyingInstrID 缺失（空串）时从 instrumentID 推断', () => {
    // CZCE 无分隔符格式：RM611C2225 → RM611
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'RM611C2225', underlyingInstrID: '' })).toBe('RM611')
    // SHFE 无分隔符格式：cu2609C90000 → cu2609
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'cu2609C90000', underlyingInstrID: '' })).toBe('cu2609')
    // INE 无分隔符格式：sc2612C610 → sc2612
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'sc2612C610', underlyingInstrID: '' })).toBe('sc2612')
  })

  it('带分隔符格式（DCE/GFEX）从首段取标底', () => {
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'p2609-C-9400', underlyingInstrID: '' })).toBe('p2609')
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'lc2610-P-72000', underlyingInstrID: '' })).toBe('lc2610')
  })

  it('无法推断时兜底返回 underlyingInstrID', () => {
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'UNKNOWN', underlyingInstrID: '' })).toBe('')
    expect(resolveUnderlyingInstrumentID({ instrumentID: 'UNKNOWN', underlyingInstrID: 'FG' })).toBe('FG')
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

  it('组内排序首维（到期日）：同标底、同类型、同行权价，仅到期日不同 → 先到期在前', () => {
    const futures = [fut('FG609', 'CZCE', 'FG')]
    const options = [
      opt('FG609-C-1300', 'CZCE', 'FGC', 'FG609', '1', 1300, '20260930'),
      opt('FG609-C-1300', 'CZCE', 'FGC', 'FG609', '1', 1300, '20260630'),
    ]
    const groups = groupOptionsByUnderlying(options, futures)
    expect(groups[0].options.map((o) => o.expireDate)).toEqual(['20260630', '20260930'])
  })

  it('组内排序次/末维（类型/行权价）：同标底、同到期日，C 前 P 后、行权价升序', () => {
    const futures = [fut('FG609', 'CZCE', 'FG')]
    const options = [
      opt('FG609-P-1250', 'CZCE', 'FGP', 'FG609', '2', 1250, '20260630'),
      opt('FG609-C-1300', 'CZCE', 'FGC', 'FG609', '1', 1300, '20260630'),
      opt('FG609-C-1200', 'CZCE', 'FGC', 'FG609', '1', 1200, '20260630'),
    ]
    const groups = groupOptionsByUnderlying(options, futures)
    expect(groups[0].options.map((o) => o.instrumentID)).toEqual([
      'FG609-C-1200',
      'FG609-C-1300',
      'FG609-P-1250',
    ])
  })
})

describe('syntheticUnderlyingContract', () => {
  it('指数期权标底合成：productClass=1、isTrading=0、品种/中文名映射', () => {
    const c = syntheticUnderlyingContract('MO2608')
    expect(c.instrumentID).toBe('MO2608')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
    expect(c.productID).toBe('MO')
    expect(c.instrumentName).toBe('中证1000期权')
  })
  it('真实期货标底同格式但可交易标志由调用方决定（合成恒为不可交易）', () => {
    const c = syntheticUnderlyingContract('FG609')
    expect(c.instrumentID).toBe('FG609')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
  })
})
