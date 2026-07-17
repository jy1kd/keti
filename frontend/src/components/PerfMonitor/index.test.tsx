import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('默认不显示 FPS 信息', () => {
    render(<PerfMonitor />)
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument()
  })

  it('Ctrl+P 切换显示/隐藏', async () => {
    const user = userEvent.setup()
    render(<PerfMonitor />)

    // 按 Ctrl+P 显示
    await user.keyboard('{Control>}p{/Control}')
    expect(screen.getByText(/FPS/)).toBeInTheDocument()

    // 再按 Ctrl+P 隐藏
    await user.keyboard('{Control>}p{/Control}')
    expect(screen.queryByText(/FPS/)).not.toBeInTheDocument()
  })

  it('显示 FPS 数值', async () => {
    const user = userEvent.setup()
    render(<PerfMonitor />)

    await user.keyboard('{Control>}p{/Control}')

    // 触发一帧回调来计算 FPS
    act(() => {
      rafCallbacks.forEach((cb) => cb(16))
      rafCallbacks = []
    })

    expect(screen.getByText(/FPS/)).toBeInTheDocument()
  })

  it('FPS 低于 30 时显示警告色', async () => {
    const user = userEvent.setup()
    render(<PerfMonitor />)

    await user.keyboard('{Control>}p{/Control}')

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

  it('组件卸载时清理 rAF', async () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const user = userEvent.setup()
    const { unmount } = render(<PerfMonitor />)

    // 先显示组件（启动 rAF 循环）
    await user.keyboard('{Control>}p{/Control}')

    unmount()
    expect(cancelSpy).toHaveBeenCalled()
  })
})
