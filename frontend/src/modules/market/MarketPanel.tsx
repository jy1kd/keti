import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ResizeHandle } from '@/components/ResizeHandle'
import { ContractSearch } from '@/components/ContractSearch'
import { MarketTable } from './MarketTable'
import { DepthQuote } from './DepthQuote'
import { SpreadDisplay } from '@/components/SpreadDisplay'
import { KLineChart } from './KLineChart'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useOrderStore } from '@/modules/order/store'
import { useMarketWs, PERIOD_MS } from '@/hooks/useMarketWs'
import { API_BASE, getKlineData } from '@/services/api'
import { savePanelSizes, loadPanelSizes } from '@/utils/panelStorage'
import './styles.css'

const savedMarketTop = loadPanelSizes('market-top-layout')
const savedMarket = loadPanelSizes('market-layout')

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, fetchInstruments, subscribeInstruments, klineData, setKlineData, refreshInstruments, isRefreshing } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const { contracts, addContract } = useContractsStore()
  const fetchedRef = useRef(false)
  const [period, setPeriod] = useState('5m')

  const onMarketTopLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-top-layout', { table: layout['market-table'], side: layout['market-side'] })
  }, [])

  const onMarketLayout = useCallback((layout: Record<string, number>) => {
    savePanelSizes('market-layout', { top: layout['market-top'], kline: layout['market-kline'] })
  }, [])

  // WebSocket 行情推送（period 影响实时 K 线的时间对齐）
  useMarketWs(API_BASE.replace('http', 'ws'), period)

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      // 获取合约列表后，订阅所有合约的行情
      fetchInstruments().then(() => {
        const allContracts = useContractsStore.getState().contracts
        if (allContracts.length > 0) {
          subscribeInstruments(allContracts.map(c => c.instrumentID))
        }
      })
    }
  }, [fetchInstruments, subscribeInstruments])

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
    addContract(instrumentID)
    setSelectedInstrument(instrumentID)
    setOrderInstrument(instrumentID)
  }

  // 获取K线数据（时间戳按周期对齐，与实时数据保持一致）
  useEffect(() => {
    if (!selectedInstrument) return
    getKlineData(selectedInstrument, period, 200)
      .then((res) => {
        if (res.bars?.length) {
          const periodMs = PERIOD_MS[period] ?? PERIOD_MS['5m']
          const aligned = res.bars.map((bar) => {
            // 只用时分秒，去掉日期部分，与实时数据保持一致
            const d = new Date(bar.timestamp)
            const timeMs = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000) + d.getMilliseconds()
            return { ...bar, timestamp: Math.floor(timeMs / periodMs) * periodMs }
          })
          setKlineData(selectedInstrument, aligned)
        }
      })
      .catch(() => { /* 静默失败，K线区域显示暂无数据 */ })
  }, [selectedInstrument, period, setKlineData])

  const selectedSnapshot = selectedInstrument ? snapshots.get(selectedInstrument) ?? null : null
  const selectedKline = selectedInstrument ? klineData.get(selectedInstrument) ?? [] : []

  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <div className="panel-header__actions">
          <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
          <button
            className="btn-refresh-instruments"
            disabled={isRefreshing}
            onClick={() => refreshInstruments()}
          >
            {isRefreshing ? '刷新中...' : '刷新合约'}
          </button>
        </div>
      </div>
      {/* 布局：上半部 [行情表格 | 五档行情]，下半部 [K线图 全宽] */}
      <Group orientation="vertical" className="panel-content" id="market-layout" onLayoutChange={onMarketLayout}>
        <Panel id="market-top" defaultSize={savedMarket?.top ?? 50} minSize={20}>
          <Group orientation="horizontal" className="market-panel__top" id="market-top-layout" onLayoutChange={onMarketTopLayout}>
            <Panel id="market-table" defaultSize={savedMarketTop?.table ?? 75} minSize={30}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <MarketTable
                  contracts={contracts}
                  snapshots={snapshots}
                  selectedInstrument={selectedInstrument}
                  onRowClick={handleClick}
                  onRowDoubleClick={handleDoubleClick}
                />
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
        </Panel>
        <Separator>
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel id="market-kline" defaultSize={savedMarket?.kline ?? 50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedInstrument ? (
              <KLineChart
                instrument={selectedInstrument}
                klineData={selectedKline}
                period={period}
                onPeriodChange={setPeriod}
              />
            ) : (
              <div className="market-panel__kline-placeholder">选择合约查看K线图</div>
            )}
          </div>
        </Panel>
      </Group>
    </section>
  )
}
