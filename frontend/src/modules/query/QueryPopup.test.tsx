import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryPopup } from './QueryPopup'
import { useQueryPopupStore } from './popupStore'

// Mock QueryPanel（QueryPanel 自身行为由 QueryPanel.test.tsx 覆盖）
vi.mock('./QueryPanel', () => ({
  QueryPanel: () => <div data-testid="query-panel">查询面板 Mock</div>,
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
