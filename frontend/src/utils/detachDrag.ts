import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore, defaultFloatingSize } from '@/stores/floatingWindows'

export interface DetachDragParams {
  /** 底层 PointerEvent（React 事件用 e.nativeEvent 传入） */
  event: PointerEvent
  /** 拖拽起点元素（标签或面板），pill ghost 直接克隆它 */
  sourceEl: HTMLElement
  /** 是否允许拖出 */
  canDetach: () => boolean
  /** ghost 类型：'pill' 克隆 sourceEl；'content' 克隆 getContentNode() */
  ghostKind?: 'pill' | 'content'
  /** content ghost 的克隆源（整个面板） */
  getContentNode?: () => HTMLElement | null
  /** 拖拽阈值（px），超过才进入脱离状态 */
  threshold?: number
  /** 进入脱离状态时回调（用于抑制随后的 click） */
  onDetaching?: () => void
  /** 松手时回调（光标 client 坐标） */
  onDetach: (pos: { x: number; y: number }) => void
}

/** 将标签在光标位置脱离为浮动窗口；固定标签返回 false；若拖离的是活跃标签自动切回 market */
export function detachTabAt(tabId: string, pos: { x: number; y: number }): boolean {
  const state = useTabStore.getState()
  const tab = state.tabs.find((t) => t.id === tabId)
  if (!tab || !tab.closable) return false
  const { w, h } = defaultFloatingSize()
  const x = Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w))
  const y = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - 40))
  const ok = useFloatingWindowStore.getState().detach(tabId, { x, y, w, h })
  if (ok && state.activeTabId === tabId) {
    const market = state.tabs.find((t) => t.type === 'market')
    if (market) useTabStore.getState().setActiveTab(market.id)
  }
  return ok
}

/** 开始一次拖拽脱离手势；内部管理 window pointermove/pointerup 与 ghost 生命周期 */
export function startDetachDrag(p: DetachDragParams): void {
  const threshold = p.threshold ?? 6
  const startX = p.event.clientX
  const startY = p.event.clientY
  let detached = false
  let ghost: HTMLElement | null = null

  const removeGhost = () => {
    ghost?.remove()
    ghost = null
  }
  const cleanup = () => {
    removeGhost()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cleanup)
    window.removeEventListener('keydown', onKeyDown)
  }
  // Esc / pointercancel 取消拖拽（spec §9）
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup()
  }
  const createGhost = () => {
    const node = p.ghostKind === 'content' ? (p.getContentNode?.() ?? p.sourceEl) : p.sourceEl
    const clone = node.cloneNode(true) as HTMLElement
    const r = node.getBoundingClientRect()
    clone.style.position = 'fixed'
    clone.style.left = `${r.left}px`
    clone.style.top = `${r.top}px`
    clone.style.width = `${r.width}px`
    clone.style.margin = '0'
    clone.style.pointerEvents = 'none'
    clone.style.zIndex = '2000'
    document.body.appendChild(clone)
    ghost = clone
  }
  const onMove = (ev: PointerEvent) => {
    if (!p.canDetach()) {
      cleanup()
      return
    }
    if (!detached) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return
      detached = true
      p.onDetaching?.()
      createGhost()
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX - ghost.offsetWidth / 2}px`
      ghost.style.top = `${ev.clientY - ghost.offsetHeight / 2}px`
    }
  }
  const onUp = (ev: PointerEvent) => {
    if (detached) p.onDetach({ x: ev.clientX, y: ev.clientY })
    cleanup()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cleanup)
  window.addEventListener('keydown', onKeyDown)
  p.event.preventDefault()
}
