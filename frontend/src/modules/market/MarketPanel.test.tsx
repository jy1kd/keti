import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPanel } from './MarketPanel'

describe('MarketPanel', () => {
  it('renders panel title', () => {
    render(<MarketPanel />)
    expect(screen.getByText('行情面板')).toBeInTheDocument()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })
})
