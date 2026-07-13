import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MarketTable } from './MarketTable'
import type { MarketSnapshot } from '@/services/types'

// Mock vtable - canvas-based, can't render in jsdom
const mockSetRecords = vi.fn()
const mockOn = vi.fn()
const mockRelease = vi.fn()

vi.mock('@visactor/vtable', () => ({
  ListTable: vi.fn().mockImplementation(() => ({
    setRecords: mockSetRecords,
    on: mockOn,
    release: mockRelease,
  })),
}))

describe('MarketTable', () => {
  const mockSnapshots = new Map<string, MarketSnapshot>([
    ['au2508', { instrumentID: 'au2508', lastPrice: 480.5, bidPrice1: 480.4, askPrice1: 480.6, volume: 1000, openInterest: 5000 } as MarketSnapshot],
    ['ag2508', { instrumentID: 'ag2508', lastPrice: 6500, bidPrice1: 6499, askPrice1: 6501, volume: 2000, openInterest: 8000 } as MarketSnapshot],
  ])

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a container div', () => {
    const { container } = render(<MarketTable snapshots={mockSnapshots} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('creates ListTable with correct options', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable snapshots={mockSnapshots} />)
    expect(ListTable).toHaveBeenCalledTimes(1)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.columns).toBeDefined()
    expect(options.columns.length).toBeGreaterThan(0)
  })

  it('passes records from snapshots to vtable', async () => {
    render(<MarketTable snapshots={mockSnapshots} />)
    // records are set in the constructor options
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.records).toHaveLength(2)
  })

  it('releases vtable instance on unmount', async () => {
    const { unmount } = render(<MarketTable snapshots={mockSnapshots} />)
    unmount()
    expect(mockRelease).toHaveBeenCalledTimes(1)
  })
})
