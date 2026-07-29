import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { InstrumentSearchModal } from '@/components/InstrumentSearchModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MarketTable } from './MarketTable'
import { DepthQuote } from './DepthQuote'
import { SpreadDisplay } from '@/components/SpreadDisplay'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useUserPrefsStore } from '@/stores/userPrefs'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { useMarketWs } from '@/hooks/useMarketWs'
import { API_BASE, subscribeMarket } from '@/services/api'
import { toast } from '@/components/Toast'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { presetContracts, userContracts, contracts, presetIds, addContractInfo, removeFromFavorites, subscribeAndAddToPreset, removeContractById } = useContractsStore()
  const { selectedContracts } = useUserPrefsStore()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'preset' | 'user'>('preset')
  const loadedRef = useRef(false)

  // Display contracts based on active tab
  const displayContracts = activeTab === 'preset' ? presetContracts : userContracts

  // User-subscribed IDs (for modal "已订阅" badge and button state)
  const userSubscribedIds = useMemo(
    () => new Set(selectedContracts),
    [selectedContracts]
  )
  // Preset IDs set (for modal button state)
  const presetIdsSet = useMemo(
    () => new Set(presetIds),
    [presetIds]
  )
  // Combined set: all contracts in the system (preset + user)
  const allContractIds = useMemo(
    () => new Set(contracts.map(c => c.instrumentID)),
    [contracts]
  )

  const onMarketTopLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-top-layout', { table: layout['market-table'], side: layout['market-side'] })
  }, [])

  // WebSocket 行情推送（单例模式）
  useMarketWs(API_BASE.replace('http', 'ws'))

  // 启动时加载预设合约 + 用户订阅
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      useContractsStore.getState().loadSubscribedContracts().then(() => {
        const loaded = useContractsStore.getState().contracts
        if (loaded.length > 0) {
          subscribeMarket(loaded.map((c) => c.instrumentID)).catch(() => {})
        }
      })
    }
  }, [])

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      setOrderForm({ limitPrice: price })
    },
  })

  const handleSelectContract = (instrumentID: string) => {
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
  }

  const handleUnsubscribe = async () => {
    if (!selectedInstrument) return
    const id = selectedInstrument
    await removeContractById(id)
    setSelectedInstrument(null)
    toast.success(`已退订 ${id}`)
  }

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null

  return (
    <section className="market-panel">
      <div className="panel-header">
        <div className="panel-header__title">
          <h2>行情面板</h2>
          <ContractSearch contracts={displayContracts} onSelect={handleSelectContract} />
        </div>
        <div className="panel-header__tabs">
          <button
            className={`btn-tab${activeTab === 'preset' ? ' active' : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            预设合约
          </button>
          <button
            className={`btn-tab${activeTab === 'user' ? ' active' : ''}`}
            onClick={() => setActiveTab('user')}
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
            className={`btn-favorite${selectedInstrument && userSubscribedIds.has(selectedInstrument) ? ' btn-favorite--remove' : ''}`}
            disabled={!selectedInstrument}
            onClick={() => {
              if (!selectedInstrument) return
              if (userSubscribedIds.has(selectedInstrument)) {
                removeFromFavorites(selectedInstrument)
                toast.success(`已移除 ${selectedInstrument}`)
              } else {
                const inst = presetContracts.find(c => c.instrumentID === selectedInstrument)
                if (inst) {
                  addContractInfo(inst)
                  toast.success(`已收藏 ${inst.instrumentID}`)
                }
              }
            }}
          >
            {selectedInstrument && userSubscribedIds.has(selectedInstrument) ? '移除' : '收藏'}
          </button>
          <button
            className="btn-unsubscribe"
            disabled={!selectedInstrument}
            onClick={handleUnsubscribe}
          >
            退订
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
        onSubscribeNew={subscribeAndAddToPreset}
        onAddToFavorite={addContractInfo}
        onRemoveFromFavorite={removeFromFavorites}
        onUnsubscribe={removeContractById}
        allContractIds={allContractIds}
        userSubscribedIds={userSubscribedIds}
        presetIds={presetIdsSet}
      />
    </section>
  )
}
