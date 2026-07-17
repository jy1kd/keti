import { useEffect, useRef, useCallback, useReducer } from 'react'

/** FPS 低于此值显示警告色 */
const LOW_FPS_THRESHOLD = 30

interface PerfMonitorProps {
  visible: boolean
}

/**
 * 性能监控组件
 * 显示实时 FPS，FPS < 30 时红色警告。
 * 由父组件通过 visible prop 控制显示/隐藏。
 */
export function PerfMonitor({ visible }: PerfMonitorProps) {
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const rafRef = useRef(0)
  const fpsRef = useRef(0)

  // 使用 ref + forceUpdate 减少不必要的渲染
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  // FPS 计算循环
  const tick = useCallback(() => {
    frameCountRef.current++
    const now = performance.now()
    const elapsed = now - lastTimeRef.current

    if (elapsed >= 1000) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed)
      forceUpdate()
      frameCountRef.current = 0
      lastTimeRef.current = now
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (visible) {
      lastTimeRef.current = performance.now()
      frameCountRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [visible, tick])

  if (!visible) return null

  const fps = fpsRef.current
  const isLow = fps < LOW_FPS_THRESHOLD && fps > 0

  return (
    <div
      data-testid="perf-monitor"
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        padding: '4px 10px',
        background: 'rgba(0,0,0,0.75)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: isLow ? '#f85149' : '#3fb950',
        zIndex: 9999,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {fps} FPS
    </div>
  )
}
