import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { OptionsTable, type OptionsRecord, buildOptionRecords } from './OptionsTable'
import { OptionsFilterBar } from './OptionsFilterBar'
import {
  buildOptionChainsFromContracts,
  deriveUnderlyingProduct,
  groupOptionsByUnderlying,
  resolveUnderlyingInstrumentID,
} from '@/modules/market/sort'
import { filterByOptionsTabs } from './optionsTabs'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { getProductName } from '@/utils/productNames'
import './styles.css'

/**
 * OptionsPanel — 期权标签页（平铺 T 型链表格视图）
 *
 * 仿照期货表（MarketPanel + QuoteTable）的架构：contracts 一加载完立即渲染。
 * - ContractInfo 自带 underlyingInstrID/expireDate/optionsType/strikePrice，
 *   足以拼出 T 型行结构；不再发 N 次 /api/market/option_chain?underlying
 * - 单张 vtable 虚标滚动，所有标底+期权铺在同一张表
 * - 滚动时 onVisibleRangeChange → setVisibleInstrumentIDs → 订阅管理器统一处理
 * - snapshot 增量更新（仿照 QuoteTable 快照路径）→ 价格字段实时填充
 * - 默认全部展开；点击标底层折叠/展开
 * - 筛选重构：交易所 → 品种 Tab 条 → 系列（OptionsFilterBar + optionsTabs 纯函数）；
 *   无 tab = 全量（与旧空筛选语义一致）。期权页已去掉收藏夹功能（无过滤、无右键收藏项）。
 * - 右键单选菜单与期货表一致（五档下单/无限下单/打开K线/复制合约代码），无收藏项。
 */
export function OptionsPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupToggleAnimating, setGroupToggleAnimating] = useState(false)
  const groupToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)
  const setVisibleInstrumentIDs = useMarketStore((s) => s.setVisibleInstrumentIDs)
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const snapshots = useMarketStore((s) => s.snapshots)

  // 期权页筛选 Tab 态（交易所 → 品种 Tab → 系列），重构后的唯一筛选入口
  const optionsTabs = useMarketFilterStore((s) => s.optionsTabs)
  const changeOptionsTabs = (v: typeof optionsTabs) => useMarketFilterStore.getState().setOptionsTabs(v)

  // 期权标签是否激活：激活时 OptionsTable 重报可见区，订阅管理器立即补订阅。
  // 仿照 MarketPanel.tsx:36-37 的 isActive 计算；隐藏面板（display:none）传 isActive=false，
  // 让 OptionsTable 跳过可见区上报，避免覆盖活跃面板的可见范围（OptionsTable 0 尺寸下
  // 仍能以「预加载 ±10 行」误报期权合约 ID）。
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))

  const futures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])
  // 期权合约：规范化 underlyingInstrID——CZCE/GFEX 部分期权 underlyingInstrID 只有品种（'FG'）
  // 或缺失（''），需从 instrumentID 推断完整标底（FG610）。统一后构链/分组/筛选全部一致，
  // 避免这些期权归错组或筛选时被误过滤。
  const options = useMemo(
    () => contracts
      .filter((c) => c.productClass === '2' || c.productClass === '6')
      .map((c) => {
        const u = resolveUnderlyingInstrumentID(c)
        return u === (c.underlyingInstrID ?? '') ? c : { ...c, underlyingInstrID: u }
      }),
    [contracts],
  )

  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of options) {
      const p = deriveUnderlyingProduct(o.underlyingInstrID ?? '')
      if (!(p in m)) m[p] = getProductName(p)
    }
    return m
  }, [options])

  // ── 从合约列表直接构出期权链 Map（仿照期货表：contracts 一加载即可渲染） ───
  // 不再发 N 次 /api/market/option_chain?underlying：ContractInfo 已有
  // underlyingInstrID/expireDate/optionsType/strikePrice，足够拼出 T 型行结构。
  // 价格字段（lastPrice/bidPrice/askPrice/volume/openInterest/IV）置 0，
  // 由 WS snapshot 通过 OptionsTable 内部 snapshot effect 增量 updateRecords 填充。
  // contracts 为空时 Map 也是空，vtable 渲染只有表头（无任何行），等待 contracts 加载。
  const chainsByUnderlying = useMemo(
    () => buildOptionChainsFromContracts(options),
    [options],
  )

  // 数据管道：筛选 Tab → 分组。无 tab = 全量（与旧空筛选语义一致）。
  const groups = useMemo(() => {
    const tabFiltered = filterByOptionsTabs(
      options, optionsTabs,
      (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
    )
    return groupOptionsByUnderlying(tabFiltered, futures)
  }, [options, optionsTabs, futures])

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
    setGroupToggleAnimating(true)
    if (groupToggleTimerRef.current) clearTimeout(groupToggleTimerRef.current)
    groupToggleTimerRef.current = setTimeout(() => {
      groupToggleTimerRef.current = null
      setGroupToggleAnimating(false)
    }, 180)
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(underlyingID)) next.delete(underlyingID)
      else next.add(underlyingID)
      return next
    })
  }, [])

  useEffect(() => () => {
    if (groupToggleTimerRef.current) clearTimeout(groupToggleTimerRef.current)
  }, [])

  // ── 构建平铺 records（仿照期货表：所有数据 upfront） ────────────────────
  // 不再把 snapshots 烘到 records 里：snapshots 每 100ms 变化，会让 records 反复重建；
  // 改为 OptionsTable 内部按 updateRecords 增量更新（仿照 QuoteTable 快照增量路径）。
  // 这样 records 只在结构（链数据/筛选/折叠）变化时重建，setRecords 调用次数大幅下降。
  const records = useMemo(() => {
    const result: OptionsRecord[] = []
    for (const g of visibleGroups) {
      // 防御：underlyingInstrID 缺失的异常期权会归到 '' 组，跳过以免产生空标底行
      if (!g.underlyingID) continue
      const isExpanded = !collapsedGroups.has(g.underlyingID)
      // 标底行：callOpenInterest（第0列）承载标底名和展开/折叠箭头。
      // vtable mergeCells(0,row,lastCol,row) 整行合并后显示 startCol（第0列）的 cellValue，
      // 若该列无值则整行空白（看起来是「空行」且不显示标底合约）。给第0列赋值标底名，
      // 合并后显示为红粗大字标题。该字段仅用于显示，不影响订阅/快照逻辑（标底行无 C/P ID）。
      result.push({
        kind: 'underlying',
        underlyingID: g.underlyingID,
        isExpanded,
        callOpenInterest: `${g.underlyingID}  ${isExpanded ? '▲' : '▼'}`,
      })
      if (isExpanded) {
        const chains = chainsByUnderlying.get(g.underlyingID)
        if (chains && chains.length > 0) {
          result.push(...buildOptionRecords(chains[0]))
        }
      }
    }
    return result
  }, [visibleGroups, collapsedGroups, chainsByUnderlying])

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

  // ── T 行单击/双击（与期货表格一致：单击选中+填价，双击打开五档下单悬浮窗） ──
  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      const inst = contracts.find((c) => c.instrumentID === instrumentID)
      // price=0 表示当前无快照也无链静态价（OptionsTable 显示 '--'，点击回传 0）。
      // 此时只选合约、不回填限价——否则订单表单出现 0 值（点击 bug）。
      // 快照已到（price>0）时正常回填最新价。
      if (!(inst && inst.productClass === '1') && price > 0) setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  // ── 清空筛选（OptionsFilterBar「清空」按钮）时重置选中合约 ───────────────
  // 直接清空 selectedInstrument（不设到第一个——选中的是期权合约，清空后不保留）
  const handleClearFilter = useCallback(() => {
    setSelectedInstrument(null)
    setOrderInstrument(null)
  }, [setSelectedInstrument, setOrderInstrument])

  // ── 右键菜单（与期货表一致，无收藏项）：期权表 C/P 侧按列映射到具体合约 ──
  const { contextMenu, openOrderPopup, openKlineTab, openInfinitePopup, openOrderTabs, openInfiniteTabs, openKlineTabs, handleContextMenu, closeMenus } = useContractContextMenu()
  const { singleMenu } = useContractMenus({
    contextMenu,
    multiSelectMenu: null,
    favoritedIds: new Set(),
    favoriteMode: 'picker',
    showCollections: false, // 期权页已去掉收藏夹功能 → 右键无收藏项
    openOrderPopup,
    openKlineTab,
    openInfinitePopup,
    openOrderTabs,
    openInfiniteTabs,
    openKlineTabs,
    closeMenus,
  })

  const allContractIds = useMemo(() => new Set(contracts.map((c) => c.instrumentID)), [contracts])

  return (
    <section className="options-page">
      <div className="market-toolbar">
        {/* 筛选重构：交易所 → 品种 Tab 条 → 系列，位于搜索左侧 */}
        <OptionsFilterBar
          allContracts={options}
          getProduct={(c) => deriveUnderlyingProduct(c.underlyingInstrID ?? '')}
          productNames={filterProductNames}
          value={optionsTabs}
          onChange={changeOptionsTabs}
          onClear={handleClearFilter}
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
          <div className={groupToggleAnimating ? 'options-chain-table options-chain-table--group-toggle' : 'options-chain-table'}>
            <OptionsTable
              records={records}
              snapshots={snapshots}
              isActive={isActive}
              onToggleGroup={toggleGroup}
              onRowClick={handleClick}
              onRowDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onVisibleRangeChange={handleVisibleRangeChange}
            />
          </div>
        </ErrorBoundary>
      </div>

      {/* 单选右键菜单（无收藏项；单合约 → 五档/无限/K线/复制代码） */}
      {singleMenu}

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
