import { useEffect, useMemo, useRef } from 'react'
import { useOptionsStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket } from '@/services/api'
import { TQuoteTable } from './TQuoteTable'
import type { OptionChain } from '@/services/types'
import './styles.css'

/** Debounce delay (ms) — avoids rapid re-fetches during high-frequency ticks. */
const REFRESH_DEBOUNCE_MS = 800

/** Format YYYYMMDD → YYYY-MM-DD for display. */
function formatExpireDate(raw: string): string {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw
}

/** Estimate table height for stacked layout: (strikes + header) * rowHeight + padding. */
function chainHeight(chain: OptionChain): number {
  const strikes = new Set([...chain.calls, ...chain.puts].map((q) => q.strikePrice)).size
  return (Math.max(strikes, 1) + 1) * 28 + 4
}

export function OptionPanel() {
  const optionChains = useOptionsStore((s) => s.optionChains)
  const volatility = useOptionsStore((s) => s.volatility)
  const selectedUnderlying = useOptionsStore((s) => s.selectedUnderlying)
  const selectedExpireDate = useOptionsStore((s) => s.selectedExpireDate)
  const loading = useOptionsStore((s) => s.loading)
  const error = useOptionsStore((s) => s.error)
  const fetchOptionChains = useOptionsStore((s) => s.fetchOptionChains)
  const fetchVolatility = useOptionsStore((s) => s.fetchVolatility)
  const setSelectedUnderlying = useOptionsStore((s) => s.setSelectedUnderlying)
  const setSelectedExpireDate = useOptionsStore((s) => s.setSelectedExpireDate)
  const availableUnderlyings = useOptionsStore((s) => s.availableUnderlyings)
  const availableExpirations = useOptionsStore((s) => s.availableExpirations)

  // Market snapshots — real-time price data for chain quotes
  const snapshots = useMarketStore((s) => s.snapshots)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPriceRef = useRef<number | null>(null)

  // Chains matching current filter (null selector = 全部 = match all)
  // Memoized: filter creates a new array each render, which would retrigger effects.
  const visibleChains = useMemo(
    () =>
      optionChains.filter(
        (c) =>
          (!selectedUnderlying || c.underlying === selectedUnderlying) &&
          (!selectedExpireDate || c.expireDate === selectedExpireDate)
      ),
    [optionChains, selectedUnderlying, selectedExpireDate]
  )

  // Fetch all chains on mount, then auto-select first underlying + expiry
  useEffect(() => {
    fetchOptionChains().then(() => {
      const { optionChains: chains, setSelectedUnderlying: setUL, setSelectedExpireDate: setED } = useOptionsStore.getState()
      if (chains.length > 0) {
        const first = chains[0]
        setUL(first.underlying)
        setED(first.expireDate)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to all visible chains' option instruments + fetch their IVs
  useEffect(() => {
    if (visibleChains.length === 0) return
    const ids = visibleChains.flatMap((c) => [
      ...c.calls.map((q) => q.instrumentID),
      ...c.puts.map((q) => q.instrumentID),
    ])
    if (ids.length > 0) {
      subscribeMarket(ids).catch(() => {})
    }
    fetchVolatility(selectedUnderlying ?? undefined)
  }, [visibleChains, selectedUnderlying, fetchVolatility])

  // Real-time IV refresh: when underlying's lastPrice changes, debounce re-fetch volatility
  useEffect(() => {
    if (!selectedUnderlying) return
    const snap = snapshots.get(selectedUnderlying)
    if (!snap) return

    const currentPrice = snap.lastPrice
    if (prevPriceRef.current === currentPrice) return
    prevPriceRef.current = currentPrice

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchVolatility(selectedUnderlying)
      timerRef.current = null
    }, REFRESH_DEBOUNCE_MS)
  }, [snapshots, selectedUnderlying, fetchVolatility])

  const handleUnderlyingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null
    setSelectedUnderlying(value)
    if (value) {
      fetchOptionChains(value)
    } else {
      fetchOptionChains()
    }
  }

  const handleExpireDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null
    setSelectedExpireDate(value)
    if (selectedUnderlying) {
      fetchOptionChains(selectedUnderlying, value ?? undefined)
    }
  }

  const underlyings = availableUnderlyings()
  // Expiry dropdown filtered by selected underlying (全部 = all expirations)
  const expirations = selectedUnderlying
    ? [...new Set(optionChains.filter((c) => c.underlying === selectedUnderlying).map((c) => c.expireDate))].sort()
    : availableExpirations()

  return (
    <div className="options-panel">
      {/* Toolbar */}
      <div className="options-toolbar">
        <label>
          标的:
          <select value={selectedUnderlying ?? ''} onChange={handleUnderlyingChange}>
            <option value="">全部</option>
            {underlyings.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>

        <label>
          到期日:
          <select value={selectedExpireDate ?? ''} onChange={handleExpireDateChange}>
            <option value="">全部</option>
            {expirations.map((d) => (
              <option key={d} value={d}>{formatExpireDate(d)}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Content */}
      <div className="options-content">
        {loading && (
          <div className="options-empty">加载中...</div>
        )}
        {error && !loading && (
          <div className="options-error">{error}</div>
        )}
        {!loading && !error && visibleChains.length > 0 && (
          visibleChains.map((chain) => (
            <div key={`${chain.underlying}-${chain.expireDate}`} className="options-chain-block">
              {visibleChains.length > 1 && (
                <div className="options-chain-title">
                  {chain.underlying} · {formatExpireDate(chain.expireDate)}
                </div>
              )}
              <div
                className="options-chain-table"
                style={visibleChains.length > 1 ? { height: chainHeight(chain) } : undefined}
              >
                <TQuoteTable chain={chain} snapshots={snapshots} volatility={volatility} />
              </div>
            </div>
          ))
        )}
        {!loading && !error && visibleChains.length === 0 && optionChains.length === 0 && (
          <div className="options-empty">暂无期权链数据</div>
        )}
        {!loading && !error && visibleChains.length === 0 && optionChains.length > 0 && (
          <div className="options-empty">无匹配的期权链，请调整标的或到期日</div>
        )}
      </div>
    </div>
  )
}
