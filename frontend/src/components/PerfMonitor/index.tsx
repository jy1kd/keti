import { useEffect, useRef, useCallback, useState } from 'react'

/** FPS 低于此值显示警告色 */
const LOW_FPS_THRESHOLD = 30

interface PerfMonitorProps {
  visible: boolean
}

/**
 * FPS 监控组件（内联显示）
 * visible=true 时返回 FPS 数字，由父组件决定渲染位置。
 * FPS < 30 时返回带红色样式的 span。
 */
export function PerfMonitor({ visible }: PerfMonitorProps) {
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0)

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
      setFps(0)
    }
  }, [visible, tick])

  if (!visible) return null

  const isLow = fps < LOW_FPS_THRESHOLD && fps > 0

  return (
    <span style={{ color: isLow ? '#f85149' : 'inherit' }}>
      {fps}
    </span>
  )
}
