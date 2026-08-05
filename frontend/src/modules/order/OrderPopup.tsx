import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useOrderPopupStore } from './popupStore'
import { useOrderStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import { getRect, flipToRect, getTabPanelRect } from '@/utils/flip'
import { toast } from '@/components/Toast'
import { OrderQuotePanel } from './OrderQuotePanel'
import { OrderForm } from './OrderForm'
import './OrderPopup.css'

/**
 * OrderPopup — 悬浮报单弹窗（非模态）
 *
 * 浮于行情标签页之上，行情保持可见、可交互。
 * 标题栏可拖拽移动；× / ESC 关闭；双栏：左行情面板，右报单表单。
 */
export function OrderPopup() {
  const instrumentID = useOrderPopupStore((s) => s.instrumentID)
  const closePopup = useOrderPopupStore((s) => s.closePopup)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)
  const snapshots = useMarketStore((s) => s.snapshots)
  const contracts = useContractsStore((s) => s.contracts)
  const addLockedContract = useMarketStore((s) => s.addLockedContract)
  const removeLockedContract = useMarketStore((s) => s.removeLockedContract)

  // 合约切换 → 同步到报单表单（与 OrderPage 模式一致）
  useEffect(() => {
    if (instrumentID) setOrderForm({ instrumentID })
  }, [instrumentID, setOrderForm])

  // 弹窗打开期间锁定该合约的行情订阅：
  // 即使合约不在表格可见区/自选里，也保证有 WS 行情推送（五档盘口有数据）。
  // useSubscriptionManager 会自动订阅锁定合约，弹窗关闭后自动退订。
  useEffect(() => {
    if (!instrumentID) return
    addLockedContract(instrumentID)
    return () => removeLockedContract(instrumentID)
  }, [instrumentID, addLockedContract, removeLockedContract])

  const snapshot = instrumentID ? snapshots.get(instrumentID) ?? null : null
  const contract = instrumentID ? contracts.find((c) => c.instrumentID === instrumentID) : null
  const priceTick = contract?.priceTick ?? 0.2

  // ── 拖拽移动 ──
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    const el = popupRef.current
    if (!el || e.button !== 0) return
    const rect = el.getBoundingClientRect()
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const x = Math.min(Math.max(0, ev.clientX - dragRef.current.dx), window.innerWidth - 40)
      const y = Math.min(Math.max(0, ev.clientY - dragRef.current.dy), window.innerHeight - 40)
      setPosition({ x, y })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ── ESC 关闭 ──
  useEffect(() => {
    if (!instrumentID) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [instrumentID, closePopup])

  // ── 放大为标签页 ──
  const handleMaximize = useCallback(() => {
    if (!instrumentID) return
    const popupEl = popupRef.current
    if (!popupEl) {
      closePopup()
      return
    }
    const from = getRect(popupEl)
    let opened = false
    flushSync(() => {
      opened = useTabStore.getState().openTab({
        type: 'order',
        title: `📝 报单-${instrumentID}`,
        props: { instrumentID },
      })
    })
    if (!opened) {
      toast.error('标签页数量已达上限（15），请先关闭部分标签页')
      return
    }
    const to = getTabPanelRect(`tab-order-${instrumentID}`)
    if (!to) {
      closePopup()
      return
    }
    flipToRect(popupEl, from, to, { direction: 'forward', onDone: () => closePopup() })
  }, [instrumentID, closePopup])

  if (!instrumentID) return null

  const popupStyle: CSSProperties = position
    ? { left: position.x, top: position.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div
      ref={popupRef}
      className="order-popup"
      role="dialog"
      aria-label={`报单 ${instrumentID}`}
      style={popupStyle}
    >
      <div className="order-popup__header" onMouseDown={handleHeaderMouseDown}>
        <span className="order-popup__header-left">
          <span className="order-popup__title">📝 报单-{instrumentID}</span>
          <button
            type="button"
            className="order-popup__max"
            onClick={handleMaximize}
            aria-label="放大为标签页"
            title="放大为标签页"
          >
            ⤢
          </button>
        </span>
        <button
          type="button"
          className="order-popup__close"
          onClick={closePopup}
          aria-label="关闭报单弹窗"
          title="关闭 (Esc)"
        >
          ×
        </button>
      </div>
      <div className="order-popup__body">
        <div className="order-popup__quote">
          <OrderQuotePanel instrumentID={instrumentID} snapshot={snapshot} priceTick={priceTick} />
        </div>
        <div className="order-popup__form">
          <OrderForm priceTick={priceTick} />
        </div>
      </div>
    </div>
  )
}
