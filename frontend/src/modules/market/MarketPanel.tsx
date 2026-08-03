import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
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
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites, loadAllInstruments, loadFavoriteContracts } = useContractsStore()
  const { contextMenu, openOrderTab, openKlineTab, handleContextMenu } = useContractContextMenu()
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
    onFill: ({ instrumentID, price }) => {
      // 双击打开报单标签页
      setSelectedInstrument(instrumentID)
      openOrderTab(instrumentID)
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
            disabled={!selectedInstrument}
            onClick={() => {
              if (!selectedInstrument) return
              if (favoritedIds.has(selectedInstrument)) {
                removeFromFavorites(selectedInstrument)
                toast.success(`已移除 ${selectedInstrument}`)
              } else {
                const inst = contracts.find(c => c.instrumentID === selectedInstrument)
                if (inst) {
                  addToFavorites(inst)
                  toast.success(`已收藏 ${inst.instrumentID}`)
                }
              }
            }}
          >
            {selectedInstrument && favoritedIds.has(selectedInstrument) ? '移除' : '收藏'}
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

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="context-menu__item"
            onClick={() => openOrderTab(contextMenu.instrumentID)}
          >
            打开报单
          </button>
          <button
            className="context-menu__item"
            onClick={() => openKlineTab(contextMenu.instrumentID)}
          >
            打开K线
          </button>
        </div>
      )}
    </section>
  )
}
