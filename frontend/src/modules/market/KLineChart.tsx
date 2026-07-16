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

export function KLineChart({ instrument, klineData, period, onPeriodChange }: KLineChartProps) {
  return (
    <div className="kline-chart" data-testid="kline-chart">
      <div className="kline-chart__header">
        <span className="kline-chart__instrument">{instrument}</span>
        <div className="kline-chart__periods">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`kline-chart__period-btn ${p.value === period ? 'active' : ''}`}
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
        <div className="kline-chart__canvas" data-testid="kline-canvas" />
      )}
    </div>
  )
}
