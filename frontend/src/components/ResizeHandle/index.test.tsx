import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResizeHandle } from './index'

describe('ResizeHandle', () => {
  it('renders with horizontal direction by default', () => {
    render(<ResizeHandle data-testid="handle" />)
    const handle = screen.getByTestId('handle')
    expect(handle).toBeInTheDocument()
    expect(handle.className).toContain('resize-handle--horizontal')
  })

  it('renders with vertical direction when specified', () => {
    render(<ResizeHandle direction="vertical" data-testid="handle" />)
    const handle = screen.getByTestId('handle')
    expect(handle.className).toContain('resize-handle--vertical')
  })

  it('renders drag indicator', () => {
    render(<ResizeHandle data-testid="handle" />)
    const handle = screen.getByTestId('handle')
    expect(handle.querySelector('.resize-handle__indicator')).toBeInTheDocument()
  })
})
