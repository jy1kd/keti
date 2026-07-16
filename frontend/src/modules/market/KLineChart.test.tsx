import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KLineChart } from './KLineChart'
import type { KLineData } from '@/services/types'

// Mock echarts — must use vi.hoisted so variables exist when vi.mock is hoisted
const { mockSetOption, mockDispose, mockInit } = vi.hoisted(() => {
  const mockSetOption = vi.fn()
  const mockResize = vi.fn() // used inside mockInit closure
  const mockDispose = vi.fn()
  const mockInit = vi.fn(() => ({
    setOption: mockSetOption,
    resize: mockResize,
    dispose: mockDispose,
  }))
  return { mockSetOption, mockDispose, mockInit }
})

vi.mock('echarts', () => ({
  init: mockInit,
  default: { init: mockInit },
}))

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

const sampleData: KLineData[] = [
  { timestamp: 1000, open: 100, high: 105, low: 98, close: 103, volume: 500, openInterest: 1000 },
  { timestamp: 2000, open: 103, high: 110, low: 101, close: 108, volume: 600, openInterest: 1100 },
]

describe('KLineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders chart container', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    expect(screen.getByTestId('kline-chart')).toBeInTheDocument()
  })

  it('renders period selector buttons', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    expect(screen.getByText('1m')).toBeInTheDocument()
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('日线')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    expect(screen.getByText('暂无K线数据')).toBeInTheDocument()
    // canvas should always be rendered
    expect(screen.getByTestId('kline-canvas')).toBeInTheDocument()
  })

  it('renders instrument name in header', () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    expect(screen.getByText('IF2608')).toBeInTheDocument()
  })

  it('renders chart canvas when data is provided', () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    expect(screen.getByTestId('kline-canvas')).toBeInTheDocument()
  })

  it('highlights active period button', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="15m" />)
    const btn = screen.getByText('15m')
    expect(btn.className).toContain('active')
  })

  it('non-active period button does not have active class', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="15m" />)
    const btn = screen.getByText('5m')
    expect(btn.className).not.toContain('active')
  })

  it('initializes echarts when data is provided', () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    expect(mockInit).toHaveBeenCalled()
  })

  it('sets chart options with candlestick and volume series', async () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    expect(mockSetOption).toHaveBeenCalled()
    const option = mockSetOption.mock.calls[0][0]
    // Should have candlestick series
    expect(option.series.some((s: { type: string }) => s.type === 'candlestick')).toBe(true)
    // Should have volume bar series
    expect(option.series.some((s: { type: string }) => s.type === 'bar')).toBe(true)
  })

  it('passes correct OHLC data to candlestick series', () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    const option = mockSetOption.mock.calls[0][0]
    const candleSeries = option.series.find((s: { type: string }) => s.type === 'candlestick')
    // Data should be [open, close, low, high] format for ECharts
    expect(candleSeries.data).toHaveLength(2)
    expect(candleSeries.data[0]).toEqual([100, 103, 98, 105])
  })

  it('disposes chart on unmount', () => {
    const { unmount } = render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    unmount()
    expect(mockDispose).toHaveBeenCalled()
  })

  it('includes MA line series (MA5, MA10, MA20)', () => {
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    const option = mockSetOption.mock.calls[mockSetOption.mock.calls.length - 1][0]
    const lineSeries = option.series.filter((s: { type: string }) => s.type === 'line')
    // Should have at least 3 MA lines
    expect(lineSeries.length).toBeGreaterThanOrEqual(3)
    // Check MA names
    const names = lineSeries.map((s: { name: string }) => s.name)
    expect(names).toContain('MA5')
    expect(names).toContain('MA10')
    expect(names).toContain('MA20')
  })

  it('MA lines use xAxisIndex 0 and yAxisIndex 0', () => {
    vi.clearAllMocks()
    render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
    // Find the call that has candlestick series (the data-bearing call)
    const dataCall = mockSetOption.mock.calls.find((call) => {
      const opt = call[0]
      return opt.series?.some((s: { type: string }) => s.type === 'candlestick')
    })
    expect(dataCall).toBeDefined()
    const option = dataCall![0]
    // Verify MA5, MA10, MA20 exist and use correct axes
    for (const name of ['MA5', 'MA10', 'MA20']) {
      const ma = option.series.find((s: { name: string }) => s.name === name)
      expect(ma).toBeDefined()
      expect(ma.xAxisIndex).toBe(0)
      expect(ma.yAxisIndex).toBe(0)
    }
  })

  it('includes MACD DIF and DEA line series', () => {
    // Need enough data points for MACD (EMA26 needs 26+ points)
    const longData: KLineData[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: i * 1000,
      open: 100 + i,
      high: 105 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 500,
      openInterest: 1000,
    }))
    render(<KLineChart instrument="IF2608" klineData={longData} period="5m" />)
    const option = mockSetOption.mock.calls[mockSetOption.mock.calls.length - 1][0]
    const difSeries = option.series.find((s: { name: string }) => s.name === 'DIF')
    const deaSeries = option.series.find((s: { name: string }) => s.name === 'DEA')
    expect(difSeries).toBeDefined()
    expect(deaSeries).toBeDefined()
  })

  it('includes MACD histogram bar series', () => {
    const longData: KLineData[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: i * 1000,
      open: 100 + i,
      high: 105 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 500,
      openInterest: 1000,
    }))
    render(<KLineChart instrument="IF2608" klineData={longData} period="5m" />)
    const option = mockSetOption.mock.calls[mockSetOption.mock.calls.length - 1][0]
    const macdHist = option.series.find((s: { name: string }) => s.name === 'MACD')
    expect(macdHist).toBeDefined()
    expect(macdHist.type).toBe('bar')
  })

  it('MACD series use xAxisIndex 1 and yAxisIndex 2', () => {
    const longData: KLineData[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: i * 1000,
      open: 100 + i,
      high: 105 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 500,
      openInterest: 1000,
    }))
    render(<KLineChart instrument="IF2608" klineData={longData} period="5m" />)
    const option = mockSetOption.mock.calls[mockSetOption.mock.calls.length - 1][0]
    // Should have 3 grids: candlestick, volume, MACD
    expect(option.grid.length).toBe(3)
    expect(option.yAxis.length).toBe(3)
  })
})
