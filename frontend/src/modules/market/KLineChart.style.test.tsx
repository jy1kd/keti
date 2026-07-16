import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('KLineChart styles', () => {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')

  it('contains kline-chart base styles', () => {
    expect(css).toContain('.kline-chart')
  })

  it('contains kline-chart header styles', () => {
    expect(css).toContain('.kline-chart__header')
  })

  it('contains kline-chart period button styles', () => {
    expect(css).toContain('.kline-chart__period-btn')
  })

  it('contains kline-chart canvas styles', () => {
    expect(css).toContain('.kline-chart__canvas')
  })

  it('contains kline-chart empty state styles', () => {
    expect(css).toContain('.kline-chart__empty')
  })
})
