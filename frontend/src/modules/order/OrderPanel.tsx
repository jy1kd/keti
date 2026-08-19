import { useState, useCallback } from 'react'
import { OrderForm } from './OrderForm'
import { StopOrderForm } from './StopOrderForm'
import { useOrderStore } from './store'
import { useHotKeys } from '../../hooks/useHotKeys'
import { toast } from '../../components/Toast'
import { QuickActions } from '../../components/QuickActions'
import { BatchCancel } from '../../components/BatchCancel'
import { refreshOrders, cancelOrder } from '../../services/api'
import { useUserPrefsStore } from '../../stores/userPrefs'
import './styles.css'

type TabKey = 'order' | 'stop'

export function OrderPanel() {
  const [tab, setTab] = useState<TabKey>('order')
  const [showBatchCancel, setShowBatchCancel] = useState(false)
  const [activeOrders, setActiveOrders] = useState<Array<{
    orderRef: string
    instrumentID: string
    direction: string
    combOffsetFlag: string
    limitPrice: number
    volumeTotalOriginal: number
    orderStatus: string
  }>>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const orderForm = useOrderStore((s) => s.orderForm)
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)

  const handleBatchCancel = useCallback(async () => {
    setShowBatchCancel(true)
    setOrdersLoading(true)
    try {
      const result = await refreshOrders()
      if (result.orders) {
        const unfilled = result.orders.filter(
          (o) => o.orderStatus === '1' || o.orderStatus === '2' || o.orderStatus === '3'
        )
        setActiveOrders(unfilled)
      }
    } catch {
      toast.error('获取报单列表失败')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const handleCancelSingleOrder = useCallback(async (orderRef: string) => {
    try {
      const result = await cancelOrder(orderRef)
      return result.success
    } catch {
      return false
    }
  }, [])

  // ── Hotkeys：仅保留批量撤单（导航快捷键在 App 层统一处理） ──
  useHotKeys({
    enabled: true,
    onBatchCancel: handleBatchCancel,
    hotKeys,
  })

  return (
    <section className="order-panel">
      {/* 快捷操作按钮 — 与行情面板的 market-tabs 等高 */}
      <QuickActions instrumentID={orderForm.instrumentID} onBatchCancel={handleBatchCancel} />

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

      {showBatchCancel && (
        <div className="panel-overlay">
          {ordersLoading ? (
            <div className="batch-cancel-loading">加载中...</div>
          ) : (
            <BatchCancel
              orders={activeOrders}
              onCancelOrder={handleCancelSingleOrder}
              onClose={() => setShowBatchCancel(false)}
            />
          )}
        </div>
      )}
    </section>
  )
}
