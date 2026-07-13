import { ConnectionStatus } from '@/components/ConnectionStatus'
import { MarketPanel } from '@/modules/market/MarketPanel'
import { OrderPanel } from '@/modules/order/OrderPanel'
import { QueryPanel } from '@/modules/query/QueryPanel'
import '@/assets/styles/global.css'

function App() {
  return (
    <div className="app">
      <header className="status-bar">
        <ConnectionStatus />
        <span className="app-title">SimNow 交易终端</span>
      </header>
      <main className="main-content">
        <section className="market-area">
          <MarketPanel />
        </section>
        <section className="order-area">
          <OrderPanel />
        </section>
      </main>
      <footer className="query-area">
        <QueryPanel />
      </footer>
    </div>
  )
}

export default App
