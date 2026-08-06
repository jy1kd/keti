import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './index'

describe('ConfirmDialog', () => {
  it('渲染标题、明细与操作按钮', () => {
    render(
      <ConfirmDialog
        title="确认报单"
        details={[
          { label: '方向', value: '买入' },
          { label: '价格', value: '4696.0' },
        ]}
        warning="锁仓会真实下单"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText('确认报单')).toBeInTheDocument()
    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('4696.0')).toBeInTheDocument()
    expect(screen.getByText('锁仓会真实下单')).toBeInTheDocument()
  })

  it('按 Esc 触发 onCancel（而非被外层全局监听当作关闭操作）', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="确认" details={[]} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('「取消」按钮触发 onCancel，遮罩点击也触发 onCancel', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { container } = render(
      <ConfirmDialog title="确认" details={[]} onConfirm={onConfirm} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByText('取消'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(container.querySelector('.confirm-overlay')!)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('「确认执行」触发 onConfirm', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="确认" details={[]} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('确认执行'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
