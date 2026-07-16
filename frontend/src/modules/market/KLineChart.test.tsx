import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KLineChart } from './KLineChart'
import type { KLineData } from '@/services/types'

// Mock echarts — must use vi.hoisted so variables exist when vi.mock is hoisted
const { mockSetOption, mockResize, mockDispose, mockInit } = vi.hoisted(() => {
  const mockSetOption = vi.fn()
  const mockResize = vi.fn()
  const mockDispose = vi.fn()
  const mockInit = vi.fn(() => ({
    setOption: mockSetOption,
    resize: mockResize,
    dispose: mockDispose,
  }))
  return { mockSetOption, mockResize, mockDispose, mockInit }
})

vi.mock('echarts', () => ({
  init: mockInit,
  default: { init: mockInit },
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
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
})
