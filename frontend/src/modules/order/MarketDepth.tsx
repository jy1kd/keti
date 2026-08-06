import type { CSSProperties } from 'react'
import type { MarketSnapshot } from '@/services/types'
import './MarketDepth.css'

interface MarketDepthProps {
  snapshot: MarketSnapshot | null
  /** 合约最小变动价位：无真实挂单价时以买一/卖一 ± n×priceTick 合成兜底 */
  priceTick: number
}

/** CTP 用 DBL_MAX (1.7976931348623157e+308) 表示无效价格 */
const CTP_INVALID_PRICE = 1.7976931348623157e+308
const isValidPrice = (price: number) => price > 0 && price < CTP_INVALID_PRICE

/** 单档解析结果：真实盘口有效 或 tick 合成兜底价 */
export interface ResolvedLevel {
  price: number
  volume: number
  /** 真实盘口挂单有效 */
  valid: boolean
  /** tick 合成兜底价；null 表示无兜底 */
  fallback: number | null
}

/** 按 priceTick 精度格式化价格（0.2 → 1位小数，0.05 → 2位） */
function formatTickPrice(n: number, tick: number): string {
  const str = String(tick)
  const decimals = str.includes('.') ? str.split('.')[1].length : 0
  return n.toFixed(decimals)
}

/** tick 的小数位数（0.2 → 1，0.05 → 2） */
function tickDecimals(tick: number): number {
  const str = String(tick)
  return str.includes('.') ? str.split('.')[1].length : 0
}

/** 基准回退：买一/卖一有效用真实价，否则回退最新价 */
function resolveLevel(price: number, volume: number, fallback: number | null): ResolvedLevel {
  if (isValidPrice(price)) return { price, volume, valid: true, fallback: null }
  return { price: fallback ?? price, volume, valid: false, fallback }
}

/**
 * 解析快照五档（复用 DepthQuote 的 tick 合成兜底逻辑）：
 * 买档合成 买n = 买一基准 - (n-1)×tick；卖档合成 卖n = 卖一基准 + (n-1)×tick。
 */
function resolveDepth(snapshot: MarketSnapshot, tick: number | null) {
  const last = isValidPrice(snapshot.lastPrice) ? snapshot.lastPrice : null
  const bidBase = isValidPrice(snapshot.bidPrice1) ? snapshot.bidPrice1 : last
  const askBase = isValidPrice(snapshot.askPrice1) ? snapshot.askPrice1 : last

  const bidFallback = (n: number): number | null =>
    bidBase !== null && tick !== null ? bidBase - n * tick : null
  const askFallback = (n: number): number | null =>
    askBase !== null && tick !== null ? askBase + n * tick : null

  const bids = [
    resolveLevel(snapshot.bidPrice1, snapshot.bidVolume1, bidFallback(0)),
    resolveLevel(snapshot.bidPrice2, snapshot.bidVolume2, bidFallback(1)),
    resolveLevel(snapshot.bidPrice3, snapshot.bidVolume3, bidFallback(2)),
    resolveLevel(snapshot.bidPrice4, snapshot.bidVolume4, bidFallback(3)),
    resolveLevel(snapshot.bidPrice5, snapshot.bidVolume5, bidFallback(4)),
  ]
  const asks = [
    resolveLevel(snapshot.askPrice1, snapshot.askVolume1, askFallback(0)),
    resolveLevel(snapshot.askPrice2, snapshot.askVolume2, askFallback(1)),
    resolveLevel(snapshot.askPrice3, snapshot.askVolume3, askFallback(2)),
    resolveLevel(snapshot.askPrice4, snapshot.askVolume4, askFallback(3)),
    resolveLevel(snapshot.askPrice5, snapshot.askVolume5, askFallback(4)),
  ]
  return { asks, bids, last }
}

/**
 * MarketDepth — 三列十档盘口（核心报单区）
 *
 * 布局：`买入 | 价格 | 卖出` 三列 × 十档单表。
 * 卖盘 5 档在上（价格高→低，卖五顶、卖一贴最新价线），最新价分隔线，买盘 5 档在下（买一顶、买五底）。
 * 汇总行：委买总量 | 最新价+涨跌 | 委卖总量。
 * 无真实挂单价沿用 tick 合成兜底；`DepthQuote.tsx` 保留给 MarketPanel 侧栏。
 */
export function MarketDepth({ snapshot, priceTick }: MarketDepthProps) {
  const tick = priceTick > 0 ? priceTick : null

  if (!snapshot) {
    return <div className="market-depth market-depth--empty">--</div>
  }

  const { asks, bids, last } = resolveDepth(snapshot, tick)

  // 汇总：委买/委卖总量（仅统计有效档位量）
  const totalBidVol = bids.reduce((sum, l) => sum + (l.valid ? l.volume : 0), 0)
  const totalAskVol = asks.reduce((sum, l) => sum + (l.valid ? l.volume : 0), 0)
  // 量能条基准：十档最大量（含买/卖全部有效档）
  const maxVol = Math.max(
    0,
    ...bids.filter((l) => l.valid).map((l) => l.volume),
    ...asks.filter((l) => l.valid).map((l) => l.volume),
  )

  // 涨跌：相对昨结，涨红跌绿带箭头
  const preSettle = isValidPrice(snapshot.preSettlementPrice) ? snapshot.preSettlementPrice : null
  let changeText = '--'
  let changeClass = 'flat'
  if (last !== null && preSettle !== null && preSettle > 0) {
    const diff = last - preSettle
    const decimals = tick !== null ? tickDecimals(tick) : 0
    changeText = (diff >= 0 ? '+' : '') + diff.toFixed(decimals)
    changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  }

  return (
    <div className="market-depth">
      <DepthHeader />
      <DepthSummaryRow
        totalBidVol={totalBidVol}
        totalAskVol={totalAskVol}
        lastText={last !== null ? String(last) : '--'}
        changeText={changeText}
        changeClass={changeClass}
      />
      <DepthLadder asks={asks} bids={bids} tick={tick} maxVol={maxVol} />
    </div>
  )
}

/** ① 表头：买入 | 价格 | 卖出 */
function DepthHeader() {
  return (
    <div className="depth-header">
      <span className="depth-header__buy">买入</span>
      <span className="depth-header__price">价格</span>
      <span className="depth-header__sell">卖出</span>
    </div>
  )
}

/** ② 汇总行：委买总量 | 最新价+涨跌 | 委卖总量 */
interface DepthSummaryRowProps {
  totalBidVol: number
  totalAskVol: number
  lastText: string
  changeText: string
  changeClass: string
}

function DepthSummaryRow({ totalBidVol, totalAskVol, lastText, changeText, changeClass }: DepthSummaryRowProps) {
  return (
    <div className="depth-summary">
      <span className="depth-summary__bid">
        <span className="depth-summary__label">委买</span>
        <span className="depth-summary__value">{totalBidVol}</span>
      </span>
      <span className="depth-summary__last">
        <span className="depth-summary__last-price">{lastText}</span>
        <span className={`depth-summary__change depth-summary__change--${changeClass}`}>
          {changeText}
        </span>
      </span>
      <span className="depth-summary__ask">
        <span className="depth-summary__label">委卖</span>
        <span className="depth-summary__value">{totalAskVol}</span>
      </span>
    </div>
  )
}

/** ③ 十档梯形表：5×ask + 最新价分隔线 + 5×bid */
function DepthLadder({
  asks,
  bids,
  tick,
  maxVol,
}: {
  asks: ResolvedLevel[]
  bids: ResolvedLevel[]
  tick: number | null
  maxVol: number
}) {
  return (
    <div className="depth-ladder" data-testid="depth-ladder">
      {/* 卖盘：价格高→低，卖五顶、卖一贴最新价线（asks 反转渲染） */}
      {[...asks].reverse().map((level, i) => (
        <DepthRow key={`ask-${i}`} kind="ask" index={5 - i} level={level} tick={tick} maxVol={maxVol} />
      ))}
      <LastPriceDivider />
      {/* 买盘：买一顶、买五底 */}
      {bids.map((level, i) => (
        <DepthRow key={`bid-${i}`} kind="bid" index={i + 1} level={level} tick={tick} maxVol={maxVol} />
      ))}
    </div>
  )
}

/** ④ 最新价分隔线：标记买/卖盘分界 */
function LastPriceDivider() {
  return <div className="depth-last-divider" aria-hidden="true" />
}

/**
 * 单档 DepthRow — 三列语义（列语义硬绑定，杜绝买卖混淆）：
 *
 * | 列 | 内容 | 视觉 | 交互 |
 * |---|---|---|---|
 * | 买入列 | 买盘档显示买量 / 卖盘档留空 | 红系 + 量能条（买盘档）/ 红渐变空底（卖盘档） | 点击 → 以本档价挂买单 |
 * | 价格列 | 该档委托价 | 主色等宽居中 | 点击 → 只填改价框（不直接下单） |
 * | 卖出列 | 卖盘档显示卖量 / 买盘档留空 | 绿系 + 量能条（卖盘档）/ 绿渐变空底（买盘档） | 点击 → 以本档价挂卖单 |
 *
 * `--` 表示无挂单量，弱化为次级灰（`depth-row__muted`）。
 * 量能条：背景填充宽度 = 该档量 / 十档最大量（`--vol-pct`）。
 * 完全无效档（无价无兜底）不可点击。
 */
export function DepthRow({
  kind,
  index,
  level,
  tick,
  maxVol,
  onBuyClick,
  onSellClick,
  onPriceClick,
}: {
  kind: 'ask' | 'bid'
  index: number
  level: ResolvedLevel
  tick: number | null
  maxVol: number
  onBuyClick?: (price: number) => void
  onSellClick?: (price: number) => void
  onPriceClick?: (price: number) => void
}) {
  const priceText = level.valid
    ? String(level.price)
    : level.fallback !== null && tick !== null
      ? formatTickPrice(level.price, tick)
      : '--'
  const volText = level.valid ? String(level.volume) : '--'
  const buyText = kind === 'bid' ? volText : '--'
  const sellText = kind === 'ask' ? volText : '--'

  // 量能条：仅量所在列填充；pct = 该档量 / 十档最大量
  const pct = level.valid && maxVol > 0 ? Math.round((level.volume / maxVol) * 100) : 0
  const buyPct = kind === 'bid' ? pct : 0
  const sellPct = kind === 'ask' ? pct : 0
  const buyStyle = { '--vol-pct': `${buyPct}%` } as CSSProperties
  const sellStyle = { '--vol-pct': `${sellPct}%` } as CSSProperties

  // 可点价：真实价或合成兜底价；完全无效档不可点
  const clickable = level.valid || level.fallback !== null

  return (
    <div className={`depth-row depth-row--${kind}`} data-testid={`${kind}-${index}`}>
      <span
        className={`depth-row__buy${buyText === '--' ? ' depth-row__muted' : ''}`}
        style={buyStyle}
        onClick={() => clickable && onBuyClick?.(level.price)}
      >
        {buyText}
      </span>
      <span className="depth-row__price" onClick={() => clickable && onPriceClick?.(level.price)}>
        {priceText}
      </span>
      <span
        className={`depth-row__sell${sellText === '--' ? ' depth-row__muted' : ''}`}
        style={sellStyle}
        onClick={() => clickable && onSellClick?.(level.price)}
      >
        {sellText}
      </span>
    </div>
  )
}
