import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IPCMonitorPage } from './IPCMonitorPage'

// Mock isElectron
vi.mock('@/services/electron', () => ({
  isElectron: vi.fn().mockReturnValue(false),
}))

describe('IPCMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    render(<IPCMonitorPage />)
    expect(screen.getByText('📡 网络监控')).toBeInTheDocument()
  })

  it('renders filter buttons', () => {
    render(<IPCMonitorPage />)
    expect(screen.getByText('全部')).toBeInTheDocument()
    expect(screen.getByText('行情')).toBeInTheDocument()
    expect(screen.getByText('报单')).toBeInTheDocument()
    expect(screen.getByText('系统')).toBeInTheDocument()
    expect(screen.getByText('导航')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<IPCMonitorPage />)
    expect(screen.getByText(/暂停/)).toBeInTheDocument()
    expect(screen.getByText(/清空/)).toBeInTheDocument()
    expect(screen.getByText(/导出/)).toBeInTheDocument()
  })

  it('shows empty message when no messages', () => {
    render(<IPCMonitorPage />)
    expect(screen.getByText('暂无消息，等待 WebSocket 连接或 API 请求...')).toBeInTheDocument()
  })

  it('toggles pause state', () => {
    render(<IPCMonitorPage />)
    const pauseBtn = screen.getByText(/暂停/)
    fireEvent.click(pauseBtn)
    expect(screen.getByText(/继续/)).toBeInTheDocument()
  })
})
