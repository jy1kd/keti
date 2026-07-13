import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryPanel } from './QueryPanel'
import { useQueryStore } from './store'

describe('QueryPanel', () => {
  beforeEach(() => {
    useQueryStore.setState({ activeTab: 'orders' })
  })

  it('renders panel title', () => {
    render(<QueryPanel />)
    expect(screen.getByText('查询面板')).toBeInTheDocument()
  })

  it('renders tab buttons', () => {
    render(<QueryPanel />)
    expect(screen.getByText('报单')).toBeInTheDocument()
    expect(screen.getByText('成交')).toBeInTheDocument()
    expect(screen.getByText('持仓')).toBeInTheDocument()
    expect(screen.getByText('资金')).toBeInTheDocument()
  })

  it('defaults to orders tab', () => {
    render(<QueryPanel />)
    expect(screen.getByText('报单')).toHaveClass('active')
  })

  it('switches tab on click', () => {
    render(<QueryPanel />)
    fireEvent.click(screen.getByText('成交'))
    expect(screen.getByText('成交')).toHaveClass('active')
    expect(screen.getByText('报单')).not.toHaveClass('active')
  })

  it('renders with query-panel class', () => {
    const { container } = render(<QueryPanel />)
    expect(container.firstChild).toHaveClass('query-panel')
  })
})
