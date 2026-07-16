import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { KLineData } from '@/services/types'

export interface KLineChartProps {
  instrument: string
  klineData: KLineData[]
  period: string
  onPeriodChange?: (period: string) => void
}

const PERIODS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '日线', value: '1d' },
]

function buildOption(klineData: KLineData[]) {
  const dates = klineData.map((d) => new Date(d.timestamp).toLocaleString())
  // ECharts candlestick: [open, close, low, high]
  const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high])
  const volumes = klineData.map((d) => ({
    value: d.volume,
    itemStyle: { color: d.close >= d.open ? '#ef5350' : '#26a69a' },
  }))

  return {
    animation: false,
    grid: [
      { left: 60, right: 20, top: 10, height: '60%' },
      { left: 60, right: 20, top: '75%', height: '15%' },
    ],
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, show: false },
      { type: 'category', data: dates, gridIndex: 1, show: false },
    ],
    yAxis: [
      { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
      { scale: true, gridIndex: 1, splitLine: { show: false } },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
    ],
    series: [
      {
        type: 'candlestick',
        data: ohlc,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: '#ef5350',       // 阳线（涨）
          color0: '#26a69a',      // 阴线（跌）
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
      {
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
  }
}

export function KLineChart({ instrument, klineData, period, onPeriodChange }: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    instanceRef.current = chart

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      chart.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (instanceRef.current && klineData.length > 0) {
      instanceRef.current.setOption(buildOption(klineData), true)
    }
  }, [klineData])

  return (
    <div className="kline-chart" data-testid="kline-chart">
      <div className="kline-chart__header">
        <span className="kline-chart__instrument">{instrument}</span>
        <div className="kline-chart__periods">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`kline-chart__period-btn${p.value === period ? ' active' : ''}`}
              onClick={() => onPeriodChange?.(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {klineData.length === 0 ? (
        <div className="kline-chart__empty">暂无K线数据</div>
      ) : (
        <div className="kline-chart__canvas" data-testid="kline-canvas" ref={chartRef} />
      )}
    </div>
  )
}
