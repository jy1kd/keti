import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu } from './index'

describe('ContextMenu', () => {
  const mockOnClose = vi.fn()
  const mockOnClick = vi.fn()

  const defaultItems = [
    { label: '打开报单', icon: '📝', onClick: mockOnClick },
    { label: '打开K线', icon: '📈', onClick: mockOnClick },
    { label: '收藏', icon: '⭐', onClick: mockOnClick },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders at specified position', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />)
    const menu = document.querySelector('.context-menu')
    expect(menu).toBeTruthy()
    expect(menu).toHaveStyle({ left: '100px', top: '200px' })
  })

  it('renders all menu items', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />)
    expect(screen.getByText('打开报单')).toBeInTheDocument()
    expect(screen.getByText('打开K线')).toBeInTheDocument()
    expect(screen.getByText('收藏')).toBeInTheDocument()
  })

  it('renders icons when provided', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />)
    expect(screen.getByText('📝')).toBeInTheDocument()
    expect(screen.getByText('📈')).toBeInTheDocument()
    expect(screen.getByText('⭐')).toBeInTheDocument()
  })

  it('calls onClick and onClose when item is clicked', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('打开报单'))
    expect(mockOnClick).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not call onClick when disabled item is clicked', () => {
    const disabledItems = [
      { label: '打开报单', icon: '📝', onClick: mockOnClick, disabled: true },
    ]
    render(<ContextMenu x={100} y={200} items={disabledItems} onClose={mockOnClose} />)
    fireEvent.click(screen.getByText('打开报单'))
    expect(mockOnClick).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })
})
