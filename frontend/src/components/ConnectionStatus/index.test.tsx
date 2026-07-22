import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from './index'
import { useConnectionStore, type ConnectionState } from '@/stores/connection'

const defaultConnState: ConnectionState = {
  phase: 'disconnected',
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnectCount: 0,
  error: null,
}

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      md: { ...defaultConnState },
      td: { ...defaultConnState },
      mdConnected: false,
      tdConnected: false,
    })
  })

  it('renders MD and TD labels', () => {
    render(<ConnectionStatus />)
    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(screen.getByText('TD')).toBeInTheDocument()
  })

  it('shows disconnected state by default', () => {
    render(<ConnectionStatus />)
    const mdIndicator = screen.getByTestId('md-indicator')
    const tdIndicator = screen.getByTestId('td-indicator')
    expect(mdIndicator).toHaveClass('disconnected')
    expect(tdIndicator).toHaveClass('disconnected')
  })

  it('shows connected state when store updated', () => {
    useConnectionStore.setState({
      md: { ...defaultConnState, phase: 'connected' },
      td: { ...defaultConnState, phase: 'connected' },
      mdConnected: true,
      tdConnected: true,
    })
    render(<ConnectionStatus />)
    expect(screen.getByTestId('md-indicator')).toHaveClass('connected')
    expect(screen.getByTestId('td-indicator')).toHaveClass('connected')
  })

  it('shows mixed state independently', () => {
    useConnectionStore.setState({
      md: { ...defaultConnState, phase: 'connected' },
      td: { ...defaultConnState, phase: 'disconnected' },
      mdConnected: true,
      tdConnected: false,
    })
    render(<ConnectionStatus />)
    expect(screen.getByTestId('md-indicator')).toHaveClass('connected')
    expect(screen.getByTestId('td-indicator')).toHaveClass('disconnected')
  })

  it('shows connecting state with pulse animation', () => {
    useConnectionStore.setState({
      md: { ...defaultConnState, phase: 'connecting' },
      td: { ...defaultConnState, phase: 'error', error: '连接超时' },
      mdConnected: false,
      tdConnected: false,
    })
    render(<ConnectionStatus />)
    expect(screen.getByTestId('md-indicator')).toHaveClass('connecting')
    expect(screen.getByTestId('td-indicator')).toHaveClass('error')
  })
})
