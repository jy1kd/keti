import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from './index'
import { useConnectionStore } from '@/stores/connection'

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useConnectionStore.setState({ mdConnected: false, tdConnected: false })
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
    useConnectionStore.setState({ mdConnected: true, tdConnected: true })
    render(<ConnectionStatus />)
    expect(screen.getByTestId('md-indicator')).toHaveClass('connected')
    expect(screen.getByTestId('td-indicator')).toHaveClass('connected')
  })

  it('shows mixed state independently', () => {
    useConnectionStore.setState({ mdConnected: true, tdConnected: false })
    render(<ConnectionStatus />)
    expect(screen.getByTestId('md-indicator')).toHaveClass('connected')
    expect(screen.getByTestId('td-indicator')).toHaveClass('disconnected')
  })
})
