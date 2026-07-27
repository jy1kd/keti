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
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, showSubscribedOnly, presetIds, addContractInfo, removeContractById, toggleShowSubscribedOnly } = useContractsStore()
  const { selectedContracts } = useUserPrefsStore()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const loadedRef = useRef(false)

  // Filter contracts when "已订阅" toggle is active
  const displayContracts = useMemo(() => {
    if (!showSubscribedOnly) return contracts
    const selectedSet = new Set(selectedContracts)
    return contracts.filter((c) => selectedSet.has(c.instrumentID))
  }, [contracts, showSubscribedOnly, selectedContracts])

  // User-subscribed IDs only (for modal "已订阅" badge)
  const userSubscribedIds = useMemo(
    () => new Set(selectedContracts),
    [selectedContracts]
  )
  // Preset IDs set (for modal "订阅(预设)" button)
  const presetIdsSet = useMemo(
    () => new Set(presetIds),
    [presetIds]
  )
  // Whether selected instrument is a preset (not yet user-subscribed)
  const isSelectedPreset = useMemo(
    () => selectedInstrument != null && presetIdsSet.has(selectedInstrument) && !userSubscribedIds.has(selectedInstrument),
    [selectedInstrument, presetIdsSet, userSubscribedIds]
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
    await removeContractById(selectedInstrument)
    setSelectedInstrument(null)
  }

  const handleSubscribeSelected = () => {
    if (!selectedInstrument) return
    const inst = contracts.find((c) => c.instrumentID === selectedInstrument)
    if (inst) {
      addContractInfo(inst)
      subscribeMarket([inst.instrumentID]).catch(() => {})
    }
  }

  const handleSubscribeFromModal = (inst: import('@/services/types').ContractInfo) => {
    addContractInfo(inst)
    // Subscribe to CTP market data
    subscribeMarket([inst.instrumentID]).catch(() => {})
  }

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null

  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <div className="panel-header__actions">
          <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
          <button
            className="btn-search-instruments"
            onClick={() => setSearchModalOpen(true)}
          >
            搜索合约
          </button>
          <button
            className={`btn-subscribed-toggle${showSubscribedOnly ? ' active' : ''}`}
            onClick={toggleShowSubscribedOnly}
          >
            已订阅
          </button>
          <button
            className="btn-unsubscribe"
            disabled={!selectedInstrument}
            onClick={handleUnsubscribe}
          >
            退订
          </button>
          <button
            className="btn-subscribe-selected"
            disabled={!isSelectedPreset}
            onClick={handleSubscribeSelected}
          >
            订阅
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
        onSubscribe={handleSubscribeFromModal}
        userSubscribedIds={userSubscribedIds}
        presetIds={presetIdsSet}
      />
    </section>
  )
}
