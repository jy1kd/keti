import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from './index'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from '../../stores/userPrefs'

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('./HotKeyTab', () => ({
  HotKeyTab: () => <div data-testid="hotkey-tab">HotKey Tab</div>,
}))

vi.mock('./OrderTriggerTab', () => ({
  OrderTriggerTab: () => <div data-testid="ordertrigger-tab">OrderTrigger Tab</div>,
}))

describe('SettingsPanel', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onClose = vi.fn()
    useUserPrefsStore.setState({
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
  })

  it('renders two tabs：快捷键 / 下单触发', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('下单触发')).toBeInTheDocument()
    expect(screen.queryByText('快捷交易')).not.toBeInTheDocument()
  })

  it('shows HotKey tab by default', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByTestId('hotkey-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('ordertrigger-tab')).not.toBeInTheDocument()
  })

  it('switches to 下单触发 tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByTestId('ordertrigger-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
