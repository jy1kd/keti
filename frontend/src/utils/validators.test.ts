import { describe, it, expect } from 'vitest'
import { validatePrice, validateVolume, validateInstrumentId } from './validators'

describe('validatePrice', () => {
  it('有效价格返回 null', () => {
    expect(validatePrice(480.5)).toBeNull()
    expect(validatePrice(0.01)).toBeNull()
  })

  it('价格为 0 返回错误', () => {
    expect(validatePrice(0)).toBe('价格必须大于0')
  })

  it('价格为负数返回错误', () => {
    expect(validatePrice(-1)).toBe('价格必须大于0')
  })

  it('NaN 返回错误', () => {
    expect(validatePrice(NaN)).toBe('请输入有效价格')
  })
})

describe('validateVolume', () => {
  it('有效数量返回 null', () => {
    expect(validateVolume(1)).toBeNull()
    expect(validateVolume(100)).toBeNull()
  })

  it('数量为 0 返回错误', () => {
    expect(validateVolume(0)).toBe('数量必须大于0')
  })

  it('数量为负数返回错误', () => {
    expect(validateVolume(-1)).toBe('数量必须大于0')
  })

  it('小数数量返回错误', () => {
    expect(validateVolume(1.5)).toBe('数量必须为整数')
  })

  it('NaN 返回错误', () => {
    expect(validateVolume(NaN)).toBe('请输入有效数量')
  })
})

describe('validateInstrumentId', () => {
  it('有效合约代码返回 null', () => {
    expect(validateInstrumentId('au2406')).toBeNull()
    expect(validateInstrumentId('rb2410')).toBeNull()
  })

  it('空字符串返回错误', () => {
    expect(validateInstrumentId('')).toBe('请输入合约代码')
  })

  it('纯空格返回错误', () => {
    expect(validateInstrumentId('   ')).toBe('请输入合约代码')
  })
})
