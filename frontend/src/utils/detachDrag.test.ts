import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { detachTabAt, startDetachDrag } from './detachDrag'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

/** jsdom 24 不提供 PointerEvent 构造器；用 MouseEvent 保留 clientX/clientY（brief step-4 回退方案） */
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('utils/detachDrag', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
    })
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('detachTabAt 可关闭标签：登记窗口并切活跃到 market', () => {
    const ok = detachTabAt('tab-settings', { x: 200, y: 150 })
    expect(ok).toBe(true)
    expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeDefined()
  })

  it('detachTabAt 固定标签：返回 false', () => {
    expect(detachTabAt('tab-market', { x: 0, y: 0 })).toBe(false)
  })

  it('detachTabAt 拖离活跃标签后活跃切回 market', () => {
    useTabStore.getState().setActiveTab('tab-settings')
    detachTabAt('tab-settings', { x: 200, y: 150 })
    expect(useTabStore.getState().activeTabId).toBe('tab-market')
  })

  it('startDetachDrag 未超阈值：不脱离、不产生 ghost、不回调', () => {
    const onDetach = vi.fn()
    const onDetaching = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: pointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetaching,
      onDetach,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 14, clientY: 12, bubbles: true })) // 位移 < 6px
    fireEvent(window, pointerEvent('pointerup', { clientX: 14, clientY: 12, bubbles: true }))
    expect(onDetaching).not.toHaveBeenCalled()
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })

  it('startDetachDrag 超阈值：触发 onDetaching、产生 ghost、松手回调并清理', () => {
    const onDetach = vi.fn()
    const onDetaching = vi.fn()
    const source = document.createElement('div')
    source.style.width = '100px'
    source.style.height = '30px'
    document.body.appendChild(source)
    startDetachDrag({
      event: pointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetaching,
      onDetach,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 60, clientY: 80, bubbles: true })) // 位移 > 6px
    expect(onDetaching).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[style*="position: fixed"]')).not.toBeNull()
    fireEvent(window, pointerEvent('pointerup', { clientX: 60, clientY: 80, bubbles: true }))
    expect(onDetach).toHaveBeenCalledWith({ x: 60, y: 80 })
    // ghost 已清理
    expect(document.querySelectorAll('[style*="position: fixed"]')).toHaveLength(0)
    document.body.removeChild(source)
  })

  it('startDetachDrag 拖拽中途 canDetach 变 false：取消', () => {
    const onDetach = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: pointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }),
      sourceEl: source,
      canDetach: () => false,
      onDetach,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }))
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })

  it('startDetachDrag 中途 pointercancel：取消并清理，不回调', () => {
    const onDetach = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: pointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetach,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100, bubbles: true }))
    fireEvent(window, pointerEvent('pointercancel', { bubbles: true }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 100, clientY: 100, bubbles: true }))
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })
})
