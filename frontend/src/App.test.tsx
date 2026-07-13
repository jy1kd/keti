import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { useConnectionStore } from '@/stores/connection'
import { useQueryStore } from '@/modules/query/store'

describe('App Layout', () => {
  beforeEach(() => {
    useConnectionStore.setState({ mdConnected: false, tdConnected: false })
    useQueryStore.setState({ activeTab: 'orders' })
  })

  it('renders status bar with connection indicators', () => {
    render(<App />)
    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(screen.getByText('TD')).toBeInTheDocument()
    expect(screen.getByText('SimNow 交易终端')).toBeInTheDocument()
  })

  it('renders market panel', () => {
    render(<App />)
    expect(screen.getByText('行情面板')).toBeInTheDocument()
  })

  it('renders order panel', () => {
    render(<App />)
    expect(screen.getByText('报单面板')).toBeInTheDocument()
  })

  it('renders query panel', () => {
    render(<App />)
    expect(screen.getByText('查询面板')).toBeInTheDocument()
  })

  it('renders with app class', () => {
    const { container } = render(<App />)
    expect(container.firstChild).toHaveClass('app')
  })
})
