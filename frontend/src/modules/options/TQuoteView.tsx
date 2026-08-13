import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'
import { getOptionUnderlyings, getOptionChains, getSnapshots } from '@/services/api'
import type { OptionChain } from '@/services/types'
import { naturalCompare } from '@/modules/market/sort'
import { TQuoteTable } from './TQuoteTable'
import './styles.css'

/** Max retry attempts for loading underlyings. */
const MAX_RETRIES = 3
/** Delay between retries (ms). */
const RETRY_DELAY_MS = 1500

/**
 * TQuoteView — 独立悬浮标签页的 T型报价（多实例自包含）
 *
 * 自包含：所有数据状态（optionChains / selectedUnderlying / loading / error）均为本地
 * useState，直接调用 @/services/api，多个悬浮实例互不干扰。
 * 可选 prop `instrumentID`：挂载时自动预选该标底并加载期权链（T型报价-<标底> 标签页）。
 * 可选 prop `tabId`：窗内切换标底时同步悬浮标签的标题与 props（updateTab 去重：若该
 * 标底已有标签则关闭本标签并激活它，保持一标底一窗）。
 */
export function TQuoteView({ instrumentID, tabId }: { instrumentID?: string; tabId?: string }) {
  // T型报价数据（本地状态，实例隔离）
  const [optionChains, setOptionChains] = useState<OptionChain[]>([])
  const [selectedUnderlying, setSelectedUnderlying] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Available underlyings — loaded via lightweight API on mount
  const [availableUnderlyings, setAvailableUnderlyings] = useState<string[]>([])
  const [underlyingsLoading, setUnderlyingsLoading] = useState(true)

  // Market snapshots — real-time price data for chain quotes
  const snapshots = useMarketStore((s) => s.snapshots)
  const batchUpdate = useMarketStore((s) => s.batchUpdate)

  // Searchable underlying dropdown state
  const [underlyingSearch, setUnderlyingSearch] = useState('')
  const [showUnderlyingDropdown, setShowUnderlyingDropdown] = useState(false)
  const underlyingDropdownRef = useRef<HTMLDivElement>(null)

  // 排序（字典序，不区分大小写）：availableUnderlyings 设值前排序；filteredUnderlyings 保持有序
  const filteredUnderlyings = useMemo(() => {
    if (!underlyingSearch.trim()) return availableUnderlyings
    const q = underlyingSearch.trim().toUpperCase()
    return availableUnderlyings.filter((u) => u.toUpperCase().includes(q)).sort(naturalCompare)
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
          setAvailableUnderlyings([...underlyings].sort(naturalCompare))
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

  // 选中的期权链：无到期日选择器，取该标底的首条链——按到期日升序取最早到期日，
  // 而非依赖响应顺序（后端返回顺序不保证，同标底多到期日时需确定性选链）
  const selectedChain = useMemo(() => {
    if (!selectedUnderlying) return null
    const candidates = optionChains
      .filter((c) => c.underlying === selectedUnderlying)
      .sort((a, b) => a.expireDate.localeCompare(b.expireDate))
    return candidates[0] ?? null
  }, [optionChains, selectedUnderlying])

  /** 最近一次请求的标底（请求竞态守卫：慢响应的旧标底响应不得覆盖新选标底） */
  const lastRequestedUnderlyingRef = useRef<string | null>(null)

  // 选择标底：加载期权链（默认展示首个到期日，无到期日选择器）
  const selectUnderlying = useCallback((value: string) => {
    lastRequestedUnderlyingRef.current = value
    setSelectedUnderlying(value)
    setUnderlyingSearch('')
    setShowUnderlyingDropdown(false)
    // 悬浮标签页：窗内切标底 → 同步标签标题/props（标题随动）。updateTab 按 type+instrumentID
    // 去重——若该标底已有其他标签，则关闭本标签并激活它（一标底一窗的期望行为）。
    if (tabId) {
      useTabStore.getState().updateTab(tabId, {
        title: value ? `📉 T型报价-${value}` : '📉 T型报价',
        props: value ? { instrumentID: value } : {},
      })
    }
    if (value) {
      setLoading(true)
      setError(null)
      getOptionChains(value)
        .then((res) => {
          // 过期响应守卫：期间已切到其它标底 → 忽略本次（旧标底慢响应不得覆盖新选标底）
          if (lastRequestedUnderlyingRef.current !== value) return
          const chains = res.chains ?? []
          setOptionChains(chains)
          setLoading(false)
        })
        .catch(() => {
          if (lastRequestedUnderlyingRef.current !== value) return
          setError('Failed to load option chains')
          setLoading(false)
        })
    } else {
      setOptionChains([])
    }
  }, [tabId])

  // 预选：挂载时若带 instrumentID prop → 自动 selectUnderlying（依赖 props.instrumentID）
  useEffect(() => {
    if (instrumentID) {
      selectUnderlying(instrumentID)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentID])

  // 将当前链的期权合约标记为「锁定」，使共享订阅管理器（useSubscriptionManager）
  // 把链内合约纳入 shouldSubscribe（可见 + 自选 + 锁定）并记账，锁定期间不被 LRU 驱逐。
  // 不再直接 subscribeMarket/unsubscribeMarket：若同一期权 ID 同时出现在期权列表
  // 可见区与 T型报价窗，直连退订会全局移除后端订阅，而管理器误以为仍在订阅，
  // 导致列表行冻结。改走 lockedContracts（引用计数 Map）后，链切换/卸载只解锁，
  // 管理器按宽限期（10s）优雅退订；若该合约仍在列表可见区内，管理器保留订阅。
  useEffect(() => {
    if (!selectedChain) return
    const ids = [
      ...selectedChain.calls.map((q) => q.instrumentID),
      ...selectedChain.puts.map((q) => q.instrumentID),
    ]
    if (ids.length > 0) {
      for (const id of ids) useMarketStore.getState().addLockedContract(id)
      // Proactively fetch current snapshots so the table shows data immediately,
      // without waiting for WebSocket market_data push.
      getSnapshots(ids)
        .then((res) => {
          const snaps = Object.values(res.snapshots)
          if (snaps.length > 0) batchUpdate(snaps)
        })
        .catch(() => {})
    }
    // 卸载 / selectedChain 变化（选标底）时解锁当前链（引用计数归零才真正解锁）
    return () => {
      for (const id of ids) useMarketStore.getState().removeLockedContract(id)
    }
  }, [selectedChain, batchUpdate])

  // Manual refresh underlyings
  const handleRefreshUnderlyings = () => {
    setUnderlyingsLoading(true)
    getOptionUnderlyings().then((res) => {
      setAvailableUnderlyings([...(res.underlyings ?? [])].sort(naturalCompare))
      setUnderlyingsLoading(false)
    }).catch(() => {
      setUnderlyingsLoading(false)
    })
  }

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
          <div className="options-chain-table">
            <TQuoteTable chain={selectedChain} snapshots={snapshots} />
          </div>
        )}
        {!loading && !error && !selectedChain && (
          <div className="options-empty">
            {!selectedUnderlying ? '请先选择标的合约' : '无匹配的期权链数据'}
          </div>
        )}
      </div>
    </div>
  )
}
