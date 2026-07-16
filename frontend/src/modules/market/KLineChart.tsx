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

const MA_PERIODS = [
  { name: 'MA5', period: 5, color: '#f5c16c' },
  { name: 'MA10', period: 10, color: '#61caff' },
  { name: 'MA20', period: 20, color: '#ff6b9d' },
]

/** 计算移动平均线 */
function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close
    }
    return sum / period
  })
}

/** 计算 EMA */
function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  // 前 period-1 个数据用 SMA 初始化
  let ema = 0
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema += data[i]
      result.push(ema / (i + 1))
    } else if (i === period - 1) {
      ema = (ema + data[i]) / period
      result.push(ema)
    } else {
      ema = data[i] * k + ema * (1 - k)
      result.push(ema)
    }
  }
  return result
}

/** 计算 MACD (DIF, DEA, MACD柱) */
function calcMACD(data: KLineData[]): { dif: number[]; dea: number[]; macd: number[] } {
  const closes = data.map((d) => d.close)
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const dif = ema12.map((v, i) => v - ema26[i])
  const dea = calcEMA(dif, 9)
  const macd = dif.map((v, i) => (v - dea[i]) * 2)
  return { dif, dea, macd }
}

const DATE_FORMAT_MAP: Record<string, Intl.DateTimeFormatOptions> = {
  '1m': { hour: '2-digit', minute: '2-digit' },
  '5m': { hour: '2-digit', minute: '2-digit' },
  '15m': { hour: '2-digit', minute: '2-digit' },
  '30m': { hour: '2-digit', minute: '2-digit' },
  '1h': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  '1d': { month: '2-digit', day: '2-digit' },
}

function buildOption(klineData: KLineData[], period: string) {
  const fmt = DATE_FORMAT_MAP[period] ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
  const dates = klineData.map((d) => new Date(d.timestamp).toLocaleString(undefined, fmt))
  // ECharts candlestick: [open, close, low, high]
  const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high])
  const volumes = klineData.map((d) => ({
    value: d.volume,
    itemStyle: { color: d.close >= d.open ? '#ef5350' : '#26a69a' },
  }))

  const { dif, dea, macd } = calcMACD(klineData)

  return {
    animation: false,
    grid: [
      { left: 60, right: 20, top: 10, height: '50%' },
      { left: 60, right: 20, top: '65%', height: '12%' },
      { left: 60, right: 20, top: '82%', height: '12%' },
    ],
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, show: false },
      { type: 'category', data: dates, gridIndex: 1, show: false },
      { type: 'category', data: dates, gridIndex: 2, show: false },
    ],
    yAxis: [
      { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
      { scale: true, gridIndex: 1, splitLine: { show: false } },
      { scale: true, gridIndex: 2, splitLine: { show: false } },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: 0, end: 100 },
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
      ...MA_PERIODS.map((ma) => ({
        type: 'line' as const,
        name: ma.name,
        data: calcMA(klineData, ma.period),
        xAxisIndex: 0,
        yAxisIndex: 0,
        smooth: true,
        lineStyle: { width: 1, color: ma.color },
        symbol: 'none',
      })),
      {
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
      {
        type: 'line',
        name: 'DIF',
        data: dif,
        xAxisIndex: 2,
        yAxisIndex: 2,
        lineStyle: { width: 1, color: '#f5c16c' },
        symbol: 'none',
      },
      {
        type: 'line',
        name: 'DEA',
        data: dea,
        xAxisIndex: 2,
        yAxisIndex: 2,
        lineStyle: { width: 1, color: '#61caff' },
        symbol: 'none',
      },
      {
        type: 'bar',
        name: 'MACD',
        data: macd.map((v) => ({
          value: v,
          itemStyle: { color: v >= 0 ? '#ef5350' : '#26a69a' },
        })),
        xAxisIndex: 2,
        yAxisIndex: 2,
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
  const prevDataLenRef = useRef(0)

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
      // 首次加载全量替换，后续更新合并模式
      const isInit = prevDataLenRef.current === 0
      instanceRef.current.setOption(buildOption(klineData, period), isInit)
      prevDataLenRef.current = klineData.length
    }
  }, [klineData, period])

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
