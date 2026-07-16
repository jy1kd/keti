import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KLineChart } from './KLineChart'
import type { KLineData } from '@/services/types'

// Mock echarts
const mockSetOption = vi.fn()
const mockResize = vi.fn()
const mockDispose = vi.fn()

vi.mock('echarts', () => ({
  default: {
    init: vi.fn(() => ({
      setOption: mockSetOption,
      resize: mockResize,
      dispose: mockDispose,
    })),
  },
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
})
