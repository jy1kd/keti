import { describe, it, expect } from 'vitest'
import { isInTradingSession, getTradingSessionStatus } from './tradingSession'

/** 2026-08 本地时间辅助：08-10=周一, 08-11=周二, 08-15=周六 */
const dt = (day: number, h: number, min = 0) => new Date(2026, 7, day, h, min)

describe('getTradingSessionStatus / isInTradingSession', () => {
  // ── 工作日交易时段 ──
  it('周一 09:30 商品日盘', () => {
    expect(getTradingSessionStatus(dt(10, 9, 30))).toBe('交易时段（商品日盘）')
    expect(isInTradingSession(dt(10, 9, 30))).toBe(true)
  })

  it('周二 13:30 商品日盘下午', () => {
    expect(getTradingSessionStatus(dt(11, 13, 30))).toBe('交易时段（商品日盘）')
  })

  it('周一 21:30 商品夜盘', () => {
    expect(getTradingSessionStatus(dt(10, 21, 30))).toBe('交易时段（商品夜盘）')
  })

  it('周二 01:30 夜盘尾段（贵金属 02:30 收盘）', () => {
    expect(getTradingSessionStatus(dt(11, 1, 30))).toBe('交易时段（商品夜盘）')
  })

  // ── 工作日非交易时段 ──
  it('周二 10:20 日盘休市（10:15-10:30）', () => {
    expect(getTradingSessionStatus(dt(11, 10, 20))).toBe('非交易时段')
  })

  it('周二 16:00 已收盘', () => {
    expect(getTradingSessionStatus(dt(11, 16, 0))).toBe('非交易时段')
  })

  it('周二 18:00 收盘后夜盘前', () => {
    expect(getTradingSessionStatus(dt(11, 18, 0))).toBe('非交易时段')
  })

  it('周二 08:00 开盘前', () => {
    expect(getTradingSessionStatus(dt(11, 8, 0))).toBe('非交易时段')
  })

  // ── 周末 → 非交易时段 ──
  it('周六 12:00', () => {
    expect(getTradingSessionStatus(dt(15, 12, 0))).toBe('非交易时段')
    expect(isInTradingSession(dt(15, 12, 0))).toBe(false)
  })

  it('周六 22:00 周末夜盘无交易', () => {
    expect(getTradingSessionStatus(dt(15, 22, 0))).toBe('非交易时段')
  })

  // ── 夜盘边界：21:00 起、02:30 止 ──
  it('周一 20:59 未开盘', () => {
    expect(getTradingSessionStatus(dt(10, 20, 59))).toBe('非交易时段')
  })

  it('周一 21:00 整点开盘', () => {
    expect(getTradingSessionStatus(dt(10, 21, 0))).toBe('交易时段（商品夜盘）')
  })

  it('夜盘收盘边界 02:29 交易 / 02:30 收盘', () => {
    expect(getTradingSessionStatus(dt(11, 2, 29))).toBe('交易时段（商品夜盘）')
    expect(getTradingSessionStatus(dt(11, 2, 30))).toBe('非交易时段')
  })

  // ── 日盘边界：09:00 起、15:00 止，10:15/10:30 午间休市 ──
  it('周一 09:00 整点开盘', () => {
    expect(getTradingSessionStatus(dt(10, 9, 0))).toBe('交易时段（商品日盘）')
  })

  it('周一 10:15 收盘 / 10:30 再开盘', () => {
    expect(getTradingSessionStatus(dt(10, 10, 15))).toBe('非交易时段')
    expect(getTradingSessionStatus(dt(10, 10, 30))).toBe('交易时段（商品日盘）')
  })

  it('周一 15:00 收盘', () => {
    expect(getTradingSessionStatus(dt(10, 15, 0))).toBe('非交易时段')
  })
})
