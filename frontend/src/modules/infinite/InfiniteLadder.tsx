import { useEffect, useMemo, useRef, useState } from 'react'
import type { MarketSnapshot } from '@/services/types'
import { useQueryStore } from '@/modules/query/store'
import { aggregateMyOrders } from '@/modules/order/myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useInfiniteOrderStore, type InfiniteOrderIntent } from './store'
import { buildPriceAxis, buildDepthMaps, isValidPrice, roundToTick, formatTickPrice } from './ladderUtils'
import './InfiniteLadder.css'

const ROW_HEIGHT = 24
const OVERSCAN = 10
const OFFSET_LABEL: Record<string, string> = { open: '开', close: '平', close_today: '平今' }

interface InfiniteLadderProps {
  snapshot: MarketSnapshot | null
  priceTick: number
  instrumentID: string
}

export function InfiniteLadder({ snapshot, priceTick, instrumentID }: InfiniteLadderProps) {
  const volume = useInfiniteOrderStore((s) => s.volumeTotalOriginal)
  const combOffsetFlag = useInfiniteOrderStore((s) => s.combOffsetFlag)
  const timeCondition = useInfiniteOrderStore((s) => s.timeCondition)
  const submitOrder = useInfiniteOrderStore((s) => s.submitOrder)
  const orders = useQueryStore((s) => s.orders)
  const handleCancelOrder = useQueryStore((s) => s.handleCancelOrder)

  const [intent, setIntent] = useState<InfiniteOrderIntent | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const axis = useMemo(
    () => buildPriceAxis(snapshot?.lowerLimitPrice ?? 0, snapshot?.upperLimitPrice ?? 0, priceTick),
    [snapshot, priceTick],
  )
  const depth = useMemo(
    () => (snapshot ? buildDepthMaps(snapshot) : { bidVol: new Map<number, number>(), askVol: new Map<number, number>() }),
    [snapshot],
  )
  const myOrders = useMemo(() => aggregateMyOrders(orders, instrumentID), [orders, instrumentID])

  const lastPrice = snapshot && isValidPrice(snapshot.lastPrice) ? roundToTick(snapshot.lastPrice, priceTick) : null
  const lastIndex = lastPrice !== null ? axis.indexOf(lastPrice) : -1

  const maxVol = useMemo(() => {
    let m = 0
    depth.bidVol.forEach((v) => { if (v > m) m = v })
    depth.askVol.forEach((v) => { if (v > m) m = v })
    return m
  }, [depth])

  // ── 窗口化 ──
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const followRef = useRef(true)
  const programmaticRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setViewportH(el.clientHeight || 600)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const centerOn = (index: number) => {
    const el = viewportRef.current
    if (!el || index < 0) return
    programmaticRef.current = true
    el.scrollTop = Math.max(0, index * ROW_HEIGHT - el.clientHeight / 2 + ROW_HEIGHT / 2)
  }

  useEffect(() => {
    if (lastIndex >= 0 && followRef.current) centerOn(lastIndex)
  }, [lastIndex, viewportH])

  useEffect(() => {
    followRef.current = true
    if (lastIndex >= 0) centerOn(lastIndex)
  }, [instrumentID])

  const onScroll = () => {
    const el = viewportRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (programmaticRef.current) {
      programmaticRef.current = false
      return
    }
    followRef.current = false
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => { followRef.current = true }, 3000)
  }

  useEffect(() => () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }, [])

  const totalH = axis.length * ROW_HEIGHT
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(axis.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN)

  const openIntent = (direction: 'buy' | 'sell', price: number) => {
    setIntent({ direction, price, volume, combOffsetFlag, timeCondition })
  }

  const cancelMyOrders = async (refs: string[]) => {
    for (const ref of refs) await handleCancelOrder(ref)
    useQueryStore.getState().fetchOrders()
  }

  const handleConfirm = async () => {
    if (!intent) return
    setIntent(null)
    const ok = await submitOrder(intent)
    if (ok) {
      useQueryStore.getState().fetchOrders()
    } else {
      setBanner(useInfiniteOrderStore.getState().lastSubmitError ?? '报单失败')
      setTimeout(() => setBanner(null), 4000)
    }
  }

  if (!snapshot || axis.length === 0) {
    return <div className="infinite-ladder infinite-ladder--empty">未订阅行情或涨跌停价无效</div>
  }

  return (
    <div className="infinite-ladder">
      {banner && <div className="infinite-ladder__banner" role="alert">{banner}</div>}
      <div className="infinite-ladder__head">
        <span className="ladder-head__cell ladder-head__cell--cancel">可撤</span>
        <span className="ladder-head__cell ladder-head__cell--buy">买入</span>
        <span className="ladder-head__cell ladder-head__cell--price">价格</span>
        <span className="ladder-head__cell ladder-head__cell--sell">卖出</span>
      </div>
      <div className="infinite-ladder__viewport" data-testid="infinite-ladder__viewport" ref={viewportRef} onScroll={onScroll}>
        <div className="infinite-ladder__spacer" style={{ height: totalH }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {axis.slice(start, end).map((price, i) => {
              const idx = start + i
              const level = myOrders.byPrice.get(price)
              const bidVol = depth.bidVol.get(price) ?? 0
              const askVol = depth.askVol.get(price) ?? 0
              const isLast = idx === lastIndex
              return (
                <div
                  key={price}
                  data-testid={`ladder-row-${idx}`}
                  className={`infinite-row${isLast ? ' infinite-row--last' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="infinite-row__cancel">
                    {level && level.buyVolume > 0 && (
                      <button
                        type="button"
                        className="infinite-row__my infinite-row__my--buy"
                        onClick={() => cancelMyOrders(level.buyRefs)}
                      >
                        {level.buyVolume}
                      </button>
                    )}
                    {level && level.sellVolume > 0 && (
                      <button
                        type="button"
                        className="infinite-row__my infinite-row__my--sell"
                        onClick={() => cancelMyOrders(level.sellRefs)}
                      >
                        {level.sellVolume}
                      </button>
                    )}
                  </span>
                  <span
                    data-testid={`bid-cell-${idx}`}
                    className="infinite-row__bid"
                    style={{ '--vol-pct': `${maxVol > 0 ? Math.round((bidVol / maxVol) * 100) : 0}%` } as React.CSSProperties}
                    onClick={() => openIntent('buy', price)}
                  >
                    {bidVol > 0 ? bidVol : ''}
                  </span>
                  <span className="infinite-row__price">{formatTickPrice(price, priceTick)}</span>
                  <span
                    data-testid={`ask-cell-${idx}`}
                    className="infinite-row__ask"
                    style={{ '--vol-pct': `${maxVol > 0 ? Math.round((askVol / maxVol) * 100) : 0}%` } as React.CSSProperties}
                    onClick={() => openIntent('sell', price)}
                  >
                    {askVol > 0 ? askVol : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {intent && (
        <ConfirmDialog
          title="确认报单"
          details={[
            { label: '方向', value: intent.direction === 'buy' ? '买入' : '卖出' },
            { label: '价格', value: formatTickPrice(intent.price, priceTick) },
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
