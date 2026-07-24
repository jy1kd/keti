import { useEffect, useRef } from 'react'
import { useOptionsStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { TQuoteTable } from './TQuoteTable'
import './styles.css'

/** Debounce delay (ms) — avoids rapid re-fetches during high-frequency ticks. */
const REFRESH_DEBOUNCE_MS = 800

/** Format YYYYMMDD → YYYY-MM-DD for display. */
function formatExpireDate(raw: string): string {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw
}

export function OptionPanel() {
  const optionChains = useOptionsStore((s) => s.optionChains)
  const selectedUnderlying = useOptionsStore((s) => s.selectedUnderlying)
  const selectedExpireDate = useOptionsStore((s) => s.selectedExpireDate)
  const loading = useOptionsStore((s) => s.loading)
  const error = useOptionsStore((s) => s.error)
  const fetchOptionChains = useOptionsStore((s) => s.fetchOptionChains)
  const setSelectedUnderlying = useOptionsStore((s) => s.setSelectedUnderlying)
  const setSelectedExpireDate = useOptionsStore((s) => s.setSelectedExpireDate)
  const availableUnderlyings = useOptionsStore((s) => s.availableUnderlyings)
  const availableExpirations = useOptionsStore((s) => s.availableExpirations)

  // Market snapshots — subscribe to underlying's real-time tick
  const snapshots = useMarketStore((s) => s.snapshots)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPriceRef = useRef<number | null>(null)

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

  // Real-time refresh: when underlying's lastPrice changes, debounce re-fetch
  useEffect(() => {
    if (!selectedUnderlying) return
    const snap = snapshots.get(selectedUnderlying)
    if (!snap) return

    const currentPrice = snap.lastPrice
    if (prevPriceRef.current === currentPrice) return
    prevPriceRef.current = currentPrice

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fetchOptionChains(selectedUnderlying, selectedExpireDate ?? undefined)
      timerRef.current = null
    }, REFRESH_DEBOUNCE_MS)
  }, [snapshots, selectedUnderlying, selectedExpireDate, fetchOptionChains])

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

  // Find the selected chain
  const selectedChain = optionChains.find(
    (c) => c.underlying === selectedUnderlying && c.expireDate === selectedExpireDate
  )

  const underlyings = availableUnderlyings()

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
            {availableExpirations().map((d) => (
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
        {!loading && !error && selectedChain && (
          <TQuoteTable chain={selectedChain} snapshots={snapshots} />
        )}
        {!loading && !error && !selectedChain && optionChains.length === 0 && (
          <div className="options-empty">暂无期权链数据</div>
        )}
        {!loading && !error && !selectedChain && optionChains.length > 0 && (
          <div className="options-empty">请选择标的合约和到期日</div>
        )}
      </div>
    </div>
  )
}
