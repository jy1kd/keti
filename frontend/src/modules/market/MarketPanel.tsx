import { useEffect, useMemo, useState } from 'react'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { ContextMenu } from '@/components/ContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ContractFilter } from '@/components/ContractFilter'
import { QuoteTable } from './QuoteTable'
import { futuresSpec } from './futuresSpec'
import { sortFutures } from './sort'
import { filterByExchangeAndProduct } from './filter'
import { useMarketStore } from './store'
import { useMarketFilterStore } from '@/stores/marketFilter'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { getProductName } from '@/utils/productNames'
import { isContractActive } from '@/utils/contractStatus'
import { isElectron } from '@/services/electron'
import { toast } from '@/components/Toast'
import './styles.css'

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openQueryPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all')
  // 过滤开关：仅显示交易中合约（隐藏已停牌/已到期），默认关（显示全部）
  const [filterActive, setFilterActive] = useState(false)

  // 期货页筛选态（交易所+品种多选，独立于期权页，localStorage 持久化）
  const filter = useMarketFilterStore((s) => s.futures)

  // 期货全量（期货页只展示期货合约）+ 排序（数据管道第一步，设计 §3 决策 3）
  const sortedFutures = useMemo(
    () => sortFutures(contracts.filter((c) => c.productClass === '1')),
    [contracts],
  )
  // 自选视图同样只展示期货合约
  const favoriteFutures = useMemo(
    () => favorites.filter((c) => c.productClass === '1'),
    [favorites],
  )

  // Display contracts based on active tab
  const baseContracts = activeTab === 'all' ? sortedFutures : favoriteFutures

  // 筛选面板可用选项：交易所 = 期货合约去重；品种 = productID 去重（保持排序后顺序）
  const filterExchanges = useMemo(
    () => Array.from(new Set(sortedFutures.map((c) => c.exchangeID))),
    [sortedFutures],
  )
  const filterProducts = useMemo(
    () => Array.from(new Set(sortedFutures.map((c) => c.productID))),
    [sortedFutures],
  )
  const filterProductNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of filterProducts) m[p] = getProductName(p)
    return m
  }, [filterProducts])

  // 搜索过滤
  const [searchQuery, setSearchQuery] = useState('')
  const displayContracts = useMemo(() => {
    // 数据管道：全部/自选 → 筛选（交易所+品种）→ 仅交易中 → 搜索
    let base = filterByExchangeAndProduct(baseContracts, filter.exchanges, filter.products, (c) => c.productID)
    // 过滤开关：默认仅显示交易中合约
    base = filterActive ? base.filter(isContractActive) : base
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
  }, [baseContracts, filter, searchQuery, filterActive])

  // User-favorited IDs (for modal "已订阅" badge and button state)
  const favoritedIds = useMemo(
    () => new Set(favorites.map(c => c.instrumentID)),
    [favorites]
  )
  // All contract IDs in the system
  const allContractIds = useMemo(
    () => new Set(contracts.map(c => c.instrumentID)),
    [contracts]
  )

  // 顶部菜单「行情」切换（设计 §4.1）：期货/期权为独立固定标签。
  // options → 激活期权标签；all/favorites → 激活期货标签并切内部全部/自选。
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onMarketView?.((view) => {
      if (view === 'options') {
        const options = useTabStore.getState().tabs.find((t) => t.type === 'options')
        if (options) useTabStore.getState().setActiveTab(options.id)
        return
      }
      setActiveTab(view === 'favorites' ? 'favorites' : 'all')
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
      {/* 行情页工具栏：合并 market-tabs（模式切换）+ panel-header（搜索/全部自选/操作）为单行。
          保留 data-drag-handle：market 为固定标签（closable:false）故 TabContent 中惰性不触发，
          与旧 market-tabs 行为一致；保留以对齐 Phase 2 全局栏合并后的拖拽语义（审查 🔵-1）。 */}
      <div className="market-toolbar" data-drag-handle>
        {/* 功能靠左：全部/自选 → 筛选 → 仅交易中 → 收藏 */}
        <div className="market-toolbar__tabs">
          <button
            className={`btn-tab${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部
          </button>
          <button
            className={`btn-tab${activeTab === 'favorites' ? ' active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            自选
          </button>
        </div>
        <ContractFilter
          exchanges={filterExchanges}
          products={filterProducts}
          productNames={filterProductNames}
          value={filter}
          onChange={(v) => {
            useMarketFilterStore.getState().setExchanges('futures', v.exchanges)
            useMarketFilterStore.getState().setProducts('futures', v.products)
          }}
        />
        <div className="market-toolbar__actions">
          <button
            className={`btn-filter-status${filterActive ? ' active' : ''}`}
            onClick={() => setFilterActive((v) => !v)}
            title={filterActive ? '仅显示交易中合约' : '显示全部合约'}
          >
            {filterActive ? '仅交易中' : '显示全部'}
          </button>
          <button
            className={`btn-favorite${selectedInstrument && favoritedIds.has(selectedInstrument) ? ' btn-favorite--remove' : ''}`}
            disabled={!selectedInstrument && selectedContracts.size === 0}
            onClick={async () => {
              // 如果有多选，批量收藏/取消收藏
              if (selectedContracts.size > 1) {
                const allFavorited = Array.from(selectedContracts).every(id => favoritedIds.has(id))
                if (allFavorited) {
                  // 全部已收藏，批量取消
                  for (const id of selectedContracts) {
                    await removeFromFavorites(id)
                  }
                  toast.success(`已移除 ${selectedContracts.size} 个合约`)
                } else {
                  // 批量收藏
                  let count = 0
                  for (const id of selectedContracts) {
                    const inst = contracts.find(c => c.instrumentID === id)
                    if (inst) {
                      const success = await addToFavorites(inst)
                      if (success) count++
                    }
                  }
                  toast.success(`已收藏 ${count} 个合约`)
                }
                return
              }

              // 单个合约收藏/取消收藏
              if (!selectedInstrument) return
              if (favoritedIds.has(selectedInstrument)) {
                await removeFromFavorites(selectedInstrument)
                toast.success(`已移除 ${selectedInstrument}`)
              } else {
                const inst = contracts.find(c => c.instrumentID === selectedInstrument)
                if (inst) {
                  await addToFavorites(inst)
                  toast.success(`已收藏 ${inst.instrumentID}`)
                }
              }
            }}
          >
            {selectedContracts.size > 1
              ? (Array.from(selectedContracts).every(id => favoritedIds.has(id)) ? '批量移除' : '批量收藏')
              : (selectedInstrument && favoritedIds.has(selectedInstrument) ? '移除' : '收藏')
            }
          </button>
        </div>
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

      <div className="panel-content">
        <ErrorBoundary>
          <QuoteTable
            spec={futuresSpec}
            contracts={displayContracts}
            snapshots={snapshots}
            selectedInstrument={selectedInstrument}
            onRowClick={handleClick}
            onRowDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onMultiSelectContextMenu={handleMultiSelectContextMenu}
            onVisibleRangeChange={setVisibleInstrumentIDs}
            favoritedIds={favoritedIds}
            onFavoriteChange={(instrumentID, isFavorited) => {
              if (isFavorited) {
                const inst = contracts.find(c => c.instrumentID === instrumentID)
                if (inst) {
                  addToFavorites(inst)
                  toast.success(`已收藏 ${instrumentID}`)
                }
              } else {
                removeFromFavorites(instrumentID)
                toast.success(`已移除 ${instrumentID}`)
              }
            }}
            selectedContracts={selectedContracts}
            onSelectionChange={setSelectedContracts}
          />
        </ErrorBoundary>
      </div>

      <InstrumentSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onAddToFavorite={addToFavorites}
        onRemoveFromFavorite={removeFromFavorites}
        allContractIds={allContractIds}
        favoritedIds={favoritedIds}
      />

      {/* 单选右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: '打开报单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
            { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
            { label: '查询', icon: '📋', onClick: () => openQueryPopup(contextMenu.instrumentID) },
            {
              label: favoritedIds.has(contextMenu.instrumentID) ? '取消收藏' : '收藏',
              icon: favoritedIds.has(contextMenu.instrumentID) ? '★' : '⭐',
              onClick: () => {
                if (favoritedIds.has(contextMenu.instrumentID)) {
                  removeFromFavorites(contextMenu.instrumentID)
                  toast.success(`已移除 ${contextMenu.instrumentID}`)
                } else {
                  const inst = contracts.find(c => c.instrumentID === contextMenu.instrumentID)
                  if (inst) {
                    addToFavorites(inst)
                    toast.success(`已收藏 ${contextMenu.instrumentID}`)
                  }
                }
              },
            },
            { label: '复制合约代码', icon: '📋', onClick: () => navigator.clipboard.writeText(contextMenu.instrumentID) },
          ]}
          onClose={closeMenus}
        />
      )}

      {/* 多选右键菜单 */}
      {multiSelectMenu && (() => {
        // 计算已收藏和未收藏的数量
        const unfavoritedIds = multiSelectMenu.instrumentIDs.filter(id => !favoritedIds.has(id))
        const favoritedIdsInSelection = multiSelectMenu.instrumentIDs.filter(id => favoritedIds.has(id))

        return (
          <ContextMenu
            x={multiSelectMenu.x}
            y={multiSelectMenu.y}
            items={[
              { label: `批量打开报单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📝', onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs) },
              { label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📈', onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs) },
              {
                label: `批量收藏 (${unfavoritedIds.length}个)`,
                icon: '⭐',
                disabled: unfavoritedIds.length === 0,
                onClick: async () => {
                  let count = 0
                  for (const id of unfavoritedIds) {
                    const inst = contracts.find(c => c.instrumentID === id)
                    if (inst) {
                      const success = await addToFavorites(inst)
                      if (success) count++
                    }
                  }
                  toast.success(`已收藏 ${count} 个合约`)
                },
              },
              {
                label: `批量取消收藏 (${favoritedIdsInSelection.length}个)`,
                icon: '★',
                disabled: favoritedIdsInSelection.length === 0,
                onClick: async () => {
                  for (const id of favoritedIdsInSelection) {
                    await removeFromFavorites(id)
                  }
                  toast.success(`已移除 ${favoritedIdsInSelection.length} 个合约`)
                },
              },
              {
                label: `复制合约代码 (${multiSelectMenu.instrumentIDs.length}个)`,
                icon: '📋',
                onClick: () => navigator.clipboard.writeText(multiSelectMenu.instrumentIDs.join(',')),
              },
            ]}
            onClose={closeMenus}
          />
        )
      })()}
    </section>
  )
}
