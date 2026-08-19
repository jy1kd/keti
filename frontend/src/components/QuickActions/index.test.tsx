import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickActions } from './index'

describe('QuickActions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function renderQA(props: { instrumentID?: string; onBatchCancel?: () => void } = {}) {
    const onBatchCancel = props.onBatchCancel ?? vi.fn()
    render(<QuickActions instrumentID={props.instrumentID ?? 'IF2608'} onBatchCancel={onBatchCancel} />)
    return { onBatchCancel }
  }

  it('renders single 批量撤单 button', () => {
    renderQA()
    expect(screen.getByText('批量撤单')).toBeInTheDocument()
  })

  it('disabled without instrumentID', () => {
    renderQA({ instrumentID: '' })
    expect(screen.getByText('批量撤单').closest('button')).toBeDisabled()
  })

  it('calls onBatchCancel on click when enabled', () => {
    const { onBatchCancel } = renderQA()
    fireEvent.click(screen.getByText('批量撤单'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onBatchCancel when disabled', () => {
    const { onBatchCancel } = renderQA({ instrumentID: '' })
    fireEvent.click(screen.getByText('批量撤单'))
    expect(onBatchCancel).not.toHaveBeenCalled()
  })
})
