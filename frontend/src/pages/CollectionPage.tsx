import { useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { futuresSpec } from '@/modules/market/futuresSpec'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { groupOptionsByUnderlying } from '@/modules/market/sort'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore, collectionFavoritedIds } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'
import './CollectionPage.css'

type TypeView = 'all' | 'futures' | 'options'

export function CollectionPage({ collectionId }: { collectionId: string; tabId: string }) {
  const [typeView, setTypeView] = useState<TypeView>('all')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const collections = useCollectionsStore((s) => s.collections)
  const { addToCollections, removeFromCollection } = useCollectionsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openQueryPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const isActive = useTabStore((s) => s.tabs.some((t) => t.id === s.activeTabId && t.type === 'collection' && t.props.collectionId === collectionId))

  const collection = collections.find((c) => c.id === collectionId)
  const favoritedIds = useMemo(() => collectionFavoritedIds(collections, collectionId), [collections, collectionId])

  // 从全量合约解析本夹合约（保持夹内加入顺序；全局合约未加载完的先缺省）
  const memberContracts = useMemo(() => {
    if (!collection) return []
    const byId = new Map(contracts.map((c) => [c.instrumentID, c]))
    return collection.instrumentIDs.map((id) => byId.get(id)).filter((c): c is ContractInfo => !!c)
  }, [collection, contracts])

  const futures = useMemo(() => memberContracts.filter((c) => c.productClass === '1'), [memberContracts])
  const options = useMemo(() => memberContracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [memberContracts])
  const allFutures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])

  // 期权段：按标底分组展平（标底行在前 + 期权行随后），复用 optionsSpec 渲染
  const optionRows = useMemo(() => {
    const groups = groupOptionsByUnderlying(options, allFutures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [options, allFutures])

  // 「全部」模式两段同时渲染时可见区上报合并（避免后报告的表覆盖前者）
  const rangesRef = useRef<{ futures: string[]; options: string[] }>({ futures: [], options: [] })
  const reportVisible = (part: 'futures' | 'options') => (ids: string[]) => {
    rangesRef.current[part] = ids
    const merged = Array.from(new Set([...rangesRef.current.futures, ...rangesRef.current.options]))
    setVisibleInstrumentIDs(merged)
  }

  const handleToggleFavorite = (instrumentID: string) => {
    if (favoritedIds.has(instrumentID)) {
      removeFromCollection(instrumentID, collectionId)
      toast.success(`已从本夹移除 ${instrumentID}`)
    } else {
      addToCollections([instrumentID], [collectionId])
      toast.success(`已收藏到本夹 ${instrumentID}`)
    }
  }

  const { singleMenu, multiMenu } = useContractMenus({
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode: 'folder',
    onToggleInFolder: handleToggleFavorite,
    onRemoveFromFolderBatch: (ids) => {
      // 批量移除 toast 由 useContractMenus 内部统一弹出（避免此处再弹一次形成双 toast）
      for (const id of ids) removeFromCollection(id, collectionId)
    },
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  })

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      const inst = contracts.find((c) => c.instrumentID === instrumentID)
      if (!(inst && inst.productClass === '1')) setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  if (!collection) return <div className="collection-page collection-page__empty">收藏夹不存在</div>

  const isEmpty = memberContracts.length === 0
  const showFutures = typeView === 'all' ? futures.length > 0 : typeView === 'futures'
  const showOptions = typeView === 'all' ? options.length > 0 : typeView === 'options'

  return (
    <section className="collection-page" data-testid="collection-page">
      <div className="market-toolbar">
        <div className="market-toolbar__tabs">
          {(['all', 'futures', 'options'] as TypeView[]).map((v) => (
            <button
              key={v}
              className={`btn-tab${typeView === v ? ' active' : ''}`}
              onClick={() => setTypeView(v)}
            >
              {{ all: '全部', futures: '期货', options: '期权' }[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-content">
        {isEmpty ? (
          <div className="collection-page__empty">
            <p>收藏夹为空</p>
            <p className="collection-page__hint">去行情页点 ⭐ 收藏合约</p>
          </div>
        ) : (
          <ErrorBoundary>
            {showFutures && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期货</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={futuresSpec}
                    contracts={futures}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('futures') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
            {showOptions && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期权</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={optionsSpec}
                    contracts={optionRows}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('options') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
          </ErrorBoundary>
        )}
      </div>
      {singleMenu}
      {multiMenu}
    </section>
  )
}
