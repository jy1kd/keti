import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfMonitor } from './index'

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
  vi.stubGlobal('performance', { now: () => 0 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PerfMonitor', () => {
  it('visible=false 时不渲染', () => {
    const { container } = render(<PerfMonitor visible={false} />)
    expect(container.textContent).toBe('')
  })

  it('visible=true 时显示 FPS 数值', () => {
    render(<PerfMonitor visible={true} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('启动 rAF 循环', () => {
    render(<PerfMonitor visible={true} />)
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })

  it('组件卸载时清理 rAF', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = render(<PerfMonitor visible={true} />)
    unmount()
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('visible 变为 false 时停止 rAF', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { rerender } = render(<PerfMonitor visible={true} />)
    expect(rafCallbacks.length).toBeGreaterThan(0)

    rerender(<PerfMonitor visible={false} />)
    expect(cancelSpy).toHaveBeenCalled()
  })
})
