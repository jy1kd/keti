import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PositionsQuery } from './PositionsQuery'
import { useQueryStore } from './store'
import { useTabStore } from '@/stores/tabs'

vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  refreshTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  refreshPositions: vi.fn(),
  refreshAccount: vi.fn().mockResolvedValue(null),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  cancelStopOrder: vi.fn(),
}))

import { refreshPositions } from '../../services/api'
const mockRefreshPositions = vi.mocked(refreshPositions)

const mockPositions = [
  { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
  { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
  { instrumentID: 'RB2610', posiDirection: '2', position: 3, positionCost: 3600, positionProfit: 200, openCost: 3600, useMargin: 36000, todayPosition: 2, ydPosition: 1, tradingDay: '20260727' },
]

describe('PositionsQuery', () => {
  beforeEach(() => {
    useQueryStore.setState({ positions: [] })
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('renders search input', () => {
    render(<PositionsQuery />)
    expect(screen.getByPlaceholderText('筛选合约，如 IF')).toBeInTheDocument()
  })

  it('shows all positions when search is empty', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    expect(await screen.findByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('IF2609')).toBeInTheDocument()
    expect(screen.getByText('RB2610')).toBeInTheDocument()
  })

  it('filters by contract code substring', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'IF' } })
    expect(screen.getByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('IF2609')).toBeInTheDocument()
    expect(screen.queryByText('RB2610')).not.toBeInTheDocument()
  })

  it('filters case-insensitively', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'if' } })
    expect(screen.getByText('IF2608')).toBeInTheDocument()
    expect(screen.queryByText('RB2610')).not.toBeInTheDocument()
  })

  it('shows 无匹配持仓 when no contract matches', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'ZZZ' } })
    expect(screen.getByText('无匹配持仓')).toBeInTheDocument()
  })
})
