import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastContainer, toast } from './index'

describe('ToastContainer', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    const { container } = render(<ToastContainer />)
    // Manually clear the internal toasts
    act(() => {
      toast._clearAll()
    })
    container.remove()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />)
    expect(container.querySelector('.toast-item')).toBeNull()
  })

  it('shows success toast after calling toast.success()', () => {
    render(<ToastContainer />)

    act(() => {
      toast.success('报单成功 ORD-001')
    })

    expect(screen.getByText('报单成功 ORD-001')).toBeInTheDocument()
    const item = document.querySelector('.toast-item')
    expect(item).toHaveClass('toast-success')
  })

  it('shows error toast after calling toast.error()', () => {
    render(<ToastContainer />)

    act(() => {
      toast.error('报单失败：参数错误')
    })

    expect(screen.getByText('报单失败：参数错误')).toBeInTheDocument()
    const item = document.querySelector('.toast-item')
    expect(item).toHaveClass('toast-error')
  })

  it('auto-dismisses toast after 3 seconds', () => {
    render(<ToastContainer />)

    act(() => {
      toast.success('test message')
    })

    expect(screen.getByText('test message')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3100)
    })

    expect(screen.queryByText('test message')).not.toBeInTheDocument()
  })

  it('supports multiple toasts simultaneously', () => {
    render(<ToastContainer />)

    act(() => {
      toast.success('订单1 已提交')
      toast.error('订单2 失败')
    })

    expect(screen.getByText('订单1 已提交')).toBeInTheDocument()
    expect(screen.getByText('订单2 失败')).toBeInTheDocument()
  })

  it('auto-dismisses each toast independently', () => {
    render(<ToastContainer />)

    act(() => {
      toast.success('first')
    })

    // Advance 2 seconds, add second toast
    act(() => {
      vi.advanceTimersByTime(2000)
      toast.error('second')
    })

    // After 1.1 more seconds, first toast (at 3.1s) should be gone, second (at 1.1s) remains
    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(screen.queryByText('first')).not.toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })
})
