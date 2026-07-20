import { useState } from 'react'
import { OrderForm } from './OrderForm'
import { StopOrderForm } from './StopOrderForm'
import './styles.css'

type TabKey = 'order' | 'stop'

export function OrderPanel() {
  const [tab, setTab] = useState<TabKey>('order')

  return (
    <section className="order-panel">
      <div className="panel-header">
        <h2>报单面板</h2>
        <div className="panel-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'order' ? 'active' : ''}`}
            onClick={() => setTab('order')}
          >
            报单
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'stop' ? 'active' : ''}`}
            onClick={() => setTab('stop')}
          >
            止损单
          </button>
        </div>
      </div>
      <div className="panel-content">
        {tab === 'order' ? <OrderForm /> : <StopOrderForm />}
      </div>
    </section>
  )
}
