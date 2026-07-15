import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPanel } from './MarketPanel'
import { useMarketStore } from './store'

// Mock api module
vi.mock('@/services/api', () => ({
  getInstruments: vi.fn().mockResolvedValue({ instruments: [], count: 0 }),
  subscribeMarket: vi.fn().mockResolvedValue({ success: true, added: [], alreadySubscribed: [] }),
  getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
}))

// Mock usePointOrder to avoid side effects
vi.mock('@/hooks/usePointOrder', () => ({
  usePointOrder: () => ({
    handleClick: vi.fn(),
    handleDoubleClick: vi.fn(),
  }),
}))

describe('MarketPanel', () => {
  beforeEach(() => {
    useMarketStore.setState({
      selectedInstrument: null,
      snapshots: new Map(),
    })
  })

  it('renders panel title', () => {
    render(<MarketPanel />)
    expect(screen.getByText('行情面板')).toBeInTheDocument()
  })

  it('renders with market-panel class', () => {
    const { container } = render(<MarketPanel />)
    expect(container.firstChild).toHaveClass('market-panel')
  })

  it('启动时调用 fetchInstruments 获取合约列表', () => {
    const fetchSpy = vi.spyOn(useMarketStore.getState(), 'fetchInstruments')
    render(<MarketPanel />)
    expect(fetchSpy).toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
