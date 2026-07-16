import { useEffect, useRef, useState } from 'react'
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
import { useMarketWs } from '@/hooks/useMarketWs'
import { API_BASE, getKlineData } from '@/services/api'
import './styles.css'

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, fetchInstruments, subscribeInstruments, klineData, setKlineData } = useMarketStore()
  const { contracts, addContract } = useContractsStore()
  const fetchedRef = useRef(false)
  const [period, setPeriod] = useState('5m')

  // WebSocket 行情推送
  useMarketWs(API_BASE.replace('http', 'ws'))

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
      // TODO: PR-10 接入报单表单
      console.log('点价报单:', instrumentID, price)
    },
    onFill: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      // TODO: PR-10 填充报单面板
      console.log('填充报单:', instrumentID, price)
    },
  })

  const handleSelectContract = (instrumentID: string) => {
    addContract(instrumentID)
    setSelectedInstrument(instrumentID)
  }

  // 获取K线数据
  useEffect(() => {
    if (!selectedInstrument) return
    getKlineData(selectedInstrument, period, 200)
      .then((res) => {
        if (res.bars?.length) {
          setKlineData(selectedInstrument, res.bars)
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
        <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
      </div>
      <Group orientation="horizontal" className="panel-content" autoSaveId="market-layout">
        <Panel id="market-main" defaultSize={75} minSize={30}>
          <Group orientation="vertical" className="market-panel__main" autoSaveId="market-main-layout">
            <Panel id="market-table" defaultSize={50} minSize={15}>
              <MarketTable
                contracts={contracts}
                snapshots={snapshots}
                selectedInstrument={selectedInstrument}
                onRowClick={handleClick}
                onRowDoubleClick={handleDoubleClick}
              />
            </Panel>
            <Separator>
              <ResizeHandle direction="vertical" />
            </Separator>
            <Panel id="market-kline" defaultSize={50} minSize={15}>
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
            </Panel>
          </Group>
        </Panel>
        <Separator>
          <ResizeHandle direction="horizontal" />
        </Separator>
        <Panel id="market-side" defaultSize={25} minSize={10}>
          <div className="market-panel__side">
            <DepthQuote
              snapshot={selectedSnapshot}
              onBuyClick={(price) => {
                if (selectedInstrument) {
                  // TODO: PR-10 接入报单表单
                  console.log('买入', selectedInstrument, price)
                }
              }}
              onSellClick={(price) => {
                if (selectedInstrument) {
                  // TODO: PR-10 接入报单表单
                  console.log('卖出', selectedInstrument, price)
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
    </section>
  )
}
