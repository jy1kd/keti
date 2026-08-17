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
import { getOptionChains, getSnapshots } from '@/services/api'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（平铺 T 型链表格视图）
 *
 * 单张 vtable 虚拟滚动，所有标底平铺展示：
 * - 标底层（红粗合并行）→ 该标底最早到期 T 型期权行
 * - 默认全部展开；点击标底层折叠/展开
 * - IntersectionObserver / scroll 懒加载：滚入视口才拉链
 * - 工具栏：ContractFilter（组粒度）+ ContractSearch + 🔍 高级搜索
 * - 收藏功能暂不实现
 */
export function OptionsPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  // 折叠态：集合中的标底 ID 被折叠（默认全部展开 = 空集合）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 链缓存：标底 ID → 按到期日升序排列的链列表
  const [chainCache, setChainCache] = useState<Map<string, OptionChain[]>>(new Map())

  // 标底 ID → 容器 DOM ref（搜索/高级搜索选中合约 → 定位展开对应组 + 滚动到该组）
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const snapshots = useMarketStore((s) => s.snapshots)
  const { addLockedContract, removeLockedContract } = useMarketStore()

  // 期权页筛选态
  const filter = useMarketFilterStore((s) => s.options)

  // 期货全量 + 期权全量
  const futures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])
  const options = useMemo(() => contracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [contracts])

  // 筛选面板品种中文名
  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of options) {
      const p = deriveUnderlyingProduct(o.underlyingInstrID ?? '')
      if (!(p in m)) m[p] = getProductName(p)
    }
    return m
  }, [options])

  // 数据管道：筛选 → 分组
  const groups = useMemo(() => {
    const filteredOptions = filterByExchangeAndProduct(
      options,
      filter.exchanges,
      filter.products,
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
      return (
        g.underlyingID.toLowerCase().includes(q) ||
        getProductName(product).toLowerCase().includes(q)
      )
    })
  }, [groups, searchQuery])

  // ── 懒加载：滚入视口的标底拉链 ──────────────────────────────────────────
  const loadGroups = useCallback(async (ids: string[]) => {
    const toLoad = ids.filter((id) => !chainCache.has(id))
    if (toLoad.length === 0) return
    const results = await Promise.allSettled(
      toLoad.map((id) => getOptionChains(id)),
    )
    setChainCache((prev) => {
      const next = new Map(prev)
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const sorted = [...r.value.chains].sort((a, b) => a.expireDate.localeCompare(b.expireDate))
          if (sorted.length > 0) next.set(toLoad[i], sorted)
        }
      })
      return next
    })
    // 预拉快照
    const allIDs: string[] = []
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        const chains = r.value.chains
        const sorted = [...chains].sort((a, b) => a.expireDate.localeCompare(b.expireDate))
        const chain = sorted[0]
        if (chain) {
          allIDs.push(...chain.calls.map((q) => q.instrumentID), ...chain.puts.map((q) => q.instrumentID))
        }
      }
    })
    if (allIDs.length > 0) getSnapshots(allIDs).catch(() => {})
  }, [chainCache])

  const handleVisibleGroupsChange = useCallback((ids: string[]) => {
    loadGroups(ids)
  }, [loadGroups])

  // ── 折叠/展开 ──────────────────────────────────────────────────────────
  const toggleGroup = useCallback((underlyingID: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(underlyingID)) next.delete(underlyingID)
      else next.add(underlyingID)
      return next
    })
  }, [])

  // ── 构建平铺 records ────────────────────────────────────────────────────
  const records = useMemo(() => {
    const result: OptionsRecord[] = []
    for (const g of visibleGroups) {
      const isExpanded = !collapsedGroups.has(g.underlyingID)
      result.push({
        kind: 'underlying',
        underlyingID: g.underlyingID,
      })
      if (isExpanded) {
        const chains = chainCache.get(g.underlyingID)
        if (chains && chains.length > 0) {
          // 默认最早到期
          result.push(...buildOptionRecords(chains[0], snapshots))
        }
      }
    }
    return result
  }, [visibleGroups, collapsedGroups, chainCache, snapshots])

  // ── 订阅锁定：展开的组锁定其链内合约 ───────────────────────────────────
  useEffect(() => {
    const toLock = new Set<string>()
    for (const g of visibleGroups) {
      if (collapsedGroups.has(g.underlyingID)) continue
      const chains = chainCache.get(g.underlyingID)
      if (!chains || chains.length === 0) continue
      const chain = chains[0] // 最早到期
      for (const q of chain.calls) toLock.add(q.instrumentID)
      for (const q of chain.puts) toLock.add(q.instrumentID)
    }
    for (const id of toLock) addLockedContract(id)
    return () => {
      for (const id of toLock) removeLockedContract(id)
    }
  }, [visibleGroups, collapsedGroups, chainCache, addLockedContract, removeLockedContract])

  // ── 搜索选中合约 → 定位到标底组并展开 ─────────────────────────────────
  const handleSelectContract = useCallback((instrumentID: string) => {
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    let targetGroupID = instrumentID
    if (inst && (inst.productClass === '2' || inst.productClass === '6') && inst.underlyingInstrID) {
      const underlying = contracts.find((c) => c.instrumentID === inst.underlyingInstrID)
      if (underlying) targetGroupID = underlying.instrumentID
    }
    // 确保目标组在搜索过滤后可见
    setSearchQuery(targetGroupID)
    // 展开目标组
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.delete(targetGroupID)
      return next
    })
    requestAnimationFrame(() => {
      const wrapper = groupRefs.current[targetGroupID]
      if (wrapper) wrapper.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [contracts])

  // ── 高级搜索选中合约 ───────────────────────────────────────────────────
  const handleAdvancedSelect = useCallback((instrumentID: string) => {
    setSearchModalOpen(false)
    handleSelectContract(instrumentID)
  }, [handleSelectContract])

  // ── T 行单击回填 ───────────────────────────────────────────────────────
  const onSelectContract = useCallback((instrumentID: string, price: number) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
    const inst = contracts.find((c) => c.instrumentID === instrumentID)
    if (!(inst && inst.productClass === '1')) {
      setOrderForm({ limitPrice: price })
    }
  }, [contracts, setSelectedInstrument, setOrderInstrument, setOrderForm])

  const allContractIds = useMemo(
    () => new Set(contracts.map((c) => c.instrumentID)),
    [contracts],
  )

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
          <ContractSearch
            contracts={options}
            onSelect={handleSelectContract}
            onQueryChange={setSearchQuery}
          />
          <button
            className="btn-search-advanced"
            title="搜索合约"
            onClick={() => setSearchModalOpen(true)}
          >
            🔍
          </button>
          {searchQuery && (
            <span className="search-count">
              {visibleGroups.length} / {groups.length}
            </span>
          )}
        </div>
      </div>

      <div className="panel-content">
        <ErrorBoundary>
          {/* 为每个可见标底组提供 ref 容器（搜索定位用），但 vtable 由 OptionsTable 管理 */}
          {visibleGroups.map((g) => (
            <div
              key={g.underlyingID}
              ref={(el) => { groupRefs.current[g.underlyingID] = el }}
              data-underlying={g.underlyingID}
              style={{ display: 'none' }} // 隐藏占位：ref 定位用，实际表格由 OptionsTable 渲染
            />
          ))}
          <OptionsTable
            records={records}
            snapshots={snapshots}
            onToggleGroup={toggleGroup}
            onRowClick={onSelectContract}
            onVisibleGroupsChange={handleVisibleGroupsChange}
          />
        </ErrorBoundary>
      </div>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenFavoritePicker={() => {}} // 收藏功能暂不实现
        onRemoveFromAllCollections={() => {}} // 收藏功能暂不实现
        allContractIds={allContractIds}
        favoritedIds={new Set()}
        onContractClick={handleAdvancedSelect}
      />
    </section>
  )
}
