import { useState, useCallback } from 'react'
import { OrderForm } from './OrderForm'
import { StopOrderForm } from './StopOrderForm'
import { useOrderStore } from './store'
import { useHotKeys } from '../../hooks/useHotKeys'
import { toast } from '../../components/Toast'
import { QuickActions } from '../../components/QuickActions'
import { BatchCancel } from '../../components/BatchCancel'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { reversePosition, lockPosition, refreshOrders, cancelOrder } from '../../services/api'
import { useUserPrefsStore } from '../../stores/userPrefs'
import { calcCounterpartyPrice } from '../../utils/priceCalc'
import { useMarketStore } from '../market/store'
import { useContractsStore } from '../../stores/contracts'
import type { MarketSnapshot } from '../../services/types'
import './styles.css'

type TabKey = 'order' | 'stop'

interface ConfirmState {
  type: 'reverse' | 'lock'
  instrumentID: string
  details: Array<{ label: string; value: string }>
  warning?: string
}

export function OrderPanel() {
  const [tab, setTab] = useState<TabKey>('order')
  const [showBatchCancel, setShowBatchCancel] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
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
  const quickTradeConfig = useUserPrefsStore((s) => s.quickTradeConfig)
  const snapshots = useMarketStore((s) => s.snapshots)
  const contracts = useContractsStore((s) => s.contracts)

  /** 获取合约的 priceTick */
  const getPriceTick = useCallback((instrumentID: string): number => {
    const contract = contracts.find(c => c.instrumentID === instrumentID)
    return contract?.priceTick ?? 0.2
  }, [contracts])

  /** 获取行情快照 */
  const getSnapshot = useCallback((instrumentID: string): MarketSnapshot | undefined => {
    return snapshots.get(instrumentID)
  }, [snapshots])

  /** 构建反向确认详情 */
  const buildReverseDetails = useCallback((instrumentID: string): ConfirmState | null => {
    const config = quickTradeConfig.reverse

    const closeMode = config.close.priceMode === 'counterparty'
      ? `对价限价 ±${config.close.offsetTicks}跳`
      : '市价'
    const openMode = config.open.priceMode === 'counterparty'
      ? `对价限价 ±${config.open.offsetTicks}跳`
      : '市价'
    const closeTc = config.close.timeCondition === 'gfd' ? 'GFD' : 'FAK'
    const openTc = config.open.timeCondition === 'gfd' ? 'GFD' : 'FAK'
    const execMode = config.executionMode === 'serial' ? '串行' : '并行'

    return {
      type: 'reverse',
      instrumentID,
      details: [
        { label: '合约', value: instrumentID },
        { label: '平仓', value: `${closeMode} ${closeTc}` },
        { label: '开仓', value: `${openMode} ${openTc}` },
        { label: '模式', value: execMode },
      ],
      warning: config.executionMode === 'parallel'
        ? '并行模式同时发送平仓和开仓，若平仓失败开仓成功，可能造成意外锁仓。'
        : undefined,
    }
  }, [quickTradeConfig, getSnapshot, getPriceTick])

  /** 构建锁仓确认详情 */
  const buildLockDetails = useCallback((instrumentID: string): ConfirmState | null => {
    const config = quickTradeConfig.lock
    const mode = config.priceMode === 'counterparty'
      ? `对价限价 ±${config.offsetTicks}跳`
      : '市价'
    const tc = config.timeCondition === 'gfd' ? 'GFD' : 'FAK'

    return {
      type: 'lock',
      instrumentID,
      details: [
        { label: '合约', value: instrumentID },
        { label: '模式', value: `${mode} ${tc}` },
      ],
    }
  }, [quickTradeConfig])

  const doReverse = useCallback(async (instrumentID: string) => {
    const config = quickTradeConfig.reverse
    const snap = getSnapshot(instrumentID)
    const priceTick = getPriceTick(instrumentID)

    let closePriceType = '1'
    let closeLimitPrice = 0
    let closeTimeCondition = config.close.timeCondition === 'fak' ? '1' : '3'
    if (config.close.priceMode === 'counterparty') {
      const result = calcCounterpartyPrice('1', snap, config.close.offsetTicks, priceTick)
      if (result.error) {
        toast.error(`平仓价格计算失败：${result.error}`)
        return
      }
      closePriceType = '2'
      closeLimitPrice = result.price
    }

    let openPriceType = '1'
    let openLimitPrice = 0
    let openTimeCondition = config.open.timeCondition === 'fak' ? '1' : '3'
    if (config.open.priceMode === 'counterparty') {
      const result = calcCounterpartyPrice('1', snap, config.open.offsetTicks, priceTick)
      if (result.error) {
        toast.error(`开仓价格计算失败：${result.error}`)
        return
      }
      openPriceType = '2'
      openLimitPrice = result.price
    }

    const result = await reversePosition({
      instrumentID,
      closePriceType,
      closeLimitPrice,
      closeTimeCondition,
      openPriceType,
      openLimitPrice,
      openTimeCondition,
      executionMode: config.executionMode,
    })
    return result
  }, [quickTradeConfig, getSnapshot, getPriceTick])

  const doLock = useCallback(async (instrumentID: string) => {
    const config = quickTradeConfig.lock
    const snap = getSnapshot(instrumentID)
    const priceTick = getPriceTick(instrumentID)

    let priceType = '1'
    let limitPrice = 0
    let timeCondition = config.timeCondition === 'fak' ? '1' : '3'
    if (config.priceMode === 'counterparty') {
      const result = calcCounterpartyPrice('1', snap, config.offsetTicks, priceTick)
      if (result.error) {
        toast.error(`价格计算失败：${result.error}`)
        return
      }
      priceType = '2'
      limitPrice = result.price
    }

    return lockPosition({ instrumentID, priceType, limitPrice, timeCondition })
  }, [quickTradeConfig, getSnapshot, getPriceTick])

  const handleReverse = useCallback(async (instrumentID: string) => {
    if (quickTradeConfig.confirmBeforeExecute) {
      const details = buildReverseDetails(instrumentID)
      if (details) {
        setConfirmState(details)
        return
      }
    }
    return doReverse(instrumentID)
  }, [quickTradeConfig.confirmBeforeExecute, buildReverseDetails, doReverse])

  const handleLock = useCallback(async (instrumentID: string) => {
    if (quickTradeConfig.confirmBeforeExecute) {
      const details = buildLockDetails(instrumentID)
      if (details) {
        setConfirmState(details)
        return
      }
    }
    return doLock(instrumentID)
  }, [quickTradeConfig.confirmBeforeExecute, buildLockDetails, doLock])

  const handleConfirmExecute = useCallback(async () => {
    if (!confirmState) return
    setConfirmState(null)
    try {
      if (confirmState.type === 'reverse') {
        const result = await doReverse(confirmState.instrumentID)
        if (result && typeof result === 'object' && 'success' in result && result.success) {
          toast.success('一键反向已提交')
        }
      } else {
        const result = await doLock(confirmState.instrumentID)
        if (result && typeof result === 'object' && 'success' in result && result.success) {
          toast.success('一键锁仓已提交')
        }
      }
    } catch {
      toast.error('操作失败')
    }
  }, [confirmState, doReverse, doLock])

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

  // ── Hotkeys ──
  useHotKeys({
    enabled: true,
    onBuy: () => setOrderForm({ direction: 'buy' }),
    onSell: () => setOrderForm({ direction: 'sell' }),
    onCancelAll: () => toast.error('请使用查询面板撤单'),
    onReverse: () => {
      if (orderForm.instrumentID) handleReverse(orderForm.instrumentID)
    },
    onLock: () => {
      if (orderForm.instrumentID) handleLock(orderForm.instrumentID)
    },
    onBatchCancel: handleBatchCancel,
    hotKeys,
  })

  return (
    <section className="order-panel">
      {/* 快捷操作按钮 — 与行情面板的 market-tabs 等高 */}
      <QuickActions
        instrumentID={orderForm.instrumentID}
        onReverse={handleReverse}
        onLock={handleLock}
        onBatchCancel={handleBatchCancel}
      />

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

      {confirmState && (
        <ConfirmDialog
          title={confirmState.type === 'reverse' ? '确认执行一键反向？' : '确认执行一键锁仓？'}
          details={confirmState.details}
          warning={confirmState.warning}
          onConfirm={handleConfirmExecute}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </section>
  )
}
