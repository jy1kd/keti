import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { OptionsTable, type OptionsRecord, buildOptionRecords } from './OptionsTable'
import { deriveUnderlyingProduct, groupOptionsByUnderlying } from '@/modules/market/sort'
import { filterByExchangeAndProduct } from '@/modules/market/filter'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { getProductName } from '@/utils/productNames'
import type { OptionChain } from '@/services/types'
import { getOptionChains } from '@/services/api'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（平铺 T 型链表格视图）
 *
 * 仿照期货表（MarketPanel + QuoteTable）的架构：
 * - 挂载时加载全部期权链（getOptionChains × N），展平为平铺 records
 * - 单张 vtable 虚标滚动，所有标底+期权铺在同一张表
 * - 滚动时 onVisibleRangeChange → setVisibleInstrumentIDs → 订阅管理器统一处理
 * - 默认全部展开；点击标底层折叠/展开
 */
export function OptionsPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [chainsByUnderlying, setChainsByUnderlying] = useState<Map<string, OptionChain[]>>(new Map())

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)
  const setVisibleInstrumentIDs = useMarketStore((s) => s.setVisibleInstrumentIDs)
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const snapshots = useMarketStore((s) => s.snapshots)

  const filter = useMarketFilterStore((s) => s.options)

  const futures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])
  const options = useMemo(() => contracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [contracts])

  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of options) {
      const p = deriveUnderlyingProduct(o.underlyingInstrID ?? '')
      if (!(p in m)) m[p] = getProductName(p)
    }
    return m
  }, [options])

  // ── 挂载时加载全部期权链（仿照期货表：所有数据 upfront） ──────────────────
  useEffect(() => {
    const underlyings = [...new Set(options.map((o) => o.underlyingInstrID ?? ''))]
    if (underlyings.length === 0) return
    let cancelled = false
    Promise.allSettled(underlyings.map((id) => getOptionChains(id))).then((results) => {
      if (cancelled) return
      const map = new Map<string, OptionChain[]>()
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const sorted = [...r.value.chains].sort((a, b) => a.expireDate.localeCompare(b.expireDate))
          if (sorted.length > 0) map.set(underlyings[i], sorted)
        }
      })
      setChainsByUnderlying(map)
    })
    return () => { cancelled = true }
  }, [options])

  // 数据管道：筛选 → 分组
  const groups = useMemo(() => {
    const filteredOptions = filterByExchangeAndProduct(
      options, filter.exchanges, filter.products,
      (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
    )
    return groupOptionsByUnderlying(filteredOptions, futures)
  }, [options, filter, futures])

  // 搜索过滤组
  const visibleGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter((g) => {
      const product = deriveUnderlyingProduct(g.underlyingID)
      return g.underlyingID.toLowerCase().includes(q) || getProductName(product).toLowerCase().includes(q)
    })
  }, [groups, searchQuery])

  // ── 折叠/展开 ──────────────────────────────────────────────────────────
  const toggleGroup = useCallback((underlyingID: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(underlyingID)) next.delete(underlyingID)
      else next.add(underlyingID)
      return next
    })
  }, [])

  // ── 构建平铺 records（仿照期货表：所有数据 upfront） ────────────────────
  const records = useMemo(() => {
    const result: OptionsRecord[] = []
    for (const g of visibleGroups) {
      const isExpanded = !collapsedGroups.has(g.underlyingID)
      result.push({ kind: 'underlying', underlyingID: g.underlyingID })
      if (isExpanded) {
        const chains = chainsByUnderlying.get(g.underlyingID)
        if (chains && chains.length > 0) {
          result.push(...buildOptionRecords(chains[0], snapshots))
        }
      }
    }
    return result
  }, [visibleGroups, collapsedGroups, chainsByUnderlying, snapshots])

  // ── onVisibleRangeChange：报告可见期权合约 ID → 订阅管理器统一处理 ──────
  const handleVisibleRangeChange = useCallback((ids: string[]) => {
    setVisibleInstrumentIDs(ids)
  }, [setVisibleInstrumentIDs])

  // ── 搜索选中合约 → 定位到标底组并展开 ─────────────────────────────────
  const handleSelectContract = useCallback((instrumentID: string) => {
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    let targetGroupID = instrumentID
    if (inst && (inst.productClass === '2' || inst.productClass === '6') && inst.underlyingInstrID) {
      const underlying = contracts.find((c) => c.instrumentID === inst.underlyingInstrID)
      if (underlying) targetGroupID = underlying.instrumentID
    }
    setSearchQuery(targetGroupID)
    setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(targetGroupID); return next })
    requestAnimationFrame(() => { groupRefs.current[targetGroupID]?.scrollIntoView({ block: 'center', behavior: 'smooth' }) })
  }, [contracts])

  const handleAdvancedSelect = useCallback((instrumentID: string) => {
    setSearchModalOpen(false)
    handleSelectContract(instrumentID)
  }, [handleSelectContract])

  // ── T 行单击回填 ───────────────────────────────────────────────────────
  const onSelectContract = useCallback((instrumentID: string, price: number) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    if (!(inst && inst.productClass === '1')) setOrderForm({ limitPrice: price })
  }, [contracts, setSelectedInstrument, setOrderInstrument, setOrderForm])

  const allContractIds = useMemo(() => new Set(contracts.map((c) => c.instrumentID)), [contracts])

  return (
    <section className="options-page">
      <div className="market-toolbar">
        <ContractFilter
          allContracts={options}
          getProduct={(c) => deriveUnderlyingProduct(c.underlyingInstrID ?? '')}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => useMarketFilterStore.getState().setFilter('options', v)}
        />
        <div className="market-toolbar__search">
          <ContractSearch contracts={options} onSelect={handleSelectContract} onQueryChange={setSearchQuery} />
          <button className="btn-search-advanced" title="搜索合约" onClick={() => setSearchModalOpen(true)}>🔍</button>
          {searchQuery && <span className="search-count">{visibleGroups.length} / {groups.length}</span>}
        </div>
      </div>

      <div className="panel-content">
        <ErrorBoundary>
          {visibleGroups.map((g) => (
            <div key={g.underlyingID} ref={(el) => { groupRefs.current[g.underlyingID] = el }} data-underlying={g.underlyingID} style={{ display: 'none' }} />
          ))}
          <OptionsTable
            records={records}
            onToggleGroup={toggleGroup}
            onRowClick={onSelectContract}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
        </ErrorBoundary>
      </div>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenFavoritePicker={() => {}}
        onRemoveFromAllCollections={() => {}}
        allContractIds={allContractIds}
        favoritedIds={new Set()}
        onContractClick={handleAdvancedSelect}
      />
    </section>
  )
}
