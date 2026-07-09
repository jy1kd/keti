import { describe, it, expect } from 'vitest'
import { formatPrice, formatVolume, formatTime, formatChange, formatPercent } from './format'

describe('formatPrice', () => {
  it('正常价格格式化', () => {
    expect(formatPrice(480.5)).toBe('480.50')
  })

  it('整数价格补零', () => {
    expect(formatPrice(3800)).toBe('3800.00')
  })

  it('null/undefined/特殊值返回占位符', () => {
    expect(formatPrice(null as unknown as number)).toBe('--')
    expect(formatPrice(undefined as unknown as number)).toBe('--')
    expect(formatPrice(0)).toBe('--')
    expect(formatPrice(-1)).toBe('--')
  })
})

describe('formatVolume', () => {
  it('正常数量', () => {
    expect(formatVolume(12345)).toBe('12,345')
  })

  it('零返回 0', () => {
    expect(formatVolume(0)).toBe('0')
  })

  it('大数量正确加逗号', () => {
    expect(formatVolume(1234567)).toBe('1,234,567')
  })
})

describe('formatTime', () => {
  it('已经是 HH:MM:SS 格式则原样返回', () => {
    expect(formatTime('14:30:05')).toBe('14:30:05')
  })

  it('空字符串返回 --', () => {
    expect(formatTime('')).toBe('--')
  })
})

describe('formatChange', () => {
  it('正数带+号', () => {
    expect(formatChange(5.5)).toBe('+5.50')
  })

  it('负数带-号', () => {
    expect(formatChange(-3.2)).toBe('-3.20')
  })

  it('零显示 0.00', () => {
    expect(formatChange(0)).toBe('0.00')
  })
})

describe('formatPercent', () => {
  it('正数带+号和%', () => {
    expect(formatPercent(1.5)).toBe('+1.50%')
  })

  it('负数带-号和%', () => {
    expect(formatPercent(-0.8)).toBe('-0.80%')
  })

  it('零显示 0.00%', () => {
    expect(formatPercent(0)).toBe('0.00%')
  })
})
