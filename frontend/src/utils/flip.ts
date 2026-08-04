export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

/** 计算元素当前视口矩形 */
export function getRect(el: HTMLElement): FlipRect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** FLIP 反向变换参数：目标尺寸为 0 时 scale 取 1，避免除零 */
export function computeFlipDeltas(from: FlipRect, to: FlipRect) {
  return {
    dx: from.left - to.left,
    dy: from.top - to.top,
    sx: to.width > 0 ? from.width / to.width : 1,
    sy: to.height > 0 ? from.height / to.height : 1,
  }
}

/**
 * 对元素执行 FLIP 动画：元素已处于 to 位置，先施加 from→to 的反向 transform，
 * 强制 reflow 后过渡到恒等变换，动画结束清除内联样式并回调 onDone。
 */
export function flipToRect(
  el: HTMLElement,
  from: FlipRect,
  to: FlipRect,
  opts: { duration?: number; onDone?: () => void } = {},
): void {
  const { dx, dy, sx, sy } = computeFlipDeltas(from, to)
  el.style.transition = 'none'
  el.style.transformOrigin = '0 0'
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  void el.offsetWidth // 强制 reflow
  el.style.transition = `transform ${opts.duration ?? 220}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
  el.style.transform = 'translate(0, 0) scale(1, 1)'
  el.addEventListener(
    'transitionend',
    () => {
      el.style.transition = ''
      el.style.transformOrigin = ''
      el.style.transform = ''
      opts.onDone?.()
    },
    { once: true },
  )
}

/** 按 aria-labelledby 查找标签面板并返回其矩形；未渲染时返回 null */
export function getTabPanelRect(tabId: string): FlipRect | null {
  const panel = document.querySelector<HTMLElement>(`[aria-labelledby="${tabId}"]`)
  return panel ? getRect(panel) : null
}
