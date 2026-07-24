import { useEffect, useRef } from 'react'
import { useOptionsStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { TQuoteTable } from './TQuoteTable'

/** Debounce delay (ms) — avoids rapid re-fetches during high-frequency ticks. */
const REFRESH_DEBOUNCE_MS = 800

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

  // Fetch all chains on mount
  useEffect(() => {
    fetchOptionChains()
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <label style={{ color: '#8b949e', fontSize: 13 }}>
          标的:
          <select
            value={selectedUnderlying ?? ''}
            onChange={handleUnderlyingChange}
            style={{
              marginLeft: 4,
              padding: '4px 8px',
              background: '#1a1a2e',
              color: '#e6edf3',
              border: '1px solid #30363d',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <option value="">全部</option>
            {underlyings.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>

        <label style={{ color: '#8b949e', fontSize: 13 }}>
          到期日:
          <select
            value={selectedExpireDate ?? ''}
            onChange={handleExpireDateChange}
            style={{
              marginLeft: 4,
              padding: '4px 8px',
              background: '#1a1a2e',
              color: '#e6edf3',
              border: '1px solid #30363d',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <option value="">全部</option>
            {availableExpirations().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>
            加载中...
          </div>
        )}
        {error && !loading && (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>
            {error}
          </div>
        )}
        {!loading && !error && selectedChain && (
          <TQuoteTable chain={selectedChain} />
        )}
        {!loading && !error && !selectedChain && optionChains.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>
            暂无期权链数据
          </div>
        )}
        {!loading && !error && !selectedChain && optionChains.length > 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px' }}>
            请选择标的合约和到期日
          </div>
        )}
      </div>
    </div>
  )
}
