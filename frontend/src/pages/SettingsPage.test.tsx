import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from '@/stores/userPrefs'

vi.mock('@/components/SettingsPanel/HotKeyTab', () => ({
  HotKeyTab: ({ hotKeys, onSave }: any) => (
    <div data-testid="hotkey-tab">
      <span>HotKey Tab</span>
      <button onClick={() => onSave({ ...hotKeys, openOrder: 'x' })}>Save HotKeys</button>
    </div>
  ),
}))

vi.mock('@/components/SettingsPanel/OrderTriggerTab', () => ({
  OrderTriggerTab: ({ config, onSave }: any) => (
    <div data-testid="ordertrigger-tab">
      <span>OrderTrigger Tab</span>
      <button onClick={() => onSave({ ...config })}>Save OrderTrigger</button>
    </div>
  ),
}))

vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    useUserPrefsStore.setState({
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
    vi.clearAllMocks()
  })

  it('renders two tabs：快捷键 / 下单触发', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('下单触发')).toBeInTheDocument()
    expect(screen.queryByText('快捷交易')).not.toBeInTheDocument()
  })

  it('shows HotKey tab by default', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('hotkey-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('ordertrigger-tab')).not.toBeInTheDocument()
  })

  it('switches to 下单触发 tab', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByTestId('ordertrigger-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('active tab has active class', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷键')).toHaveClass('active')
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByText('下单触发')).toHaveClass('active')
  })
})
