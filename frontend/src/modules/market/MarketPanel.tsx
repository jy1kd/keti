import { useEffect, useMemo, useState } from 'react'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { QuoteTable } from './QuoteTable'
import { CollectionFilterTabs } from './CollectionFilterTabs'
import { futuresSpec } from './futuresSpec'
import { sortFutures } from './sort'
import { filterByExchangeAndProduct } from './filter'
import { useMarketStore } from './store'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore, unionFavoritedIds, collectionFavoritedIds } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { CollectionPicker } from '@/components/CollectionPicker'
import { filterByCollection } from '@/modules/query/filter'
import { useOrderStore } from '@/modules/order/store'
import { getProductName } from '@/utils/productNames'
import { isElectron } from '@/services/electron'
import './styles.css'

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const collections = useCollectionsStore((s) => s.collections)
  const { contextMenu, multiSelectMenu, openOrderPopup, openKlineTab, openInfinitePopup, openOrderTabs, openInfiniteTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  // 收藏选夹面板（⭐ / 右键 / 工具栏 / 搜索弹窗统一入口）
  const [picker, setPicker] = useState<{ instrumentIDs: string[] } | null>(null)

  // 期货标签是否激活：激活翻转为 true 时 QuoteTable 重报可见区，订阅管理器立即补订阅。
  // TabContent 同时挂载期货/期权两面板，隐藏面板（isActive=false）不得上报可见区，
  // 否则会覆盖活跃面板的可见范围 → 活跃表失去订阅（Critical #1）。
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'market' && t.id === s.activeTabId))

  // 期货页筛选态（交易所+品种多选，独立于期权页，localStorage 持久化）
  const filter = useMarketFilterStore((s) => s.futures)
  // 期货页收藏夹过滤（与三个查询浮窗语义一致：Tab 条选夹，'' = 全部）
  const collectionId = useMarketFilterStore((s) => s.futuresCollectionId)
  const setCollectionId = (id: string) => useMarketFilterStore.getState().setCollectionId('futures', id)

  // 期货全量（期货页只展示期货合约）+ 排序（数据管道第一步，设计 §3 决策 3）
  const sortedFutures = useMemo(
    () => sortFutures(contracts.filter((c) => c.productClass === '1')),
    [contracts],
  )
  // ⭐ 本夹视角：选中某收藏夹 Tab 时仅本夹内亮（folder 语义），「全部」下任一夹即亮（union）
  const favoriteMode: 'picker' | 'folder' = collectionId ? 'folder' : 'picker'
  const favoritedIds = useMemo(
    () => (favoriteMode === 'folder'
      ? collectionFavoritedIds(collections, collectionId)
      : unionFavoritedIds(collections)),
    [collections, collectionId, favoriteMode],
  )

  // 收藏夹删除了当前选中的夹 → 自动回退「全部」，避免 stale 选中使表格空转
  useEffect(() => {
    if (collectionId && !collections.some((c) => c.id === collectionId)) {
      useMarketFilterStore.getState().setCollectionId('futures', '')
    }
  }, [collectionId, collections])

  // 期货页基础集 = 全部期货（已去除 [全部|自选] 内部视图）
  const baseContracts = sortedFutures

  // 筛选面板品种中文名（显示用；可选交易所/品种列表由 ContractFilter 内经 computeFilterOptions 交叉计算）
  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of sortedFutures) m[c.productID] = getProductName(c.productID)
    return m
  }, [sortedFutures])

  // 搜索过滤 + 收藏夹过滤（数据管道：全部期货 → 筛选（交易所+品种）→ 收藏夹 → 搜索）
  const [searchQuery, setSearchQuery] = useState('')
  const displayContracts = useMemo(() => {
    let base = filterByExchangeAndProduct(baseContracts, filter.exchanges, filter.products, (c) => c.productID)
    base = filterByCollection(base, collections, collectionId)
    if (!searchQuery.trim()) return base
    const q = searchQuery.toLowerCase()
    return base.filter((c) => {
      const instrumentID = c.instrumentID?.toLowerCase() ?? ''
      const instrumentName = c.instrumentName?.toLowerCase() ?? ''
      const productID = c.productID?.toLowerCase() ?? ''
      const productName = getProductName(c.productID).toLowerCase()
      return (
        instrumentID.includes(q) ||
        instrumentName.includes(q) ||
        productID.includes(q) ||
        productName.includes(q)
      )
    })
  }, [baseContracts, filter, searchQuery, collections, collectionId])

  // 右键菜单 JSX（⭐ 列点击 / 搜索弹窗仍走 picker 弹面板，工具栏已改为 Tab 条）
  const { singleMenu, multiMenu } = useContractMenus({
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker: (instrumentIDs) => setPicker({ instrumentIDs }),
    onRemoveFromAll: (instrumentIDs) => useCollectionsStore.getState().removeFromAllCollections(instrumentIDs),
    onToggleInFolder: (instrumentID) => {
      if (favoriteMode !== 'folder') return
      if (favoritedIds.has(instrumentID)) {
        useCollectionsStore.getState().removeFromCollection(instrumentID, collectionId)
      } else {
        useCollectionsStore.getState().addToCollections([instrumentID], [collectionId])
      }
    },
    onRemoveFromFolderBatch: (instrumentIDs) => {
      if (favoriteMode !== 'folder') return
      for (const id of instrumentIDs) useCollectionsStore.getState().removeFromCollection(id, collectionId)
    },
    openOrderPopup,
    openKlineTab,
    openInfinitePopup,
    openOrderTabs,
    openInfiniteTabs,
    openKlineTabs,
    closeMenus,
  })
  // All contract IDs in the system
  const allContractIds = useMemo(
    () => new Set(contracts.map(c => c.instrumentID)),
    [contracts]
  )

  // 顶部菜单「行情」切换（设计 §4.1）：期货/期权为独立固定标签。
  // options → 激活期权标签；all → 激活期货标签（收藏夹已改为 open-floating，由 App 统一处理）。
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onMarketView?.((view) => {
      if (view === 'options') {
        const options = useTabStore.getState().tabs.find((t) => t.type === 'options')
        if (options) useTabStore.getState().setActiveTab(options.id)
        return
      }
      const market = useTabStore.getState().tabs.find((t) => t.type === 'market')
      if (market) useTabStore.getState().setActiveTab(market.id)
    })

    return () => cleanup?.()
  }, [])

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      // 双击打开悬浮报单弹窗
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  const handleSelectContract = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
    // 同步蓝区为单选集：MarketTable 锚点守卫 shouldRenderAnchor 要求
    // selectedInstrument ∈ selectedContracts，否则 selectRow+scroll 被跳过 → 搜索选择后表格不跳转
    setSelectedContracts(new Set([instrumentID]))
  }

  return (
    <section className="market-panel">
      {/* 行情页工具栏：筛选 → 收藏夹过滤 → 搜索（与三个查询浮窗语义一致）。
          保留 data-drag-handle：market 为固定标签（closable:false）故 TabContent 中惰性不触发，
          与旧 market-tabs 行为一致；保留以对齐 Phase 2 全局栏合并后的拖拽语义（审查 🔵-1）。 */}
      <div className="market-toolbar" data-drag-handle>
        {/* 功能靠左：筛选 → 收藏夹过滤 */}
        <ContractFilter
          allContracts={sortedFutures}
          getProduct={(c) => c.productID}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => useMarketFilterStore.getState().setFilter('futures', v)}
        />
        {/* 收藏夹过滤已由工具栏下拉升级为下方 Tab 条（CollectionFilterTabs） */}
        {/* 搜索贴右：搜索框 + 🔍 + 计数（margin-left:auto 吃掉中间空间推到最右） */}
        <div className="market-toolbar__search">
          <ContractSearch contracts={baseContracts} onSelect={handleSelectContract} onQueryChange={setSearchQuery} />
          <button
            className="btn-search-advanced"
            title="搜索合约"
            onClick={() => setSearchModalOpen(true)}
          >
            🔍
          </button>
          {searchQuery && (
            <span className="search-count">
              {displayContracts.length} / {baseContracts.length}
            </span>
          )}
        </div>
      </div>

      {/* 收藏夹过滤 Tab 条（全部 + 各收藏夹；选中夹即时过滤行情表） */}
      <CollectionFilterTabs value={collectionId} onChange={setCollectionId} />

      <div className="panel-content">
        <ErrorBoundary>
          <QuoteTable
            spec={futuresSpec}
            contracts={displayContracts}
            snapshots={snapshots}
            selectedInstrument={selectedInstrument}
            isActive={isActive}
            onRowClick={handleClick}
            onRowDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onMultiSelectContextMenu={handleMultiSelectContextMenu}
            onVisibleRangeChange={setVisibleInstrumentIDs}
            favoritedIds={favoritedIds}
            onFavoriteChange={(instrumentID, isFavorited) => {
              // 本夹视角：选中收藏夹 Tab 时 ⭐ 列直接切换本夹收藏态（folder 语义）；
              // 「全部」下维持弹选夹面板（picker 语义）。
              // QuoteTable 传入的是「期望状态」：true=收藏，false=移除。
              if (favoriteMode === 'folder') {
                if (isFavorited) {
                  useCollectionsStore.getState().addToCollections([instrumentID], [collectionId])
                } else {
                  useCollectionsStore.getState().removeFromCollection(instrumentID, collectionId)
                }
                return
              }
              setPicker({ instrumentIDs: [instrumentID] })
            }}
            selectedContracts={selectedContracts}
            onSelectionChange={setSelectedContracts}
          />
        </ErrorBoundary>
      </div>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenFavoritePicker={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}
        onRemoveFromAllCollections={(ids) => useCollectionsStore.getState().removeFromAllCollections(ids)}
        allContractIds={allContractIds}
        favoritedIds={favoritedIds}
      />

      {/* 单选 + 多选右键菜单（共享 useContractMenus，与期权页一致） */}
      {singleMenu}
      {multiMenu}

      {/* 收藏选夹面板（⭐ / 右键 / 工具栏 / 搜索弹窗统一汇聚于此） */}
      <CollectionPicker
        isOpen={!!picker}
        instrumentIDs={picker?.instrumentIDs ?? []}
        onClose={() => setPicker(null)}
      />
    </section>
  )
}
