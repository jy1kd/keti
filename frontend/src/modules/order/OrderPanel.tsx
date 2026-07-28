import { useState, useCallback } from 'react'
import { OrderForm } from './OrderForm'
import { StopOrderForm } from './StopOrderForm'
import { useOrderStore } from './store'
import { useHotKeys } from '../../hooks/useHotKeys'
import { toast } from '../../components/Toast'
import { QuickActions } from '../../components/QuickActions'
import { BatchCancel } from '../../components/BatchCancel'
import { QuickKeys } from '../../components/QuickKeys'
import { reversePosition, lockPosition, refreshOrders, cancelOrder } from '../../services/api'
import { useUserPrefsStore } from '../../stores/userPrefs'
import './styles.css'

type TabKey = 'order' | 'stop'

export function OrderPanel() {
  const [tab, setTab] = useState<TabKey>('order')
  const [showBatchCancel, setShowBatchCancel] = useState(false)
  const [showQuickKeys, setShowQuickKeys] = useState(false)
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

  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const orderForm = useOrderStore((s) => s.orderForm)
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)

  useHotKeys({
    enabled: true,
    onBuy: () => setOrderForm({ direction: 'buy' }),
    onSell: () => setOrderForm({ direction: 'sell' }),
    onCancelAll: () => {
      toast.error('请使用查询面板撤单')
    },
    hotKeys,
  })

  const handleReverse = useCallback(async (instrumentID: string) => {
    return reversePosition(instrumentID)
  }, [])

  const handleLock = useCallback(async (instrumentID: string) => {
    return lockPosition(instrumentID)
  }, [])

  const handleBatchCancel = useCallback(async () => {
    setShowBatchCancel(true)
    setShowQuickKeys(false)
    setOrdersLoading(true)
    try {
      const result = await refreshOrders()
      if (result.orders) {
        // Only show unfilled orders; match CTP status codes
        // '1'=部分成交, '2'=未成交(排队), '3'=未成交(不在队列)
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

  const handleSaveHotKeys = useCallback(
    (newHotKeys: typeof hotKeys) => {
      const prefs = useUserPrefsStore.getState()
      prefs.setHotKeys(newHotKeys)
      prefs.saveToLocalStorage()
      toast.success('快捷键已保存')
    },
    []
  )

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
          <button
            type="button"
            className={`tab-btn ${showQuickKeys ? 'active' : ''}`}
            onClick={() => {
              setShowQuickKeys(!showQuickKeys)
              setShowBatchCancel(false)
            }}
          >
            快捷键
          </button>
        </div>
      </div>

      <QuickActions
        instrumentID={orderForm.instrumentID}
        onReverse={handleReverse}
        onLock={handleLock}
        onBatchCancel={handleBatchCancel}
      />

      <div className="panel-content">
        {tab === 'order' ? <OrderForm /> : <StopOrderForm />}
      </div>

      {showBatchCancel && !showQuickKeys && (
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

      {showQuickKeys && !showBatchCancel && (
        <div className="panel-overlay">
          <QuickKeys
            hotKeys={hotKeys}
            onSave={handleSaveHotKeys}
            onClose={() => setShowQuickKeys(false)}
          />
        </div>
      )}
    </section>
  )
}
