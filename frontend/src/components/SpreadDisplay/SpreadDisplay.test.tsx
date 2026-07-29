import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpreadDisplay } from './index'

describe('SpreadDisplay', () => {
  it('renders spread between ask1 and bid1', () => {
    render(<SpreadDisplay bidPrice={4694} askPrice={4696} />)
    // spread = 4696 - 4694 = 2.00 (toFixed(2))
    expect(screen.getByText('2.00')).toBeInTheDocument()
  })

  it('renders label', () => {
    render(<SpreadDisplay bidPrice={4694} askPrice={4696} />)
    expect(screen.getByText('价差')).toBeInTheDocument()
  })

  it('shows -- when prices are 0', () => {
    render(<SpreadDisplay bidPrice={0} askPrice={0} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('handles negative spread (inverted market)', () => {
    render(<SpreadDisplay bidPrice={4700} askPrice={4696} />)
    // spread = 4696 - 4700 = -4.00 (toFixed(2))
    expect(screen.getByText('-4.00')).toBeInTheDocument()
  })
})
