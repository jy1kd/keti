import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingWindows } from './index'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useTabStore } from '@/stores/tabs'

// Mock 面板内容：浮动面板由 TabContent 渲染，此处只测 chrome 壳
// ResizeHandle 按 direction 渲染可定位的测试柄；style 需透传，供断言 position:fixed
vi.mock('@/components/ResizeHandle', () => ({
  ResizeHandle: ({
    direction,
    onPointerDown,
    'aria-label': label,
    style,
  }: {
    direction: string
    onPointerDown?: (e: React.PointerEvent) => void
    'aria-label'?: string
    style?: React.CSSProperties
  }) => <div data-testid={`resize-handle-${direction}`} aria-label={label} onPointerDown={onPointerDown} style={style} />,
}))

/** jsdom 24 不提供 PointerEvent 构造器；用 MouseEvent 保留 clientX/clientY/button */
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

const tabs = [
  { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
  { id: 'tab-settings', type: 'settings' as const, title: '⚙ 设置', props: {}, closable: true },
]

describe('FloatingWindows', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs, activeTabId: 'tab-market' })
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('无浮动窗口时不渲染', () => {
    const { container } = render(<FloatingWindows />)
    expect(container.firstChild).toBeNull()
  })

  it('为浮动标签渲染 chrome 壳（标题 + 操作按钮）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    expect(screen.getByText('⚙ 设置')).toBeInTheDocument()
    expect(screen.getByLabelText('停靠到标签栏')).toBeInTheDocument()
    expect(screen.getByLabelText('关闭标签')).toBeInTheDocument()
  })

  it('点击 ⇧ 停靠按钮应移除窗口登记', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.click(screen.getByLabelText('停靠到标签栏'))
    expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeUndefined()
  })

  it('点击 × 关闭按钮应 closeTab', () => {
    const closeTab = vi.fn()
    useTabStore.setState({ tabs, activeTabId: 'tab-market', closeTab })
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.click(screen.getByLabelText('关闭标签'))
    expect(closeTab).toHaveBeenCalledWith('tab-settings')
  })

  it('拖标题条应 move 窗口', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByText('⚙ 设置'), pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 160, clientY: 130 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 160, clientY: 130 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(70)
    expect(w.y).toBe(50)
  })

  it('渲染 8 个方向缩放手柄', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByTestId(`resize-handle-${dir}`)).toBeInTheDocument()
    })
  })

  it('缩放手柄应 position:fixed（脱离 .app 布局，不压扁主内容区）', () => {
    // 回归：.resize-handle（global.css）默认 position:relative，若手柄未内联 fixed，
    // 会作为 .app flex 列的 item 占位，把 .tab-main 挤压成 0 高 → 拖出弹窗后主内容空白。
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByTestId(`resize-handle-${dir}`)).toHaveStyle({ position: 'fixed' })
    })
  })

  it('拖 se 角应同时改 w/h', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-se'), pointerEvent('pointerdown', { clientX: 400, clientY: 320, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 400 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.w).toBe(500)
    expect(w.h).toBe(380)
  })

  it('拖 w 边应同时改 x 与 w（右缘锚定）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 100, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-w'), pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 60, clientY: 100 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 60, clientY: 100 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(60)
    expect(w.w).toBe(440)
  })

  it('拖 n 边应同时改 y 与 h（下缘锚定）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 100, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-n'), pointerEvent('pointerdown', { clientX: 200, clientY: 20, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: -10 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 200, clientY: -10 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.y).toBe(0)
    expect(w.h).toBe(320)
  })

  it('拖 e 边只改 w，不移动 x', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-e'), pointerEvent('pointerdown', { clientX: 410, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 460, clientY: 100 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 460, clientY: 100 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(10)
    expect(w.w).toBe(450)
  })
})
