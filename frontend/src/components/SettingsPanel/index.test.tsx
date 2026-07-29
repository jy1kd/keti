import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from './index'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_QUICK_TRADE_CONFIG } from '../../stores/userPrefs'

// Mock Toast
vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('SettingsPanel', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onClose = vi.fn()
    // Reset store
    useUserPrefsStore.setState({
      hotKeys: { ...DEFAULT_HOT_KEYS },
      quickTradeConfig: JSON.parse(JSON.stringify(DEFAULT_QUICK_TRADE_CONFIG)),
    })
  })

  it('renders with two tabs', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('快捷交易')).toBeInTheDocument()
  })

  it('shows quick trade tab by default', () => {
    render(<SettingsPanel onClose={onClose} />)
    // QuickTradeTab should be visible
    expect(screen.getByText('一键锁仓')).toBeInTheDocument()
    expect(screen.getByText('一键反向')).toBeInTheDocument()
  })

  it('switches to hotkey tab when clicked', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('快捷键'))
    // HotKeyTab should be visible
    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('卖出')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows lock settings with default values', () => {
    render(<SettingsPanel onClose={onClose} />)
    // Default lock: counterparty, +1 tick, GFD
    // "对价限价" appears multiple times (lock + reverse close + reverse open)
    expect(screen.getAllByText('对价限价').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('市价').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('GFD（当日有效）')).toBeInTheDocument()
  })

  it('shows reverse settings with close and open sections', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('平仓单')).toBeInTheDocument()
    expect(screen.getByText('开仓单')).toBeInTheDocument()
  })

  it('shows execution mode radio buttons', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('串行（推荐）')).toBeInTheDocument()
    expect(screen.getByText('并行')).toBeInTheDocument()
  })

  it('shows confirm checkbox', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('执行前弹窗确认')).toBeInTheDocument()
  })

  it('shows warning when parallel mode selected', () => {
    render(<SettingsPanel onClose={onClose} />)
    // Click parallel radio
    const parallelRadio = screen.getByText('并行')
    fireEvent.click(parallelRadio)
    // Warning should appear
    expect(screen.getByText(/并行模式同时发送平仓和开仓/)).toBeInTheDocument()
  })
})
