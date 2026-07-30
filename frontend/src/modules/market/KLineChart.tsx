import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { KLineData } from '@/services/types'
import { calcVolumeMA, calcBoll, calcKDJ, calcRSI } from './indicators'

export interface KLineChartProps {
  instrument: string
  klineData: KLineData[]
  period: string
  onPeriodChange?: (period: string) => void
}

/** 主图指标类型 */
type MainIndicator = 'ma' | 'boll'
/** 副图指标类型 */
type SubIndicator = 'volume' | 'macd' | 'kdj' | 'rsi'

const PERIODS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
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
  '1m': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  '5m': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  '15m': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  '30m': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  '1h': { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
}

function buildOption(
  klineData: KLineData[],
  period: string,
  mainIndicator: MainIndicator,
  subIndicator: SubIndicator,
) {
  const fmt = DATE_FORMAT_MAP[period] ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
  const dates = klineData.map((d) => new Date(d.timestamp).toLocaleString(undefined, fmt))
  const ohlc = klineData.map((d) => [d.open, d.close, d.low, d.high])

  // 主图指标系列
  const mainSeries: echarts.SeriesOption[] = []
  if (mainIndicator === 'ma') {
    MA_PERIODS.forEach((ma) => {
      mainSeries.push({
        type: 'line',
        name: ma.name,
        data: calcMA(klineData, ma.period),
        xAxisIndex: 0,
        yAxisIndex: 0,
        smooth: true,
        lineStyle: { width: 1, color: ma.color },
        symbol: 'none',
      })
    })
  } else if (mainIndicator === 'boll') {
    const boll = calcBoll(klineData, 20)
    const bollColors = { upper: '#ff6b9d', middle: '#f5c16c', lower: '#61caff' }
    const bollNames = { upper: '上轨', middle: '中轨', lower: '下轨' }
    Object.entries(boll).forEach(([key, data]) => {
      mainSeries.push({
        type: 'line',
        name: bollNames[key as keyof typeof bollNames],
        data,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 1, color: bollColors[key as keyof typeof bollColors] },
        symbol: 'none',
      })
    })
  }

  // 副图指标系列
  const subSeries: echarts.SeriesOption[] = []
  if (subIndicator === 'volume') {
    const volumes = klineData.map((d) => ({
      value: d.volume,
      itemStyle: { color: d.close >= d.open ? '#ef5350' : '#26a69a' },
    }))
    subSeries.push({
      type: 'bar',
      data: volumes,
      xAxisIndex: 1,
      yAxisIndex: 1,
    })
    // 成交量均线
    const volMa5 = calcVolumeMA(klineData, 5)
    subSeries.push({
      type: 'line',
      name: 'VOL-MA5',
      data: volMa5,
      xAxisIndex: 1,
      yAxisIndex: 1,
      lineStyle: { width: 1, color: '#f5c16c' },
      symbol: 'none',
    })
  } else if (subIndicator === 'macd') {
    const { dif, dea, macd } = calcMACD(klineData)
    subSeries.push(
      {
        type: 'line',
        name: 'DIF',
        data: dif,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 1, color: '#f5c16c' },
        symbol: 'none',
      },
      {
        type: 'line',
        name: 'DEA',
        data: dea,
        xAxisIndex: 1,
        yAxisIndex: 1,
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
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    )
  } else if (subIndicator === 'kdj') {
    const kdj = calcKDJ(klineData, 9)
    const kdjColors = { k: '#f5c16c', d: '#61caff', j: '#ff6b9d' }
    Object.entries(kdj).forEach(([key, data]) => {
      subSeries.push({
        type: 'line',
        name: key.toUpperCase(),
        data,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 1, color: kdjColors[key as keyof typeof kdjColors] },
        symbol: 'none',
      })
    })
  } else if (subIndicator === 'rsi') {
    const rsi = calcRSI(klineData, 14)
    subSeries.push({
      type: 'line',
      name: 'RSI',
      data: rsi,
      xAxisIndex: 1,
      yAxisIndex: 1,
      lineStyle: { width: 1, color: '#f5c16c' },
      symbol: 'none',
    })
  }

  return {
    animation: false,
    // 主图/副图十字线联动
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 60, right: 20, top: 10, height: '50%' },
      { left: 60, right: 20, top: '65%', height: '25%' },
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
          color: '#ef5350',
          color0: '#26a69a',
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
      ...mainSeries,
      ...subSeries,
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
  }
}

/** 主图指标选项 */
const MAIN_INDICATORS: { label: string; value: MainIndicator }[] = [
  { label: 'MA', value: 'ma' },
  { label: 'BOLL', value: 'boll' },
]

/** 副图指标选项 */
const SUB_INDICATORS: { label: string; value: SubIndicator }[] = [
  { label: '成交量', value: 'volume' },
  { label: 'MACD', value: 'macd' },
  { label: 'KDJ', value: 'kdj' },
  { label: 'RSI', value: 'rsi' },
]

export function KLineChart({ instrument, klineData, period, onPeriodChange }: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const prevDataLenRef = useRef(0)
  const [mainIndicator, setMainIndicator] = useState<MainIndicator>('ma')
  const [subIndicator, setSubIndicator] = useState<SubIndicator>('volume')

  useEffect(() => {
    if (!chartRef.current) return
    const el = chartRef.current
    let chart: echarts.ECharts | null = null
    let disposed = false

    const tryInit = () => {
      if (disposed || chart || el.offsetWidth === 0 || el.offsetHeight === 0) return
      chart = echarts.init(el)
      instanceRef.current = chart
    }

    tryInit()

    const ro = new ResizeObserver(() => {
      if (!chart) tryInit()
      else chart.resize()
    })
    ro.observe(el)

    return () => {
      disposed = true
      ro.disconnect()
      chart?.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (instanceRef.current && klineData.length > 0) {
      const chart = instanceRef.current
      const isInit = prevDataLenRef.current === 0

      let savedZoom: { start?: number; end?: number } | null = null
      if (!isInit) {
        const opt = chart.getOption() as any
        if (opt?.dataZoom?.[0]) {
          savedZoom = { start: opt.dataZoom[0].start, end: opt.dataZoom[0].end }
        }
      }

      chart.setOption(buildOption(klineData, period, mainIndicator, subIndicator), isInit)

      if (savedZoom) {
        chart.dispatchAction({ type: 'dataZoom', start: savedZoom.start, end: savedZoom.end })
      }

      prevDataLenRef.current = klineData.length
    }
  }, [klineData, period, mainIndicator, subIndicator])

  return (
    <div className="kline-chart" data-testid="kline-chart">
      <div className="kline-chart__header">
        <span className="kline-chart__instrument">{instrument}</span>
        <div className="kline-chart__controls">
          <div className="kline-chart__periods">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={`kline-chart__btn${p.value === period ? ' active' : ''}`}
                onClick={() => onPeriodChange?.(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="kline-chart__indicators">
            <select
              className="kline-chart__select"
              value={mainIndicator}
              onChange={(e) => setMainIndicator(e.target.value as MainIndicator)}
            >
              {MAIN_INDICATORS.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
            <select
              className="kline-chart__select"
              value={subIndicator}
              onChange={(e) => setSubIndicator(e.target.value as SubIndicator)}
            >
              {SUB_INDICATORS.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="kline-chart__canvas" data-testid="kline-canvas" ref={chartRef}>
        {klineData.length === 0 && (
          <div className="kline-chart__empty">暂无K线数据</div>
        )}
      </div>
    </div>
  )
}
