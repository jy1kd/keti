import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { useConnectionStore } from '@/stores/connection'
import { useQueryStore } from '@/modules/query/store'

// Mock react-resizable-panels (uses browser APIs not available in jsdom)
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

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

  it('renders resize handles for resizable panels', () => {
    render(<App />)
    const handles = document.querySelectorAll('.resize-handle')
    // At least 2 handles: horizontal (market/order) and vertical (main/query)
    expect(handles.length).toBeGreaterThanOrEqual(2)
  })

  it('renders options panel button', () => {
    render(<App />)
    expect(screen.getByText(/期权/)).toBeInTheDocument()
  })
})
