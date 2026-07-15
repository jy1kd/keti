import { useEffect, useRef } from 'react'
import { ContractSearch } from '@/components/ContractSearch'
import { MarketTable } from './MarketTable'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useMarketWs } from '@/hooks/useMarketWs'
import { API_BASE } from '@/services/api'
import './styles.css'

export function MarketPanel() {
  const { snapshots, selectedInstrument, setSelectedInstrument, fetchInstruments, subscribeInstruments } = useMarketStore()
  const { contracts, addContract } = useContractsStore()
  const fetchedRef = useRef(false)

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

  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <ContractSearch contracts={contracts} onSelect={handleSelectContract} />
      </div>
      <div className="panel-content">
        <MarketTable
          contracts={contracts}
          snapshots={snapshots}
          selectedInstrument={selectedInstrument}
          onRowClick={handleClick}
          onRowDoubleClick={handleDoubleClick}
        />
      </div>
    </section>
  )
}
