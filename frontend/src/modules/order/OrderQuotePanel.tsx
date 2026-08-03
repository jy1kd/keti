import { useMemo } from 'react'
import type { MarketSnapshot } from '@/services/types'
import { useContractsStore } from '@/stores/contracts'
import { useOrderStore } from './store'
import { DepthQuote } from '@/modules/market/DepthQuote'
import './OrderQuotePanel.css'

interface OrderQuotePanelProps {
  instrumentID: string
  snapshot: MarketSnapshot | null
  priceTick: number
}

/** 千分位格式化（纯数字，无小数点） */
function formatInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** 价格格式化：保留到 priceTick 精度 */
function formatPrice(n: number, tick: number): string {
  const decimals = tick < 1 ? String(tick).length - 1 : 0
  return n.toFixed(decimals)
}

/**
 * OrderQuotePanel — 报单弹窗左栏行情面板
 *
 * 合约头（代码 + 名称 + 涨跌）→ 五档盘口（点击写方向/价格）→ 行情速览。
 * 与 MarketPanel 侧栏的 DepthQuote 接线一致：点卖档 = 买入价，点买档 = 卖出价。
 */
export function OrderQuotePanel({ instrumentID, snapshot, priceTick }: OrderQuotePanelProps) {
  const contracts = useContractsStore((s) => s.contracts)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)

  const contract = contracts.find((c) => c.instrumentID === instrumentID)

  // ── 涨跌计算 ──
  const { changeVal, changePct, changeClass } = useMemo(() => {
    if (!snapshot || !snapshot.lastPrice || !snapshot.preSettlementPrice) {
      return { changeVal: '—', changePct: '—', changeClass: 'flat' }
    }
    const val = snapshot.lastPrice - snapshot.preSettlementPrice
    const pct = snapshot.preSettlementPrice !== 0
      ? (val / snapshot.preSettlementPrice) * 100
      : 0
    return {
      changeVal: (val >= 0 ? '+' : '') + formatPrice(val, priceTick),
      changePct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      changeClass: val > 0 ? 'up' : val < 0 ? 'down' : 'flat',
    }
  }, [snapshot, priceTick])

  // 点盘口档位 → 直接写方向 + 价格（同 MarketPanel 模式）
  const handleBuyClick = (price: number) => setOrderForm({ direction: 'buy', limitPrice: price })
  const handleSellClick = (price: number) => setOrderForm({ direction: 'sell', limitPrice: price })

  return (
    <div className="order-quote">
      {/* ── 合约头 ── */}
      <div className="order-quote__header">
        <div className="order-quote__contract">
          <span className="order-quote__code">{instrumentID}</span>
          {contract && (
            <span className="order-quote__name">{contract.instrumentName}</span>
          )}
        </div>
        <div className={`order-quote__change order-quote__change--${changeClass}`}>
          <span className="order-quote__change-val">{changeVal}</span>
          <span className="order-quote__change-pct">{changePct}</span>
        </div>
      </div>

      {/* ── 五档盘口 ── */}
      <DepthQuote
        snapshot={snapshot}
        priceTick={priceTick}
        onBuyClick={handleBuyClick}
        onSellClick={handleSellClick}
      />

      {/* ── 行情速览 ── */}
      <div className="order-quote__stats">
        <div className="order-quote__cell">
          <span className="order-quote__label">今开</span>
          <span className="order-quote__value">{snapshot?.openPrice != null ? formatPrice(snapshot.openPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">最高</span>
          <span className="order-quote__value order-quote__value--up">{snapshot?.highestPrice != null ? formatPrice(snapshot.highestPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">最低</span>
          <span className="order-quote__value order-quote__value--down">{snapshot?.lowestPrice != null ? formatPrice(snapshot.lowestPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">昨结</span>
          <span className="order-quote__value">{snapshot?.preSettlementPrice != null ? formatPrice(snapshot.preSettlementPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">涨停</span>
          <span className="order-quote__value order-quote__value--up">{snapshot?.upperLimitPrice != null ? formatPrice(snapshot.upperLimitPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">跌停</span>
          <span className="order-quote__value order-quote__value--down">{snapshot?.lowerLimitPrice != null ? formatPrice(snapshot.lowerLimitPrice, priceTick) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">成交量</span>
          <span className="order-quote__value">{snapshot?.volume != null ? formatInt(snapshot.volume) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">持仓</span>
          <span className="order-quote__value">{snapshot?.openInterest != null ? formatInt(snapshot.openInterest) : '—'}</span>
        </div>
        <div className="order-quote__cell">
          <span className="order-quote__label">交易所</span>
          <span className="order-quote__value order-quote__value--muted">{contract?.exchangeID || '—'}</span>
        </div>
      </div>
    </div>
  )
}
