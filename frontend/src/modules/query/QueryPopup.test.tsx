import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryPopup } from './QueryPopup'
import { useQueryPopupStore } from './popupStore'
import { useTabStore } from '@/stores/tabs'

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
