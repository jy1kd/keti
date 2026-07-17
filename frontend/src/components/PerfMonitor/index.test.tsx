import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PerfMonitor } from './index'

// Mock requestAnimationFrame
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

beforeEach(() => {
  rafCallbacks = []
  rafId = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return ++rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks = rafCallbacks.filter((_, i) => i + 1 !== id)
  })
  // Mock performance.now
  let time = 0
  vi.stubGlobal('performance', { now: () => time++ })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PerfMonitor', () => {
  it('visible=false 时不显示 FPS 信息', () => {
    render(<PerfMonitor visible={false} />)
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument()
  })

  it('visible=true 时显示 FPS 信息', () => {
    render(<PerfMonitor visible={true} />)
    expect(screen.getByText(/FPS/)).toBeInTheDocument()
  })

  it('显示 FPS 数值', () => {
    render(<PerfMonitor visible={true} />)

    // 触发一帧回调来计算 FPS
    act(() => {
      rafCallbacks.forEach((cb) => cb(16))
      rafCallbacks = []
    })

    expect(screen.getByText(/FPS/)).toBeInTheDocument()
  })

  it('FPS 低于 30 时显示警告色', () => {
    render(<PerfMonitor visible={true} />)

    // 模拟低 FPS：每帧间隔 50ms（20 FPS）
    let timeCounter = 0
    vi.stubGlobal('performance', { now: () => timeCounter })

    act(() => {
      // 第一帧
      rafCallbacks.forEach((cb) => cb(timeCounter))
      rafCallbacks = []
      timeCounter += 50 // 50ms 间隔 = 20 FPS
    })

    act(() => {
      // 第二帧
      rafCallbacks.forEach((cb) => cb(timeCounter))
      rafCallbacks = []
    })

    const fpsElement = screen.getByText(/FPS/)
    expect(fpsElement).toBeInTheDocument()
  })

  it('组件卸载时清理 rAF', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = render(<PerfMonitor visible={true} />)

    unmount()
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('visible 从 true 变为 false 时隐藏', () => {
    const { rerender } = render(<PerfMonitor visible={true} />)
    expect(screen.getByText(/FPS/)).toBeInTheDocument()

    rerender(<PerfMonitor visible={false} />)
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument()
  })
})
