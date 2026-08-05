/** 缩放方向：8 个边/角 + 兼容别名（Task 4 迁移 FloatingWindow 后移除别名） */
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'horizontal' | 'vertical'

/** 真实可用的 8 个方向（FloatingWindow / QueryPopup / OrderPopup 共用） */
export const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export interface ResizeRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ResizeBounds {
  minW?: number
  minH?: number
  /** 视口宽；不传则不做视口上限（最小尺寸仍生效） */
  viewportW?: number
  viewportH?: number
}

export interface ResizeDragParams {
  /** 底层 PointerEvent（React 事件用 e.nativeEvent 传入） */
  event: PointerEvent
  /** 缩放方向 */
  dir: ResizeDirection
  /** 起始矩形（拖动期间锚定，避免累积漂移） */
  rect: ResizeRect
  minW?: number
  minH?: number
  /** 每次移动回调（已钳制） */
  onResize: (r: ResizeRect) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * 纯函数：给定起始矩形与光标增量，计算缩放后的矩形（含最小/视口钳制）。
 * 含 w/n 的方向锚定对侧边缘（右缘/下缘），顶到最小值时窗口不跳。
 */
export function computeResizeRect(
  dir: ResizeDirection,
  rect: ResizeRect,
  dx: number,
  dy: number,
  bounds: ResizeBounds = {},
): ResizeRect {
  const { x: ox, y: oy, w: ow, h: oh } = rect
  const minW = bounds.minW ?? 320
  const minH = bounds.minH ?? 200
  const vw = bounds.viewportW ?? Infinity
  const vh = bounds.viewportH ?? Infinity

  // 'horizontal'/'vertical' 为 Task 4 前的兼容别名，无缩放语义；显式 no-op 防 includes 误命中
  if (dir === 'horizontal' || dir === 'vertical') {
    return { x: ox, y: oy, w: ow, h: oh }
  }

  let x = ox
  let y = oy
  let w = ow
  let h = oh

  if (dir.includes('e')) w = ow + dx
  if (dir.includes('s')) h = oh + dy

  if (dir.includes('w')) {
    const right = ox + ow
    w = clamp(ow - dx, minW, Math.max(minW, right))
    x = right - w
  } else {
    w = clamp(w, minW, Math.max(minW, vw - ox))
  }

  if (dir.includes('n')) {
    const bottom = oy + oh
    h = clamp(oh - dy, minH, Math.max(minH, bottom))
    y = bottom - h
  } else {
    h = clamp(h, minH, Math.max(minH, vh - oy))
  }

  return { x, y, w, h }
}

/** 开始一次缩放手势；返回清理函数（卸载时调用可移除残留监听） */
export function startResizeDrag(p: ResizeDragParams): () => void {
  const bounds: ResizeBounds = {
    minW: p.minW,
    minH: p.minH,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
  }
  const startX = p.event.clientX
  const startY = p.event.clientY

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup()
  }
  const onMove = (ev: PointerEvent) => {
    p.onResize(computeResizeRect(p.dir, p.rect, ev.clientX - startX, ev.clientY - startY, bounds))
  }
  const onUp = () => {
    cleanup()
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cleanup)
    window.removeEventListener('keydown', onKeyDown)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cleanup)
  window.addEventListener('keydown', onKeyDown)
  p.event.preventDefault()

  return cleanup
}
