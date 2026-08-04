import { describe, it, expect, vi } from 'vitest'
import { computeFlipDeltas, flipToRect, getRect, getTabPanelRect, type FlipRect } from './flip'

const A: FlipRect = { left: 100, top: 50, width: 200, height: 150 }
const B: FlipRect = { left: 300, top: 200, width: 400, height: 300 }

describe('utils/flip', () => {
  it('computeFlipDeltas 计算反向位移与缩放', () => {
    const d = computeFlipDeltas(A, B)
    expect(d.dx).toBe(100 - 300)   // -200
    expect(d.dy).toBe(50 - 200)    // -150
    expect(d.sx).toBe(200 / 400)   // 0.5
    expect(d.sy).toBe(150 / 300)   // 0.5
  })

  it('computeFlipDeltas 对零尺寸目标返回 scale 1', () => {
    const d = computeFlipDeltas(A, { left: 0, top: 0, width: 0, height: 0 })
    expect(d.sx).toBe(1)
    expect(d.sy).toBe(1)
  })

  it('flipToRect 先施加反向 transform，再过渡到恒等，结束后清理并回调', () => {
    const el = document.createElement('div')
    const onDone = vi.fn()
    flipToRect(el, A, B, { onDone })
    // 注：真实浏览器会序列化为 translate(0px, 0px)；jsdom CSSOM 保留字面量 translate(0, 0)。
    // 断言对齐 jsdom 实际行为，生产 FLIP 逻辑不变。
    expect(el.style.transform).toBe('translate(0, 0) scale(1, 1)')
    expect(el.style.transition).toContain('transform')
    el.dispatchEvent(new Event('transitionend'))
    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('getRect 正确映射 getBoundingClientRect 字段', () => {
    const el = document.createElement('div')
    const mock = { left: 10, top: 20, width: 100, height: 50, right: 110, bottom: 70, x: 10, y: 20, toJSON: () => ({}) }
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(mock as DOMRect)
    expect(getRect(el)).toEqual({ left: 10, top: 20, width: 100, height: 50 })
  })

  it('getTabPanelRect 按 aria-labelledby 查询面板矩形', () => {
    const panel = document.createElement('div')
    panel.setAttribute('aria-labelledby', 'tab-order-IF2608')
    document.body.appendChild(panel)
    try {
      const r = getTabPanelRect('tab-order-IF2608')
      expect(r).not.toBeNull()
      expect(r).toHaveProperty('left')
    } finally {
      document.body.removeChild(panel)
    }
  })

  it('getTabPanelRect 找不到时返回 null', () => {
    expect(getTabPanelRect('tab-missing')).toBeNull()
  })
})
