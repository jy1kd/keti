import { describe, it, expect } from 'vitest'
import { ResizeHandle } from './index'

describe('ResizeHandle component', () => {
  it('is exported', () => {
    expect(ResizeHandle).toBeDefined()
  })

  it('has displayName', () => {
    expect(ResizeHandle.displayName).toBe('ResizeHandle')
  })
})
