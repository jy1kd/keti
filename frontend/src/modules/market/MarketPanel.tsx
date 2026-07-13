import { ContractSearch } from '@/components/ContractSearch'
import './styles.css'

export function MarketPanel() {
  return (
    <section className="market-panel">
      <div className="panel-header">
        <h2>行情面板</h2>
        <ContractSearch />
      </div>
      <div className="panel-content">
        {/* 行情表格将在 PR-6 实现 */}
      </div>
    </section>
  )
}
