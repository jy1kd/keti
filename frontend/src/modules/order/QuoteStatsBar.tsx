import { useMemo } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import './QuoteStatsBar.css'

interface QuoteStatsBarProps {
  /** 行情统计栏对应合约 */
  instrumentID: string
}

/** 千分位格式化（纯数字，无小数点） */
function formatInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** 价格格式化：保留到 priceTick 精度（0.2 → 1位小数，0.05 → 2位，对齐 MarketDepth） */
function formatPrice(n: number, tick: number): string {
  const str = String(tick)
  const decimals = str.includes('.') ? str.split('.')[1].length : 0
  return n.toFixed(decimals)
}

/** 缺失值占位 */
const PLACEHOLDER = '--'

/**
 * QuoteStatsBar — ⑥ 行情统计栏（仅完整态）
 *
 * 今开/昨结/最高/最低/成交量/持仓量 KV，数据来自 MarketSnapshot；
 * 最高 up、最低 down 涨跌着色（对齐 OrderQuotePanel 取值逻辑）。
 */
export function QuoteStatsBar({ instrumentID }: QuoteStatsBarProps) {
  const snapshot = useMarketStore((s) => (instrumentID ? s.snapshots.get(instrumentID) ?? null : null))
  const contract = useContractsStore((s) =>
    instrumentID ? s.contracts.find((c) => c.instrumentID === instrumentID) ?? null : null
  )
  const priceTick = contract?.priceTick ?? 0.2

  const cells = useMemo(() => {
    const p = (n: number | null | undefined) => (n == null ? PLACEHOLDER : formatPrice(n, priceTick))
    return [
      { label: '今开', value: p(snapshot?.openPrice), tone: 'flat' },
      { label: '昨结', value: p(snapshot?.preSettlementPrice), tone: 'flat' },
      { label: '最高', value: p(snapshot?.highestPrice), tone: 'up' },
      { label: '最低', value: p(snapshot?.lowestPrice), tone: 'down' },
      { label: '成交量', value: snapshot?.volume != null ? formatInt(snapshot.volume) : PLACEHOLDER, tone: 'flat' },
      { label: '持仓量', value: snapshot?.openInterest != null ? formatInt(snapshot.openInterest) : PLACEHOLDER, tone: 'flat' },
    ]
  }, [snapshot, priceTick])

  return (
    <div className="quote-stats-bar" data-testid="quote-stats-bar">
      {cells.map((cell) => (
        <div key={cell.label} className="quote-stats-bar__item">
          <span className="quote-stats-bar__label">{cell.label}</span>
          <b
            className={`quote-stats-bar__value quote-stats-bar__value--${cell.tone}`}
            data-testid={`qs-${cell.label}`}
          >
            {cell.value}
          </b>
        </div>
      ))}
    </div>
  )
}
