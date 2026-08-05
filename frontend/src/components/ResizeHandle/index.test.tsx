import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResizeHandle } from './index'
import { RESIZE_DIRECTIONS } from '@/utils/resizeDrag'

describe('ResizeHandle', () => {
  it('renders with se direction by default', () => {
    render(<ResizeHandle data-testid="handle" />)
    expect(screen.getByTestId('handle').className).toContain('resize-handle--se')
  })

  it.each(RESIZE_DIRECTIONS)('renders direction class for %s', (dir) => {
    render(<ResizeHandle direction={dir} data-testid={`handle-${dir}`} />)
    expect(screen.getByTestId(`handle-${dir}`).className).toContain(`resize-handle--${dir}`)
  })

  it('renders drag indicator', () => {
    render(<ResizeHandle data-testid="handle" />)
    expect(screen.getByTestId('handle').querySelector('.resize-handle__indicator')).toBeInTheDocument()
  })
})
