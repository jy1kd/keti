import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const cssPath = resolve(__dirname, '../../assets/styles/global.css')

describe('ResizeHandle styles', () => {
  const css = readFileSync(cssPath, 'utf-8')

  it('contains resize-handle base styles', () => {
    expect(css).toContain('.resize-handle')
  })

  it('contains resize-handle--horizontal styles', () => {
    expect(css).toContain('.resize-handle--horizontal')
  })

  it('contains resize-handle--vertical styles', () => {
    expect(css).toContain('.resize-handle--vertical')
  })

  it('contains resize-handle__indicator styles', () => {
    expect(css).toContain('.resize-handle__indicator')
  })

  it('contains resize-handle hover styles', () => {
    expect(css).toContain('.resize-handle:hover')
  })
})
