import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickActions } from './index'
import { toast } from '../Toast'

// Mock toast
vi.mock('../Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('QuickActions', () => {
  let onReverse: ReturnType<typeof vi.fn>
  let onLock: ReturnType<typeof vi.fn>
  let onBatchCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onReverse = vi.fn().mockResolvedValue(true)
    onLock = vi.fn().mockResolvedValue(true)
    onBatchCancel = vi.fn()
  })

  it('renders three action buttons', () => {
    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    expect(screen.getByText('一键反向')).toBeDefined()
    expect(screen.getByText('一键锁仓')).toBeDefined()
    expect(screen.getByText('批量撤单')).toBeDefined()
  })

  it('disables buttons when no instrumentID', () => {
    render(
      <QuickActions
        instrumentID=""
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const buttons = screen.getAllByRole('button')
    // All buttons should be disabled
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('shows toast success on reverse success', async () => {
    onReverse.mockResolvedValue({ success: true, message: 'Position reversed' })

    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const reverseBtn = screen.getByText('一键反向').closest('button')!
    fireEvent.click(reverseBtn)

    await waitFor(() => {
      expect(onReverse).toHaveBeenCalledWith('IF2608')
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('shows toast error on reverse failure', async () => {
    onReverse.mockRejectedValue(new Error('Not implemented'))

    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const reverseBtn = screen.getByText('一键反向').closest('button')!
    fireEvent.click(reverseBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  it('calls onLock with instrumentID', async () => {
    onLock.mockResolvedValue({ success: true, message: 'Position locked' })

    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const lockBtn = screen.getByText('一键锁仓').closest('button')!
    fireEvent.click(lockBtn)

    await waitFor(() => {
      expect(onLock).toHaveBeenCalledWith('IF2608')
    })
  })

  it('calls onBatchCancel when batch cancel button clicked', () => {
    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const batchBtn = screen.getByText('批量撤单').closest('button')!
    fireEvent.click(batchBtn)

    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('disables buttons during loading', async () => {
    onReverse.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)))

    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const reverseBtn = screen.getByText('一键反向').closest('button')!
    fireEvent.click(reverseBtn)

    // Button should show loading state
    expect((reverseBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('handles 501 not implemented gracefully', async () => {
    const err = Object.assign(new Error('Request failed with status code 501'), {
      response: { status: 501, data: { detail: 'Not implemented' } },
    })
    onReverse.mockRejectedValue(err)

    render(
      <QuickActions
        instrumentID="IF2608"
        onReverse={onReverse}
        onLock={onLock}
        onBatchCancel={onBatchCancel}
      />
    )

    const reverseBtn = screen.getByText('一键反向').closest('button')!
    fireEvent.click(reverseBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('501'))
    })
  })
})
