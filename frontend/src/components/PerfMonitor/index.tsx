import { useState, useEffect, useRef, useCallback } from 'react'

/** FPS 低于此值显示警告色 */
const LOW_FPS_THRESHOLD = 30

/**
 * 性能监控组件
 * Ctrl+P 切换显示/隐藏，实时显示 FPS。
 */
export function PerfMonitor() {
  const [visible, setVisible] = useState(false)
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const rafRef = useRef(0)

  // Ctrl+P 切换
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // FPS 计算循环
  const tick = useCallback(() => {
    frameCountRef.current++
    const now = performance.now()
    const elapsed = now - lastTimeRef.current

    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed))
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
