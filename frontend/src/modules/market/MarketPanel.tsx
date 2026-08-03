import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { ContextMenu } from '@/components/ContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OptionPanel } from '@/modules/options/OptionPanel'
import { MarketTable } from './MarketTable'
import { DepthQuote } from './DepthQuote'
import { SpreadDisplay } from '@/components/SpreadDisplay'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'
import { getProductName } from '@/utils/productNames'
import { API_BASE } from '@/services/api'
import { toast } from '@/components/Toast'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites, loadAllInstruments, loadFavoriteContracts } = useContractsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all')
  const [viewMode, setViewMode] = useState<'market' | 'options'>('market')
  const loadedRef = useRef(false)

  // 订阅管理器
  useSubscriptionManager()

  // Display contracts based on active tab
  const baseContracts = activeTab === 'all' ? contracts : favorites

  // 搜索过滤
  const [searchQuery, setSearchQuery] = useState('')
  const displayContracts = useMemo(() => {
    if (!searchQuery.trim()) return baseContracts
    const q = searchQuery.toLowerCase()
    return baseContracts.filter((c) => {
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
  }, [baseContracts, searchQuery])

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

  const onMarketTopLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-top-layout', { table: layout['market-table'], side: layout['market-side'] })
  }, [])

  // WebSocket 行情推送（单例模式）
  useMarketWs(API_BASE.replace('http', 'ws'))

  // 启动时加载全量合约 + 收藏合约
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      loadAllInstruments()
      loadFavoriteContracts()
    }
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
  }

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null

  // T型期权报价模式：直接渲染 OptionPanel
  if (viewMode === 'options') {
    return (
      <section className="market-panel">
        <div className="market-tabs">
          <button className="market-tab" onClick={() => setViewMode('market')}>行情</button>
          <button className="market-tab active" onClick={() => setViewMode('options')}>T型期权报价</button>
        </div>
        <OptionPanel />
      </section>
    )
  }

  return (
    <section className="market-panel">
      <div className="market-tabs">
        <button className="market-tab active" onClick={() => setViewMode('market')}>行情</button>
        <button className="market-tab" onClick={() => setViewMode('options')}>T型期权报价</button>
      </div>
      <div className="panel-header">
        <div className="panel-header__title">
          <h2>行情面板</h2>
          <ContractSearch contracts={baseContracts} onSelect={handleSelectContract} onQueryChange={setSearchQuery} />
          {searchQuery && (
            <span className="search-count">
              {displayContracts.length} / {baseContracts.length}
            </span>
          )}
        </div>
        <div className="panel-header__tabs">
          <button
            className={`btn-tab${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部合约
          </button>
          <button
            className={`btn-tab${activeTab === 'favorites' ? ' active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            自选合约
          </button>
        </div>
        <div className="panel-header__actions">
          <button
            className="btn-search-instruments"
            onClick={() => setSearchModalOpen(true)}
          >
            搜索合约
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
      </div>

      <Group orientation="horizontal" className="panel-content" id="market-top-layout" onLayoutChange={onMarketTopLayout}>
        <Panel id="market-table" defaultSize={savedMarketTop?.table ?? 75} minSize={30}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <ErrorBoundary>
              <MarketTable
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
        </Panel>
        <Separator>
          <ResizeHandle direction="horizontal" />
        </Separator>
        <Panel id="market-side" defaultSize={savedMarketTop?.side ?? 25} minSize={10}>
          <div className="market-panel__side">
            <DepthQuote
              snapshot={selectedSnapshot}
              onBuyClick={(price) => {
                if (selectedInstrument) {
                  setOrderInstrument(selectedInstrument)
                  setOrderForm({ direction: 'buy', limitPrice: price })
                }
              }}
              onSellClick={(price) => {
                if (selectedInstrument) {
                  setOrderInstrument(selectedInstrument)
                  setOrderForm({ direction: 'sell', limitPrice: price })
                }
              }}
            />
            <SpreadDisplay
              bidPrice={selectedSnapshot?.bidPrice1 ?? 0}
              askPrice={selectedSnapshot?.askPrice1 ?? 0}
            />
          </div>
        </Panel>
      </Group>

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
