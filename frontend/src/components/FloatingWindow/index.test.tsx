import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingWindows } from './index'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useTabStore } from '@/stores/tabs'

// Mock 面板内容：浮动面板由 TabContent 渲染，此处只测 chrome 壳
vi.mock('@/components/ResizeHandle', () => ({
  ResizeHandle: ({ onPointerDown, 'aria-label': label }: { onPointerDown?: (e: React.PointerEvent) => void; 'aria-label'?: string }) => (
    <div data-testid="resize-handle" aria-label={label} onPointerDown={onPointerDown} />
  ),
}))

/** jsdom 24 不提供 PointerEvent 构造器；用 MouseEvent 保留 clientX/clientY/button（与 utils/detachDrag.test.ts 同款回退） */
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

  it('点击 ⇩ 停靠按钮应移除窗口登记', () => {
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

  it('拖右下角缩放柄应 resize 窗口', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle'), pointerEvent('pointerdown', { clientX: 400, clientY: 320, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 400 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.w).toBe(500)
    expect(w.h).toBe(380)
  })
})
