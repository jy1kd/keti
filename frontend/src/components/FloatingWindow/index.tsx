import { useCallback, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { ResizeHandle } from '@/components/ResizeHandle'
import { startResizeDrag, RESIZE_DIRECTIONS, type ResizeDirection } from '@/utils/resizeDrag'
import './styles.css'

interface FloatingWindowProps {
  tabId: string
}

const MIN_W = 320
const MIN_H = 200

/**
 * 每个方向手柄的 fixed 定位（相对窗口 rect）。
 * position 必须内联 fixed：全局 .resize-handle 默认 position:relative（global.css），
 * 与 .floating-window__resize 同优先级且级联靠后会覆盖它；若手柄退化为 relative，
 * 会作为 .app flex 列的 item 占位，把 .tab-main 挤压成 0 高 → 拖出弹窗后主内容空白。
 */
function handleStyle(rect: { x: number; y: number; w: number; h: number }, dir: ResizeDirection, z: number): CSSProperties {
  const base: CSSProperties = { position: 'fixed', zIndex: z }
  switch (dir) {
    case 'n': return { ...base, left: rect.x, top: rect.y - 3, width: rect.w, height: 6 }
    case 's': return { ...base, left: rect.x, top: rect.y + rect.h - 3, width: rect.w, height: 6 }
    case 'e': return { ...base, left: rect.x + rect.w - 3, top: rect.y, width: 6, height: rect.h }
    case 'w': return { ...base, left: rect.x - 3, top: rect.y, width: 6, height: rect.h }
    case 'ne': return { ...base, left: rect.x + rect.w - 6, top: rect.y - 6, width: 12, height: 12 }
    case 'nw': return { ...base, left: rect.x - 6, top: rect.y - 6, width: 12, height: 12 }
    case 'se': return { ...base, left: rect.x + rect.w - 6, top: rect.y + rect.h - 6, width: 12, height: 12 }
    case 'sw': return { ...base, left: rect.x - 6, top: rect.y + rect.h - 6, width: 12, height: 12 }
    default: {
      const _exhaustive: never = dir
      void _exhaustive
      return {}
    }
  }
}

/**
 * FloatingWindow — 浮动窗口 chrome 壳（不含业务内容）
 *
 * 业务内容由 TabContent 以 position:fixed 位移盖在壳上；壳只画标题条
 * （拖拽移动 / ⇧ 停靠 / × 关闭）与 8 个方向缩放手柄。
 */
function FloatingWindow({ tabId }: FloatingWindowProps) {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === tabId))
  const rect = useFloatingWindowStore((s) => s.windows[tabId])
  const move = useFloatingWindowStore((s) => s.move)
  const resize = useFloatingWindowStore((s) => s.resize)
  const dock = useFloatingWindowStore((s) => s.dock)
  const focus = useFloatingWindowStore((s) => s.focus)
  const closeTab = useTabStore((s) => s.closeTab)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const activeTeardownRef = useRef<(() => void) | null>(null)

  // 卸载时清理任何活跃的拖拽/缩放 window 监听器
  useEffect(() => {
    return () => {
      activeTeardownRef.current?.()
    }
  }, [])

  const handleChromePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      if (!rect) return
      focus(tabId)
      dragStartRef.current = { x: e.clientX, y: e.clientY, ox: rect.x, oy: rect.y }
      const onMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return
        const nx = Math.min(Math.max(0, dragStartRef.current.ox + ev.clientX - dragStartRef.current.x), window.innerWidth - 40)
        const ny = Math.min(Math.max(0, dragStartRef.current.oy + ev.clientY - dragStartRef.current.y), window.innerHeight - 40)
        move(tabId, { x: nx, y: ny })
      }
      const onUp = () => {
        activeTeardownRef.current?.()
      }
      activeTeardownRef.current = () => {
        dragStartRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        activeTeardownRef.current = null
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [tabId, rect, focus, move],
  )

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDirection) => {
      if (e.button !== 0) return
      e.stopPropagation()
      if (!rect) return
      focus(tabId)
      activeTeardownRef.current = startResizeDrag({
        event: e.nativeEvent,
        dir,
        rect,
        minW: MIN_W,
        minH: MIN_H,
        onResize: (r) => resize(tabId, r),
      })
    },
    [tabId, rect, focus, resize],
  )

  if (!tab || !rect) return null

  return (
    <>
      <div
        className="floating-window__chrome"
        style={{ left: rect.x, top: rect.y, width: rect.w, zIndex: rect.z - 1 }}
        data-testid={`floating-window-${tabId}`}
        onPointerDown={handleChromePointerDown}
      >
        <span className="floating-window__title">{tab.title}</span>
        <div className="floating-window__actions">
          <button
            type="button"
            className="floating-window__btn"
            aria-label="停靠到标签栏"
            title="停靠到标签栏"
            onClick={() => dock(tabId)}
          >
            ⇧
          </button>
          <button
            type="button"
            className="floating-window__btn"
            aria-label="关闭标签"
            title="关闭"
            onClick={() => closeTab(tabId)}
          >
            ×
          </button>
        </div>
      </div>
      {/* corners render after edges → DOM sibling order ensures corners paint over edge strips */}
      {RESIZE_DIRECTIONS.map((dir) => (
        <ResizeHandle
          key={dir}
          direction={dir}
          className="floating-window__resize"
          aria-label={`调整窗口大小 ${dir}`}
          style={handleStyle(rect, dir, rect.z + 1)}
          onPointerDown={(e) => handleResizePointerDown(e, dir)}
        />
      ))}
    </>
  )
}

/** 浮动窗口容器：遍历 windows 渲染壳，并清理已关闭标签的残留登记 */
export function FloatingWindows() {
  const windows = useFloatingWindowStore((s) => s.windows)
  const tabs = useTabStore((s) => s.tabs)

  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id))
    const { windows: w, dock } = useFloatingWindowStore.getState()
    Object.keys(w).forEach((id) => {
      if (!ids.has(id)) dock(id)
    })
  }, [tabs])

  const floatingTabIds = Object.keys(windows).filter((id) => tabs.some((t) => t.id === id))
  if (floatingTabIds.length === 0) return null
  return (
    <>
      {floatingTabIds.map((tabId) => (
        <FloatingWindow key={tabId} tabId={tabId} />
      ))}
    </>
  )
}
