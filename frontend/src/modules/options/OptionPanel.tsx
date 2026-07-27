import { useEffect, useMemo, useRef, useState } from 'react'
import { useOptionsStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket, getOptionUnderlyings, getSnapshots } from '@/services/api'
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

/** Estimate table height: (strikes + header) * rowHeight + padding. */
function chainHeight(chain: OptionChain): number {
  const strikes = new Set([...chain.calls, ...chain.puts].map((q) => q.strikePrice)).size
  return (Math.max(strikes, 1) + 1) * 28 + 4
}

/** Max retry attempts for loading underlyings. */
const MAX_RETRIES = 3
/** Delay between retries (ms). */
const RETRY_DELAY_MS = 1500

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
  const availableExpirations = useOptionsStore((s) => s.availableExpirations)

  // Available underlyings — loaded via lightweight API on mount
  const [availableUnderlyings, setAvailableUnderlyings] = useState<string[]>([])
  const [underlyingsLoading, setUnderlyingsLoading] = useState(true)

  // Market snapshots — real-time price data for chain quotes
  const snapshots = useMarketStore((s) => s.snapshots)
  const batchUpdate = useMarketStore((s) => s.batchUpdate)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPriceRef = useRef<number | null>(null)

  // Searchable underlying dropdown state
  const [underlyingSearch, setUnderlyingSearch] = useState('')
  const [showUnderlyingDropdown, setShowUnderlyingDropdown] = useState(false)
  const underlyingDropdownRef = useRef<HTMLDivElement>(null)

  const filteredUnderlyings = useMemo(() => {
    if (!underlyingSearch.trim()) return availableUnderlyings
    const q = underlyingSearch.trim().toUpperCase()
    return availableUnderlyings.filter((u) => u.toUpperCase().includes(q))
  }, [availableUnderlyings, underlyingSearch])

  // Close underlying dropdown on outside click
  useEffect(() => {
    if (!showUnderlyingDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (underlyingDropdownRef.current && !underlyingDropdownRef.current.contains(e.target as Node)) {
        setShowUnderlyingDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUnderlyingDropdown])

  // Load available underlyings on mount with retry
  useEffect(() => {
    let retryCount = 0
    let cancelled = false

    const loadUnderlyings = () => {
      if (cancelled) return

      getOptionUnderlyings().then((res) => {
        if (cancelled) return

        const underlyings = res.underlyings ?? []
        if (underlyings.length === 0 && retryCount < MAX_RETRIES) {
          retryCount++
          setTimeout(loadUnderlyings, RETRY_DELAY_MS)
        } else {
          setAvailableUnderlyings(underlyings)
          setUnderlyingsLoading(false)
        }
      }).catch(() => {
        if (cancelled) return
        if (retryCount < MAX_RETRIES) {
          retryCount++
          setTimeout(loadUnderlyings, RETRY_DELAY_MS)
        } else {
          setUnderlyingsLoading(false)
        }
      })
    }

    loadUnderlyings()

    return () => { cancelled = true }
  }, [])

  // Find the selected chain (only one at a time)
  const selectedChain = useMemo(
    () =>
      optionChains.find(
        (c) =>
          (!selectedUnderlying || c.underlying === selectedUnderlying) &&
          (!selectedExpireDate || c.expireDate === selectedExpireDate)
      ) ?? null,
    [optionChains, selectedUnderlying, selectedExpireDate]
  )

  // No auto-load on mount: user must select underlying + expiry manually.

  // Subscribe to selected chain's option instruments + fetch snapshots + IVs
  useEffect(() => {
    if (!selectedChain) return
    const ids = [
      ...selectedChain.calls.map((q) => q.instrumentID),
      ...selectedChain.puts.map((q) => q.instrumentID),
    ]
    if (ids.length > 0) {
      subscribeMarket(ids).catch(() => {})
      // Proactively fetch current snapshots so the table shows data immediately,
      // without waiting for WebSocket market_data push.
      getSnapshots(ids)
        .then((res) => {
          const snaps = Object.values(res.snapshots)
          if (snaps.length > 0) batchUpdate(snaps)
        })
        .catch(() => {})
    }
    fetchVolatility(selectedUnderlying ?? undefined)
  }, [selectedChain, selectedUnderlying, fetchVolatility, batchUpdate])

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

  const selectUnderlying = (value: string) => {
    setSelectedUnderlying(value)
    setSelectedExpireDate(null)
    setUnderlyingSearch('')
    setShowUnderlyingDropdown(false)
    if (value) {
      fetchOptionChains(value).then(() => {
        const { optionChains: chains, setSelectedExpireDate: setED } = useOptionsStore.getState()
        if (chains.length > 0) {
          setED(chains[0].expireDate)
        }
      })
    }
  }

  const handleExpireDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null
    setSelectedExpireDate(value)
  }

  // Manual refresh underlyings
  const handleRefreshUnderlyings = () => {
    setUnderlyingsLoading(true)
    getOptionUnderlyings().then((res) => {
      setAvailableUnderlyings(res.underlyings ?? [])
      setUnderlyingsLoading(false)
    }).catch(() => {
      setUnderlyingsLoading(false)
    })
  }

  // Expiry dropdown filtered by selected underlying
  const expirations = selectedUnderlying
    ? [...new Set(optionChains.filter((c) => c.underlying === selectedUnderlying).map((c) => c.expireDate))].sort()
    : availableExpirations()

  return (
    <div className="options-panel">
      {/* Toolbar */}
      <div className="options-toolbar">
        <label>
          标的:
          <div className="options-searchable-select" ref={underlyingDropdownRef}>
            <input
              type="text"
              className="options-search-input"
              placeholder={underlyingsLoading ? '加载中...' : '输入关键字搜索...'}
              value={showUnderlyingDropdown ? underlyingSearch : (selectedUnderlying ?? '')}
              disabled={underlyingsLoading}
              onChange={(e) => {
                setUnderlyingSearch(e.target.value)
                setShowUnderlyingDropdown(true)
              }}
              onFocus={() => {
                setUnderlyingSearch('')
                setShowUnderlyingDropdown(true)
              }}
            />
            {showUnderlyingDropdown && filteredUnderlyings.length > 0 && (
              <div className="options-search-dropdown">
                {filteredUnderlyings.map((u) => (
                  <div
                    key={u}
                    className={`options-search-option${u === selectedUnderlying ? ' selected' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectUnderlying(u)
                    }}
                  >
                    {u}
                  </div>
                ))}
              </div>
            )}
            {showUnderlyingDropdown && filteredUnderlyings.length === 0 && (
              <div className="options-search-dropdown">
                <div className="options-search-empty">无匹配标的</div>
              </div>
            )}
          </div>
        </label>

        <label>
          到期日:
          <select value={selectedExpireDate ?? ''} onChange={handleExpireDateChange}>
            <option value="">请选择到期日</option>
            {expirations.map((d) => (
              <option key={d} value={d}>{formatExpireDate(d)}</option>
            ))}
          </select>
        </label>

        <button
          className="options-refresh-btn"
          onClick={handleRefreshUnderlyings}
          disabled={underlyingsLoading}
          title="刷新标的列表"
        >
          {underlyingsLoading ? '⏳' : '🔄'}
        </button>
      </div>

      {/* Content */}
      <div className="options-content">
        {loading && (
          <div className="options-empty">加载中...</div>
        )}
        {error && !loading && (
          <div className="options-error">{error}</div>
        )}
        {!loading && !error && selectedChain && (
          <div
            className="options-chain-table"
            style={{ height: chainHeight(selectedChain) }}
          >
            <TQuoteTable chain={selectedChain} snapshots={snapshots} volatility={volatility} />
          </div>
        )}
        {!loading && !error && !selectedChain && (
          <div className="options-empty">
            {!selectedUnderlying
              ? '请先选择标的合约'
              : !selectedExpireDate
                ? '请选择到期日'
                : '无匹配的期权链数据'}
          </div>
        )}
      </div>
    </div>
  )
}
