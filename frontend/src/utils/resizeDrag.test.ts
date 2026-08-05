import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { computeResizeRect, startResizeDrag } from './resizeDrag'

const RECT = { x: 100, y: 50, w: 400, h: 300 }
const BOUNDS = { minW: 320, minH: 200, viewportW: 1024, viewportH: 768 }

function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('computeResizeRect', () => {
  it('e: 只改宽度', () => {
    expect(computeResizeRect('e', RECT, 50, 0, BOUNDS)).toEqual({ x: 100, y: 50, w: 450, h: 300 })
  })

  it('s: 只改高度', () => {
    expect(computeResizeRect('s', RECT, 0, 60, BOUNDS)).toEqual({ x: 100, y: 50, w: 400, h: 360 })
  })

  it('se: 同时改宽高', () => {
    expect(computeResizeRect('se', RECT, 50, 60, BOUNDS)).toEqual({ x: 100, y: 50, w: 450, h: 360 })
  })

  it('w: 左缘跟随光标，右缘锚定', () => {
    expect(computeResizeRect('w', RECT, 30, 0, BOUNDS)).toEqual({ x: 130, y: 50, w: 370, h: 300 })
  })

  it('w: 顶到 minW 时右缘锚定，x 不再右移', () => {
    const r = computeResizeRect('w', RECT, 200, 0, BOUNDS)
    expect(r.w).toBe(320)
    expect(r.x).toBe(180)
  })

  it('n: 上缘跟随光标，下缘锚定', () => {
    expect(computeResizeRect('n', RECT, 0, 40, BOUNDS)).toEqual({ x: 100, y: 90, w: 400, h: 260 })
  })

  it('nw: 左/上同时调整，锚定右下', () => {
    expect(computeResizeRect('nw', RECT, 30, 40, BOUNDS)).toEqual({ x: 130, y: 90, w: 370, h: 260 })
  })

  it('e: 宽度不超过视口右沿', () => {
    const r = computeResizeRect('e', { x: 700, y: 50, w: 100, h: 300 }, 500, 0, BOUNDS)
    expect(r.w).toBe(324) // 1024 - 700
  })

  it('w: 左缘不越出视口（x ≥ 0）', () => {
    const r = computeResizeRect('w', { x: 100, y: 50, w: 400, h: 300 }, -500, 0, BOUNDS)
    expect(r.x).toBe(0)
    expect(r.w).toBe(500)
  })

  it('未传视口时退化为不限制上限', () => {
    const r = computeResizeRect('e', RECT, 5000, 0)
    expect(r.w).toBe(5400)
  })
})

describe('startResizeDrag', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pointermove 按方向回调 onResize，pointerup 后清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'se',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 150, clientY: 110 }))
    expect(onResize).toHaveBeenLastCalledWith({ x: 100, y: 50, w: 450, h: 360 })

    fireEvent(window, pointerEvent('pointerup', { clientX: 150, clientY: 110 }))
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 200 }))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('Esc 取消并清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'e',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 150, clientY: 50 }))
    expect(onResize).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 50 }))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('pointercancel 取消并清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'e',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointercancel', { clientX: 100, clientY: 50 }))
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 50 }))
    expect(onResize).not.toHaveBeenCalled()
  })
})
