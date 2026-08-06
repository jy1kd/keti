import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryPopup } from './QueryPopup'
import { useQueryPopupStore } from './popupStore'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

// Mock FLIP 工具：jsdom 无真实布局，同步触发 onDone
vi.mock('@/utils/flip', () => ({
  getRect: () => ({ left: 0, top: 0, width: 880, height: 620 }),
  flipToRect: (_el: HTMLElement, _from: unknown, _to: unknown, opts: { onDone?: () => void } = {}) => {
    opts.onDone?.()
  },
  getTabPanelRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
}))

// Mock QueryPanel（QueryPanel 自身行为由 QueryPanel.test.tsx 覆盖）
vi.mock('./QueryPanel', () => ({
  QueryPanel: () => <div data-testid="query-panel">查询面板 Mock</div>,
}))

// Mock toast，使上限路径可断言 toast.error
const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}))

vi.mock('@/components/Toast', () => ({
  toast: { error: toastErrorMock },
}))

describe('QueryPopup', () => {
  beforeEach(() => {
    useQueryPopupStore.setState({ isOpen: false })
  })

  it('isOpen 为 false 时不应渲染', () => {
    render(<QueryPopup />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('isOpen 为 true 时应渲染标题和 QueryPanel', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('📋 查询')).toBeInTheDocument()
    expect(screen.getByTestId('query-panel')).toBeInTheDocument()
  })

  it('点击 × 按钮应关闭弹窗', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent.click(screen.getByLabelText('关闭查询弹窗'))
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })

  it('按 ESC 应关闭弹窗', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })

  it('打开弹窗即置顶（bringToFront query 写入统一 z）', () => {
    useFloatingWindowStore.setState({ popupZ: {}, windows: {} })
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    expect(useFloatingWindowStore.getState().popupZ['query']).toBeGreaterThanOrEqual(1401)
  })

  it('点击弹窗内容触发置顶（捕获阶段，子元素 stopPropagation 也生效）', () => {
    useFloatingWindowStore.setState({ popupZ: {}, windows: {} })
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    const before = useFloatingWindowStore.getState().popupZ['query']!
    const dialog = screen.getByRole('dialog')
    const child = document.createElement('div')
    child.addEventListener('pointerdown', (e) => e.stopPropagation())
    dialog.appendChild(child)
    fireEvent(child, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
    const after = useFloatingWindowStore.getState().popupZ['query']!
    expect(after).toBeGreaterThan(before)
  })
})

describe('⤢ 放大为标签页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
  })

  it('应渲染放大按钮', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    expect(screen.getByLabelText('放大为标签页')).toBeInTheDocument()
  })

  it('点击放大应打开 query 标签并关闭弹窗', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    const { tabs, activeTabId } = useTabStore.getState()
    expect(tabs.some((t) => t.type === 'query')).toBe(true)
    expect(activeTabId).toBe('tab-query')
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })

  it('标签页达上限时 toast 提示且弹窗保持', () => {
    const { openTab } = useTabStore.getState()
    // 占满 15 个（query 无 instrumentID 后缀会去重，故用 order 合约填充唯一 id）
    for (let i = 0; i < 14; i++) {
      openTab({ type: 'order', title: `合约${i}`, props: { instrumentID: `c${i}` } })
    }
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    expect(useQueryPopupStore.getState().isOpen).toBe(true) // 弹窗保持
    expect(toastErrorMock).toHaveBeenCalledWith('标签页数量已达上限（15），请先关闭部分标签页')
  })
})

function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('缩放调整大小', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 无真实布局：物化 getBoundingClientRect 为 880×620 居中矩形
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 72, top: 74, width: 880, height: 620,
      right: 952, bottom: 694,
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染 8 个方向缩放手柄', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByLabelText(`调整弹窗大小 ${dir}`)).toBeInTheDocument()
    })
  })

  it('拖 e 手柄：更新宽度并物化位置', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 952, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 1000, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 1000, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('928px')
    expect(dialog.style.left).toBe('72px') // 居中态已物化为绝对定位
  })

  it('拖 w 手柄：左缘跟随、右缘锚定（x 与宽同时变）', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 w'), pointerEvent('pointerdown', { clientX: 72, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 40, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 40, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.left).toBe('40px')
    expect(dialog.style.width).toBe('912px')
  })

  it('缩到小于最小宽度时钳制到 480', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 952, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('480px')
  })

  it('重开回到默认尺寸与居中位置', async () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    // 放大（拖 e 手柄）
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 952, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 1000, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 1000, clientY: 300 }))
    // 关闭 → 等待 effect 重置 position/size → 再打开
    await act(() => {
      useQueryPopupStore.setState({ isOpen: false })
    })
    await act(() => {
      useQueryPopupStore.setState({ isOpen: true })
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('')     // 无内联宽度 → 回到默认 CSS 尺寸
    expect(dialog.style.left).toBe('50%')   // 回到默认居中（position=null 时走 transform 居中）
  })
})
