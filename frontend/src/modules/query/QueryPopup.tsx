import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useQueryPopupStore } from './popupStore'
import { useTabStore } from '@/stores/tabs'
import { getRect, flipToRect, getTabPanelRect } from '@/utils/flip'
import { toast } from '@/components/Toast'
import { QueryPanel } from './QueryPanel'
import './QueryPopup.css'

/**
 * QueryPopup — 悬浮查询弹窗（非模态）
 *
 * 浮于标签页之上，行情保持可见、可交互。
 * 标题栏可拖拽移动；× / ESC 关闭；主体为查询面板（QueryPanel）。
 */
export function QueryPopup() {
  const isOpen = useQueryPopupStore((s) => s.isOpen)
  const close = useQueryPopupStore((s) => s.close)

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
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  // ── 放大为标签页 ──
  const handleMaximize = useCallback(() => {
    const popupEl = popupRef.current
    if (!popupEl) {
      close()
      return
    }
    const from = getRect(popupEl)
    let opened = false
    flushSync(() => {
      opened = useTabStore.getState().openTab({ type: 'query', title: '📋 查询' })
    })
    if (!opened) {
      toast.error('标签页数量已达上限（15），请先关闭部分标签页')
      return
    }
    const to = getTabPanelRect('tab-query')
    if (!to) {
      close()
      return
    }
    flipToRect(popupEl, from, to, { onDone: () => close() })
  }, [close])

  if (!isOpen) return null

  const popupStyle: CSSProperties = position
    ? { left: position.x, top: position.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div
      ref={popupRef}
      className="query-popup"
      role="dialog"
      aria-label="查询"
      style={popupStyle}
    >
      <div className="query-popup__header" onMouseDown={handleHeaderMouseDown}>
        <span className="query-popup__header-left">
          <span className="query-popup__title">📋 查询</span>
          <button
            type="button"
            className="query-popup__max"
            onClick={handleMaximize}
            aria-label="放大为标签页"
            title="放大为标签页"
          >
            ⤢
          </button>
        </span>
        <button
          type="button"
          className="query-popup__close"
          onClick={close}
          aria-label="关闭查询弹窗"
          title="关闭 (Esc)"
        >
          ×
        </button>
      </div>
      <div className="query-popup__body">
        <QueryPanel />
      </div>
    </div>
  )
}
