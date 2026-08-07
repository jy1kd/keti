import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MarketSnapshot } from '@/services/types'
import { useOrderStore } from './store'
import { useOrderPopupStore } from './popupStore'
import { useQueryStore } from '../query/store'
import { aggregateMyOrders, type MyOrderLevel } from './myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { OrderRequestForm } from '@/utils/orderMapping'
import './MarketDepth.css'

/** 点价/快捷下单意图（点击瞬间锁定 方向/价格/手数/开平/有效期，确认后据此报单） */
interface OrderIntent {
  direction: 'buy' | 'sell'
  price: number
  volume: number
  combOffsetFlag: OrderRequestForm['combOffsetFlag']
  timeCondition: OrderRequestForm['timeCondition']
}

const OFFSET_LABEL: Record<string, string> = {
  open: '开',
  close: '平',
  close_today: '平今',
}

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

  const orderForm = useOrderStore((s) => s.orderForm)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const submitOrder = useOrderStore((s) => s.submitOrder)
  const [quickPrice, setQuickPrice] = useState(0)
  const [intent, setIntent] = useState<OrderIntent | null>(null)

  // ── 我方挂单量（P3）：拉取报单流水并定期刷新，按 合约+限价+方向 聚合匹配档位 ──
  const orders = useQueryStore((s) => s.orders)
  const instrumentID = snapshot?.instrumentID ?? ''
  useEffect(() => {
    if (!instrumentID) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      await useQueryStore.getState().fetchOrders()
      if (disposed) return
      timer = setTimeout(load, 10_000)
    }
    load()
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [instrumentID])
  const myOrders = useMemo(() => aggregateMyOrders(orders, instrumentID), [orders, instrumentID])

  // ── 乐观渲染（P3）：确认报单 → 档位立即半透明 pending；成功由真实挂单接替转实态，失败回滚 + 顶部红条 ──
  interface PendingOrder {
    id: number
    direction: 'buy' | 'sell'
    price: number
    volume: number
    status: 'pending' | 'error'
  }
  const [pending, setPending] = useState<PendingOrder[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const pendingIdRef = useRef(0)

  // pending 转实态：当聚合中出现同档同向真实挂单（refreshOrders 拉到）→ 移除 pending（由实态徽标接管）
  useEffect(() => {
    if (pending.length === 0) return
    setPending((prev) => {
      const next = prev.filter((p) => {
        if (p.status !== 'pending') return true
        const level = myOrders.byPrice.get(p.price)
        if (!level) return true
        return (p.direction === 'buy' ? level.buyVolume : level.sellVolume) === 0
      })
      return next.length === prev.length ? prev : next
    })
  }, [myOrders])

  // 按价格汇总 pending 量（档位徽标用）
  const pendingByPrice = useMemo(() => {
    const m = new Map<number, { buy: number; sell: number }>()
    for (const p of pending) {
      if (p.status !== 'pending') continue
      const cur = m.get(p.price) ?? { buy: 0, sell: 0 }
      if (p.direction === 'buy') cur.buy += p.volume
      else cur.sell += p.volume
      m.set(p.price, cur)
    }
    return m
  }, [pending])

  // 改价框默认价：对手价（卖一）→ 最新价
  const quickDefault = useMemo(() => {
    if (!snapshot) return null
    if (isValidPrice(snapshot.askPrice1)) return snapshot.askPrice1
    if (isValidPrice(snapshot.lastPrice)) return snapshot.lastPrice
    return null
  }, [snapshot])
  // 合约变更重置：仅首帧/合约切换时重新跟随默认价。
  // 否则每次 WS tick 更新 snapshot 都会重置改价框，手动改价/点价格列后即被覆写（🟡-1）。
  const prevInstrRef = useRef<string | null>(null)
  useEffect(() => {
    const instr = snapshot?.instrumentID ?? null
    if (instr !== prevInstrRef.current) {
      prevInstrRef.current = instr
      setQuickPrice(0)
    }
  }, [snapshot])
  // 仅当用户尚未改价（quickPrice === 0）时同步默认价；用户改价/点价格列后停止自动跟随
  useEffect(() => {
    if (quickDefault !== null && quickPrice === 0) setQuickPrice(quickDefault)
  }, [quickDefault, quickPrice])

  // 点价确认框打开 → 同步 popupStore.confirmOpen：弹窗内 Esc 优先取消确认框而非关弹窗
  useEffect(() => {
    useOrderPopupStore.getState().setConfirmOpen(!!intent)
    return () => useOrderPopupStore.getState().setConfirmOpen(false)
  }, [intent])

  if (!snapshot) {
    return <div className="market-depth market-depth--empty">--</div>
  }

  const { asks, bids, last } = resolveDepth(snapshot, tick)

  // 汇总：委买/委卖总量 = 所有档位量之和（含合成价档；档位量 > 0 即计入，与行内展示一致）。
  // SimNow 测试环境五档仅第 1 档有真实价/量（2-5 档 CTP 返回 DBL_MAX → 0 价 0 量），故真实数据下 委买/委卖 即为买一/卖一量。
  const totalBidVol = bids.reduce((sum, l) => sum + (l.volume > 0 ? l.volume : 0), 0)
  const totalAskVol = asks.reduce((sum, l) => sum + (l.volume > 0 ? l.volume : 0), 0)
  // 量能条基准：十档最大量（含买/卖全部有量档）
  const maxVol = Math.max(
    0,
    ...bids.filter((l) => l.volume > 0).map((l) => l.volume),
    ...asks.filter((l) => l.volume > 0).map((l) => l.volume),
  )

  // 涨跌：相对昨结，涨红跌绿带箭头
  const preSettle = isValidPrice(snapshot.preSettlementPrice) ? snapshot.preSettlementPrice : null
  let changeText = '--'
  let changeClass = 'flat'
  if (last !== null && preSettle !== null && preSettle > 0) {
    const diff = last - preSettle
    const decimals = tick !== null ? tickDecimals(tick) : 0
    changeText = (diff > 0 ? '+' : '') + diff.toFixed(decimals)
    changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  }

  // ── 点价确认闭环 ──
  // 点买/卖列 → 锁定 OrderIntent（方向/价格/手数/开平/有效期）→ 必弹确认框 → 确认后 submitOrder。
  // 每次必弹确认，不提供免确认模式。价格列点击只填改价框，不直接下单。
  const openIntent = (direction: 'buy' | 'sell', price: number) => {
    setIntent({
      direction,
      price,
      volume: orderForm.volumeTotalOriginal,
      combOffsetFlag: orderForm.combOffsetFlag,
      timeCondition: orderForm.timeCondition,
    })
  }

  // ── 点价语义（P3 扩展）：档位含我方挂单 → 撤该档挂单；否则 → 弹确认报单 ──
  const cancelLevel = async (direction: 'buy' | 'sell', price: number) => {
    const level = myOrders.byPrice.get(price)
    if (!level) return
    const refs = direction === 'buy' ? level.buyRefs : level.sellRefs
    if (refs.length === 0) return
    for (const ref of refs) {
      await useQueryStore.getState().handleCancelOrder(ref)
    }
    useQueryStore.getState().fetchOrders()
  }

  const handleBuyClick = (price: number) => {
    const level = myOrders.byPrice.get(price)
    if (level && level.buyVolume > 0) {
      cancelLevel('buy', price)
      return
    }
    openIntent('buy', price)
  }

  const handleSellClick = (price: number) => {
    const level = myOrders.byPrice.get(price)
    if (level && level.sellVolume > 0) {
      cancelLevel('sell', price)
      return
    }
    openIntent('sell', price)
  }

  const handleConfirm = async () => {
    if (!intent) return
    // 乐观渲染：确认瞬间档位立即出现半透明 pending（以当前手数显示）
    const id = ++pendingIdRef.current
    const pe: PendingOrder = {
      id,
      direction: intent.direction,
      price: intent.price,
      volume: intent.volume,
      status: 'pending',
    }
    setPending((prev) => [...prev, pe])

    setOrderForm({
      direction: intent.direction,
      limitPrice: intent.price,
      volumeTotalOriginal: intent.volume,
      combOffsetFlag: intent.combOffsetFlag,
      timeCondition: intent.timeCondition,
    })
    const ok = await submitOrder()
    if (ok) {
      // 成功：刷新挂单让真实单接替（转实态由聚合 effect 完成）；若一直未被接替（如立即全部成交/撤单）10s 后清理
      useQueryStore.getState().fetchOrders()
      window.setTimeout(() => {
        setPending((prev) => prev.filter((p) => p.id !== id))
      }, 10_000)
    } else {
      // 失败回滚：pending 移除，顶部红条展示原因（store.lastSubmitError）
      setPending((prev) => prev.filter((p) => p.id !== id))
      setBanner(useOrderStore.getState().lastSubmitError ?? '报单失败')
      window.setTimeout(() => setBanner(null), 4000)
    }
    setIntent(null)
  }

  return (
    <div className="market-depth">
      {banner && (
        <div className="market-depth__banner" data-testid="md-banner" role="alert">
          {banner}
        </div>
      )}
      <DepthHeader />
      <DepthSummaryRow
        totalBidVol={totalBidVol}
        totalAskVol={totalAskVol}
        myBuyCount={myOrders.totalBuyCount}
        mySellCount={myOrders.totalSellCount}
        lastText={last !== null ? (tick !== null ? formatTickPrice(last, tick) : String(last)) : '--'}
        changeText={changeText}
        changeClass={changeClass}
      />
      <DepthLadder
        asks={asks}
        bids={bids}
        tick={tick}
        maxVol={maxVol}
        myLevels={myOrders.byPrice}
        pendingByPrice={pendingByPrice}
        onBuyClick={handleBuyClick}
        onSellClick={handleSellClick}
        onPriceClick={setQuickPrice}
      />
      <QuickTradeBar
        snapshot={snapshot}
        priceTick={priceTick}
        volume={orderForm.volumeTotalOriginal}
        value={quickPrice}
        onChangePrice={setQuickPrice}
        onBuy={(price) => openIntent('buy', price)}
        onSell={(price) => openIntent('sell', price)}
      />
      {intent && (
        <ConfirmDialog
          title="确认报单"
          details={[
            { label: '方向', value: intent.direction === 'buy' ? '买入' : '卖出' },
            {
              label: '价格',
              value: tick !== null ? formatTickPrice(intent.price, tick) : String(intent.price),
            },
            { label: '手数', value: String(intent.volume) },
            { label: '开平', value: OFFSET_LABEL[intent.combOffsetFlag] ?? intent.combOffsetFlag },
          ]}
          onConfirm={handleConfirm}
          onCancel={() => setIntent(null)}
        />
      )}
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

/** ② 汇总行：委买总量(我方挂单数) | 最新价+涨跌 | 委卖总量(我方挂单数) */
interface DepthSummaryRowProps {
  totalBidVol: number
  totalAskVol: number
  /** 我方买/卖活动挂单笔数（>0 时以 (N) 展示） */
  myBuyCount: number
  mySellCount: number
  lastText: string
  changeText: string
  changeClass: string
}

function DepthSummaryRow({
  totalBidVol,
  totalAskVol,
  myBuyCount,
  mySellCount,
  lastText,
  changeText,
  changeClass,
}: DepthSummaryRowProps) {
  return (
    <div className="depth-summary" data-testid="depth-summary">
      <span className="depth-summary__bid">
        <span className="depth-summary__label">委买</span>
        <span className="depth-summary__value">
          {totalBidVol}
          {myBuyCount > 0 && <span className="depth-summary__my">({myBuyCount})</span>}
        </span>
      </span>
      <span className="depth-summary__last">
        <span className="depth-summary__last-price">{lastText}</span>
        <span className={`depth-summary__change depth-summary__change--${changeClass}`}>
          {changeText}
        </span>
      </span>
      <span className="depth-summary__ask">
        <span className="depth-summary__label">委卖</span>
        <span className="depth-summary__value">
          {totalAskVol}
          {mySellCount > 0 && <span className="depth-summary__my">({mySellCount})</span>}
        </span>
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
  myLevels,
  pendingByPrice,
  onBuyClick,
  onSellClick,
  onPriceClick,
}: {
  asks: ResolvedLevel[]
  bids: ResolvedLevel[]
  tick: number | null
  maxVol: number
  /** 按价格索引的我方挂单量（P3）：匹配档位显示徽标，点击即撤 */
  myLevels: Map<number, MyOrderLevel>
  /** 按价格索引的乐观 pending 量（P3-4）：半透明徽标，成功转实态后移除 */
  pendingByPrice: Map<number, { buy: number; sell: number }>
  onBuyClick?: (price: number) => void
  onSellClick?: (price: number) => void
  onPriceClick?: (price: number) => void
}) {
  return (
    <div className="depth-ladder" data-testid="depth-ladder">
      {/* 卖盘：价格高→低，卖五顶、卖一贴最新价线（asks 反转渲染） */}
      {[...asks].reverse().map((level, i) => (
        <DepthRow
          key={`ask-${i}`}
          kind="ask"
          index={5 - i}
          level={level}
          tick={tick}
          maxVol={maxVol}
          myBuyVol={myLevels.get(level.price)?.buyVolume ?? 0}
          mySellVol={myLevels.get(level.price)?.sellVolume ?? 0}
          pendingBuyVol={pendingByPrice.get(level.price)?.buy ?? 0}
          pendingSellVol={pendingByPrice.get(level.price)?.sell ?? 0}
          onBuyClick={onBuyClick}
          onSellClick={onSellClick}
          onPriceClick={onPriceClick}
        />
      ))}
      <LastPriceDivider />
      {/* 买盘：买一顶、买五底 */}
      {bids.map((level, i) => (
        <DepthRow
          key={`bid-${i}`}
          kind="bid"
          index={i + 1}
          level={level}
          tick={tick}
          maxVol={maxVol}
          myBuyVol={myLevels.get(level.price)?.buyVolume ?? 0}
          mySellVol={myLevels.get(level.price)?.sellVolume ?? 0}
          pendingBuyVol={pendingByPrice.get(level.price)?.buy ?? 0}
          pendingSellVol={pendingByPrice.get(level.price)?.sell ?? 0}
          onBuyClick={onBuyClick}
          onSellClick={onSellClick}
          onPriceClick={onPriceClick}
        />
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
  myBuyVol = 0,
  mySellVol = 0,
  pendingBuyVol = 0,
  pendingSellVol = 0,
  onBuyClick,
  onSellClick,
  onPriceClick,
}: {
  kind: 'ask' | 'bid'
  index: number
  level: ResolvedLevel
  tick: number | null
  maxVol: number
  /** 本档位我方买单挂单量（>0 显示徽标，点击 → 撤该档买单） */
  myBuyVol?: number
  /** 本档位我方卖单挂单量 */
  mySellVol?: number
  /** 本档位乐观 pending 买单量（半透明徽标，P3-4） */
  pendingBuyVol?: number
  /** 本档位乐观 pending 卖单量 */
  pendingSellVol?: number
  onBuyClick?: (price: number) => void
  onSellClick?: (price: number) => void
  onPriceClick?: (price: number) => void
}) {
  // 真实档与合成档统一按 tickSize 还原展示精度（设计 §6），避免 4696 与 4696.6 列不对齐
  const hasPrice = level.valid || level.fallback !== null
  const priceText = hasPrice
    ? tick !== null
      ? formatTickPrice(level.price, tick)
      : String(level.price)
    : '--'
  // 档位量：量 > 0 即展示（与汇总行统计口径一致：委买/委卖 = 所有档位量之和）
  const volText = level.volume > 0 ? String(level.volume) : '--'
  const buyText = kind === 'bid' ? volText : '--'
  const sellText = kind === 'ask' ? volText : '--'

  // 量能条：仅量所在列填充；pct = 该档量 / 十档最大量
  const pct = level.volume > 0 && maxVol > 0 ? Math.round((level.volume / maxVol) * 100) : 0
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
        {myBuyVol > 0 && <em className="depth-row__my depth-row__my--buy">{myBuyVol}</em>}
        {pendingBuyVol > 0 && (
          <em className="depth-row__my depth-row__my--pending">{pendingBuyVol}</em>
        )}
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
        {mySellVol > 0 && <em className="depth-row__my depth-row__my--sell">{mySellVol}</em>}
        {pendingSellVol > 0 && (
          <em className="depth-row__my depth-row__my--pending">{pendingSellVol}</em>
        )}
      </span>
    </div>
  )
}

interface QuickTradeBarProps {
  snapshot: MarketSnapshot | null
  /** 合约最小变动价位 */
  priceTick: number
  /** 下单手数（来自参数区，按钮文字联动） */
  volume: number
  /** 改价框当前价（父级控制：默认对手价/最新价，价格列点击可写入） */
  value: number
  /** 改价框提交新价（tick 对齐 + 涨跌停夹紧后） */
  onChangePrice: (v: number) => void
  /** 点买入 → 以改价框价格 + 当前手数限价报单 */
  onBuy: (price: number) => void
  /** 点卖出 → 以改价框价格 + 当前手数限价报单 */
  onSell: (price: number) => void
}

/**
 * QuickTradeBar — 改价 + 快捷买卖栏（内嵌于 MarketDepth 底部，精简/完整态均显示）
 *
 * 价格步进框显示 `value`，按 tickSize 步进、键盘可输入；
 * 提交时做涨跌停夹紧 + 最小变动价位对齐校验，经 `onChangePrice` 上报。
 * `买入N手`（红）/ `卖出N手`（绿）文字随手数联动；手数 < 1 时禁用。
 */
export function QuickTradeBar({
  snapshot,
  priceTick,
  volume,
  value,
  onChangePrice,
  onBuy,
  onSell,
}: QuickTradeBarProps) {
  const tick = priceTick > 0 ? priceTick : null
  const [input, setInput] = useState('')

  // 涨跌停夹紧区间；快照缺失时放宽（无快照则整体禁用）
  const upper =
    snapshot && isValidPrice(snapshot.upperLimitPrice) ? snapshot.upperLimitPrice : Number.MAX_SAFE_INTEGER
  const lower = snapshot && isValidPrice(snapshot.lowerLimitPrice) ? snapshot.lowerLimitPrice : 0

  // 外部 value 变化（价格列点击 / 步进）→ 同步输入框显示
  useEffect(() => {
    if (tick !== null) {
      setInput(formatTickPrice(value, tick))
    }
  }, [value, tick])

  /** 提交：解析 → tick 对齐 → 涨跌停夹紧 → 上报 */
  const commit = (raw: string) => {
    if (tick === null) return
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return
    const aligned = Math.round(n / tick) * tick
    const clamped = Math.min(upper, Math.max(lower, aligned))
    setInput(formatTickPrice(clamped, tick))
    onChangePrice(clamped)
  }

  /** 步进：tickSize 加减，夹紧到涨跌停区间 → 上报 */
  const step = (dir: 1 | -1) => {
    if (tick === null) return
    const cur = parseFloat(input)
    if (!Number.isFinite(cur)) return
    const next = Math.min(upper, Math.max(lower, cur + dir * tick))
    setInput(formatTickPrice(next, tick))
    onChangePrice(next)
  }

  const price = parseFloat(input)
  const priceValid = Number.isFinite(price)
  const canTrade = priceValid && volume >= 1 && snapshot !== null

  return (
    <div className="qtb">
      <button
        type="button"
        className="qtb__btn qtb__btn--buy"
        data-testid="qtb-buy"
        disabled={!canTrade}
        onClick={() => canTrade && onBuy(price)}
      >
        买入{volume}手
      </button>
      <div className="qtb__price">
        <input
          data-testid="qtb-price"
          className="qtb__price-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value)
          }}
          disabled={!snapshot}
        />
        <div className="qtb__steps">
          <button
            type="button"
            data-testid="qtb-step-up"
            className="qtb__step"
            aria-label="加价"
            disabled={!snapshot}
            onClick={() => step(1)}
          >
            ▲
          </button>
          <button
            type="button"
            data-testid="qtb-step-down"
            className="qtb__step"
            aria-label="减价"
            disabled={!snapshot}
            onClick={() => step(-1)}
          >
            ▼
          </button>
        </div>
      </div>
      <button
        type="button"
        className="qtb__btn qtb__btn--sell"
        data-testid="qtb-sell"
        disabled={!canTrade}
        onClick={() => canTrade && onSell(price)}
      >
        卖出{volume}手
      </button>
    </div>
  )
}
