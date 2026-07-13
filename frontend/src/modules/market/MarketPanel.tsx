import { ContractSearch } from '@/components/ContractSearch'
import { MarketTable } from './MarketTable'
import { useMarketStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { usePointOrder } from '@/hooks/usePointOrder'
import './styles.css'

export function MarketPanel() {
  const { snapshots, setSelectedInstrument } = useMarketStore()
  const { contracts, addContract } = useContractsStore()

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
          snapshots={snapshots}
          onRowClick={handleClick}
          onRowDoubleClick={handleDoubleClick}
        />
      </div>
    </section>
  )
}
