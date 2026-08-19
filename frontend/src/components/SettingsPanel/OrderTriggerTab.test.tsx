import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderTriggerTab } from './OrderTriggerTab'
import type { OrderTriggerConfig } from '@/services/types'

const CONFIG: OrderTriggerConfig = { triggerMode: 'single', confirmBeforeOrder: true }

describe('OrderTriggerTab', () => {
  it('renders trigger mode and confirm options with defaults', () => {
    render(<OrderTriggerTab config={CONFIG} onSave={vi.fn()} />)
    expect(screen.getByText('触发方式')).toBeInTheDocument()
    expect(screen.getByText('单次点击触发')).toBeInTheDocument()
    expect(screen.getByText('双击触发')).toBeInTheDocument()
    expect(screen.getByText('下单前弹窗确认')).toBeInTheDocument()
  })

  it('selects single mode by default (checked)', () => {
    render(<OrderTriggerTab config={CONFIG} onSave={vi.fn()} />)
    expect(screen.getByLabelText('单次点击触发')).toBeChecked()
  })

  it('saves updated config when save clicked', () => {
    const onSave = vi.fn()
    render(<OrderTriggerTab config={CONFIG} onSave={onSave} />)
    fireEvent.click(screen.getByLabelText('双击触发'))
    fireEvent.click(screen.getByLabelText('下单前确认'))
    fireEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith({ triggerMode: 'double', confirmBeforeOrder: false })
  })
})
