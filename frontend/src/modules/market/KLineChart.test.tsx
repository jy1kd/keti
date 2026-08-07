import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { KLineChart } from './KLineChart'
import type { KLineData } from '@/services/types'

// Mock echarts — must use vi.hoisted so variables exist when vi.mock is hoisted
const { mockSetOption, mockDispose, mockInit } = vi.hoisted(() => {
  const mockSetOption = vi.fn()
  const mockResize = vi.fn() // used inside mockInit closure
  const mockDispose = vi.fn()
  const mockGetOption = vi.fn(() => ({})) // 与真实 echarts 一致；K线数据更新时用于保留缩放
  const mockInit = vi.fn(() => ({
    setOption: mockSetOption,
    resize: mockResize,
    dispose: mockDispose,
    getOption: mockGetOption,
  }))
  return { mockSetOption, mockDispose, mockInit }
})

vi.mock('echarts', () => ({
  init: mockInit,
  default: { init: mockInit },
}))

// Mock ResizeObserver — 触发回调模拟容器有尺寸
globalThis.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => {
  const observer = {
    observe: vi.fn((target: Element) => {
      // 模拟容器有尺寸（jsdom 中 offsetWidth/offsetHeight 默认为 0）
      Object.defineProperty(target, 'offsetWidth', { value: 800, configurable: true })
      Object.defineProperty(target, 'offsetHeight', { value: 600, configurable: true })
      const entry = {
        contentRect: { width: 800, height: 600 },
        target,
      } as unknown as ResizeObserverEntry
      callback([entry], observer as unknown as ResizeObserver)
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
  return observer
})

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
    // 日线功能已移除（后端不支持 1d 周期）
    expect(screen.queryByText('日线')).not.toBeInTheDocument()
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

  it('标题栏带 data-drag-handle（整行可拖为弹窗）', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    const header = document.querySelector('.kline-chart__header')
    expect(header).not.toBeNull()
    expect(header).toHaveAttribute('data-drag-handle')
  })

  it('拖拽 title 提示仅保留在合约信息区，不覆盖周期/指标控件', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    const header = document.querySelector('.kline-chart__header')
    expect(header).not.toHaveAttribute('title')
    const contract = document.querySelector('.kline-chart__contract')
    expect(contract).toHaveAttribute('title', '拖动此栏可将标签转为弹窗')
  })

  it('renders contract name when provided', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" name="沪深300" />)
    expect(screen.getByText('沪深300')).toBeInTheDocument()
  })

  it('renders latest price when provided', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" latestPrice="4585.60" />)
    expect(screen.getByText('4585.60')).toBeInTheDocument()
  })

  it('does not render name/latest price when not provided', () => {
    render(<KLineChart instrument="IF2608" klineData={[]} period="5m" />)
    expect(screen.queryByText('沪深300')).not.toBeInTheDocument()
    expect(screen.queryByText('4585.60')).not.toBeInTheDocument()
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

  it('includes volume bar series by default', () => {
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
    const volumeSeries = option.series.find((s: { type: string }) => s.type === 'bar')
    expect(volumeSeries).toBeDefined()
  })

  it('includes volume MA5 line series', () => {
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
    const volMa5 = option.series.find((s: { name: string }) => s.name === 'VOL-MA5')
    expect(volMa5).toBeDefined()
    expect(volMa5.type).toBe('line')
  })

  it('has 2 grids by default (main + sub)', () => {
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
    expect(option.grid.length).toBe(2)
    expect(option.yAxis.length).toBe(2)
  })

  it('applies data when chart initializes after container becomes visible (懒初始化竞态)', () => {
    vi.clearAllMocks()
    // 覆盖 ResizeObserver：捕获回调但不立即触发 —— 模拟容器挂载时为 display:none（0 尺寸）
    const roCallbacks: ResizeObserverCallback[] = []
    const origRO = globalThis.ResizeObserver
    globalThis.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
      roCallbacks.push(cb)
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
    })

    try {
      const { unmount } = render(<KLineChart instrument="IF2608" klineData={sampleData} period="5m" />)
      // 挂载时容器无尺寸 → echarts 未初始化，setOption 不应被调用
      expect(mockInit).not.toHaveBeenCalled()
      expect(mockSetOption).not.toHaveBeenCalled()

      // 模拟切换到该标签页：容器获得尺寸，ResizeObserver 触发懒初始化
      const el = screen.getByTestId('kline-canvas')
      Object.defineProperty(el, 'offsetWidth', { value: 800, configurable: true })
      Object.defineProperty(el, 'offsetHeight', { value: 600, configurable: true })
      act(() => {
        roCallbacks.forEach((cb) =>
          cb(
            [{ contentRect: { width: 800, height: 600 }, target: el }] as unknown as ResizeObserverEntry[],
            {} as ResizeObserver,
          ),
        )
      })

      // 实例此时才创建，必须把已有数据画上去，否则该标签页空白
      expect(mockInit).toHaveBeenCalled()
      expect(mockSetOption).toHaveBeenCalled()
      unmount()
    } finally {
      globalThis.ResizeObserver = origRO
    }
  })
})
