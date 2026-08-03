import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global mock for @visactor/vtable (canvas-based, can't run in jsdom)
vi.mock('@visactor/vtable', () => {
  const mockInstance = {
    setRecords: vi.fn(),
    on: vi.fn(),
    release: vi.fn(),
    getBodyVisibleCellRange: vi.fn().mockReturnValue({ rowStart: 1, rowEnd: 30, colStart: 0, colEnd: 10 }),
    selectRow: vi.fn(),
    scrollToCell: vi.fn(),
  }
  return {
    ListTable: vi.fn().mockImplementation(() => mockInstance),
  }
})
