import { useCallback, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { ResizeHandle } from '@/components/ResizeHandle'
import { startResizeDrag, RESIZE_DIRECTIONS, type ResizeDirection } from '@/utils/resizeDrag'

/** 弹窗内部手柄的绝对定位（贴内沿，overflow:hidden 不出界） */
export function innerResizeHandleStyle(dir: ResizeDirection): CSSProperties {
  switch (dir) {
    case 'n': return { top: 0, left: 0, right: 0, height: 6 }
    case 's': return { bottom: 0, left: 0, right: 0, height: 6 }
    case 'e': return { right: 0, top: 0, bottom: 0, width: 6 }
    case 'w': return { left: 0, top: 0, bottom: 0, width: 6 }
    case 'nw': return { left: 0, top: 0, width: 12, height: 12 }
    case 'ne': return { right: 0, top: 0, width: 12, height: 12 }
    case 'sw': return { left: 0, bottom: 0, width: 12, height: 12 }
    case 'se': return { right: 0, bottom: 0, width: 12, height: 12 }
    default: return {}
  }
}

/** 弹窗 8 方向缩放手柄组（放入各弹窗自己的 handles 覆盖层） */
export function PopupResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent, dir: ResizeDirection) => void
}) {
  return (
    <>
      {RESIZE_DIRECTIONS.map((dir) => (
        <ResizeHandle
          key={dir}
          direction={dir}
          aria-label={`调整弹窗大小 ${dir}`}
          style={innerResizeHandleStyle(dir)}
          onPointerDown={(e) => onPointerDown(e, dir)}
        />
      ))}
    </>
  )
}

export interface UsePopupResizeOptions {
  popupRef: RefObject<HTMLDivElement | null>
  minW: number
  minH: number
}

/**
 * 弹窗自由缩放：管理 position/size 局部 state，物化居中态为绝对定位，
 * 并接入 8 方向缩放手势（QueryPopup / OrderPopup 共用）。
 */
export function usePopupResize({ popupRef, minW, minH }: UsePopupResizeOptions): {
  position: { x: number; y: number } | null
  setPosition: (p: { x: number; y: number } | null) => void
  size: { w: number; h: number } | null
  handleResizePointerDown: (e: React.PointerEvent, dir: ResizeDirection) => void
} {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDirection) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const el = popupRef.current
      if (!el) return
      // 物化当前实际矩形：居中态（transform）不提供真实 left/top，先转绝对定位避免跳动
      const r = el.getBoundingClientRect()
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height }
      setPosition({ x: r.left, y: r.top })
      setSize({ w: r.width, h: r.height })
      startResizeDrag({
        event: e.nativeEvent,
        dir,
        rect,
        minW,
        minH,
        onResize: (next) => {
          setPosition({ x: next.x, y: next.y })
          setSize({ w: next.w, h: next.h })
        },
      })
    },
    [popupRef, minW, minH],
  )

  return { position, setPosition, size, handleResizePointerDown }
}
