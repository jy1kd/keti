import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useOrderPopupStore } from './popupStore'
import { useOrderStore } from './store'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
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

  // 合约切换 → 同步到报单表单（与 OrderPage 模式一致）
  useEffect(() => {
    if (instrumentID) setOrderForm({ instrumentID })
  }, [instrumentID, setOrderForm])

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
        <span className="order-popup__title">📝 报单-{instrumentID}</span>
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
