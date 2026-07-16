import { Group, Panel, Separator } from 'react-resizable-panels'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { ResizeHandle } from '@/components/ResizeHandle'
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
      <Group orientation="vertical" className="main-content">
        <Panel defaultSize={75} minSize={30}>
          <Group orientation="horizontal">
            <Panel defaultSize={70} minSize={20}>
              <section className="market-area">
                <MarketPanel />
              </section>
            </Panel>
            <Separator>
              <ResizeHandle direction="horizontal" />
            </Separator>
            <Panel defaultSize={30} minSize={15}>
              <section className="order-area">
                <OrderPanel />
              </section>
            </Panel>
          </Group>
        </Panel>
        <Separator>
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel defaultSize={25} minSize={10}>
          <footer className="query-area">
            <QueryPanel />
          </footer>
        </Panel>
      </Group>
    </div>
  )
}

export default App
