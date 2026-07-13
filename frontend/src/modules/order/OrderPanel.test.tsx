import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderPanel } from './OrderPanel'

describe('OrderPanel', () => {
  it('renders panel title', () => {
    render(<OrderPanel />)
    expect(screen.getByText('报单面板')).toBeInTheDocument()
  })

  it('renders with order-panel class', () => {
    const { container } = render(<OrderPanel />)
    expect(container.firstChild).toHaveClass('order-panel')
  })
})
