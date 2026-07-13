import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global mock for @visactor/vtable (canvas-based, can't run in jsdom)
vi.mock('@visactor/vtable', () => {
  const mockInstance = {
    setRecords: vi.fn(),
    on: vi.fn(),
    release: vi.fn(),
  }
  return {
    ListTable: vi.fn().mockImplementation(() => mockInstance),
  }
})
