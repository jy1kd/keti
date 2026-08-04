import { describe, it, expect, beforeEach } from 'vitest'
import { useFloatingWindowStore, FLOATING_CHROME_H, defaultFloatingSize } from './floatingWindows'
import { useTabStore } from './tabs'

describe('useFloatingWindowStore', () => {
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

  it('FLOATING_CHROME_H 应为 32', () => {
    expect(FLOATING_CHROME_H).toBe(32)
  })

  it('detach 可关闭标签：登记窗口并分配 z', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    expect(ok).toBe(true)
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w).toEqual({ x: 10, y: 20, w: 400, h: 300, z: 1401 })
  })

  it('detach 固定标签（market）：拒绝返回 false', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-market', { x: 0, y: 0, w: 400, h: 300 })
    expect(ok).toBe(false)
    expect(useFloatingWindowStore.getState().windows['tab-market']).toBeUndefined()
  })

  it('detach 不存在的标签：返回 false', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-nope', { x: 0, y: 0, w: 400, h: 300 })
    expect(ok).toBe(false)
  })

  it('dock 移除窗口登记', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().dock('tab-settings')
    expect(useFloatingWindowStore.getState().windows).toEqual({})
  })

  it('move 更新坐标', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().move('tab-settings', { x: 50, y: 60 })
    expect(useFloatingWindowStore.getState().windows['tab-settings'].x).toBe(50)
    expect(useFloatingWindowStore.getState().windows['tab-settings'].y).toBe(60)
  })

  it('resize 更新宽高', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().resize('tab-settings', { w: 600, h: 400 })
    expect(useFloatingWindowStore.getState().windows['tab-settings'].w).toBe(600)
    expect(useFloatingWindowStore.getState().windows['tab-settings'].h).toBe(400)
  })

  it('focus 递增 z', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    const before = useFloatingWindowStore.getState().windows['tab-settings'].z
    useFloatingWindowStore.getState().focus('tab-settings')
    const after = useFloatingWindowStore.getState().windows['tab-settings'].z
    expect(after).toBe(before + 1)
  })

  it('defaultFloatingSize 返回钳制到视口的尺寸', () => {
    const s = defaultFloatingSize()
    expect(s.w).toBeGreaterThan(0)
    expect(s.h).toBeGreaterThan(0)
  })
})
