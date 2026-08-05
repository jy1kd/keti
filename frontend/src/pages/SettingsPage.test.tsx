import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { useUserPrefsStore } from '@/stores/userPrefs'

// Mock SettingsPanel components
vi.mock('@/components/SettingsPanel/HotKeyTab', () => ({
  HotKeyTab: ({ hotKeys, onSave }: any) => (
    <div data-testid="hotkey-tab">
      <span>HotKey Tab</span>
      <button onClick={() => onSave({ ...hotKeys, buy: 'x' })}>Save HotKeys</button>
    </div>
  ),
}))

vi.mock('@/components/SettingsPanel/QuickTradeTab', () => ({
  QuickTradeTab: ({ config, onSave }: any) => (
    <div data-testid="quicktrade-tab">
      <span>QuickTrade Tab</span>
      <button onClick={() => onSave({ ...config })}>Save QuickTrade</button>
    </div>
  ),
}))

// Mock Toast
vi.mock('@/components/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    useUserPrefsStore.setState({
      hotKeys: { buy: 'b', sell: 's', cancel: 'c', reverse: '', lock: '', batchCancel: 'Escape', openOrder: '', openKline: '', openSettings: '' },
      quickTradeConfig: {
        lock: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' },
        reverse: {
          close: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' },
          open: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' },
          executionMode: 'serial',
        },
        confirmBeforeExecute: true,
      },
    })
    vi.clearAllMocks()
  })

  it('renders settings page title', () => {
    render(<SettingsPage />)
    expect(screen.getByText('⚙ 设置')).toBeInTheDocument()
  })

  it('renders tab buttons', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('快捷交易')).toBeInTheDocument()
  })

  it('shows QuickTrade tab by default', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('quicktrade-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('switches to HotKey tab when clicked', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByText('快捷键'))
    expect(screen.getByTestId('hotkey-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('quicktrade-tab')).not.toBeInTheDocument()
  })

  it('switches back to QuickTrade tab when clicked', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByText('快捷键'))
    fireEvent.click(screen.getByText('快捷交易'))
    expect(screen.getByTestId('quicktrade-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('active tab has active class', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷交易')).toHaveClass('active')
    expect(screen.getByText('快捷键')).not.toHaveClass('active')
  })
})
