import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FavoritesPage } from './FavoritesPage'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'

// Mock MarketTable to simplify testing
vi.mock('@/modules/market/MarketTable', () => ({
  MarketTable: ({ contracts, onFavoriteChange }: any) => (
    <div data-testid="market-table">
      <span data-testid="contract-count">{contracts.length}</span>
      {contracts.map((c: any) => (
        <div key={c.instrumentID} data-testid={`contract-${c.instrumentID}`}>
          <span>{c.instrumentID}</span>
          <button
            data-testid={`unfav-${c.instrumentID}`}
            onClick={() => onFavoriteChange?.(c.instrumentID, false)}
          >
            取消收藏
          </button>
          <button
            data-testid={`fav-${c.instrumentID}`}
            onClick={() => onFavoriteChange?.(c.instrumentID, true)}
          >
            收藏
          </button>
        </div>
      ))}
    </div>
  ),
}))

describe('FavoritesPage', () => {
  const mockFavorites = [
    {
      instrumentID: 'IF2608',
      instrumentName: '沪深300',
      exchangeID: 'CFFEX',
      productID: 'IF',
      volumeMultiple: 300,
      priceTick: 0.2,
      expireDate: '2026-08-15',
      isTrading: 1,
      productClass: '1',
    },
    {
      instrumentID: 'IC2608',
      instrumentName: '中证500',
      exchangeID: 'CFFEX',
      productID: 'IC',
      volumeMultiple: 200,
      priceTick: 0.2,
      expireDate: '2026-08-15',
      isTrading: 1,
      productClass: '1',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useContractsStore.setState({
      contracts: [],
      favorites: mockFavorites,
      isLoaded: true,
    })
    useMarketStore.setState({
      snapshots: new Map(),
      selectedInstrument: null,
    })
  })

  it('should render favorites page title', () => {
    render(<FavoritesPage />)
    expect(screen.getByText(/自选合约/)).toBeDefined()
  })

  it('should display favorites count', () => {
    render(<FavoritesPage />)
    expect(screen.getByText('2', { selector: '.favorites-page__count' })).toBeDefined()
  })

  it('should pass favorites to MarketTable', () => {
    render(<FavoritesPage />)
    expect(screen.getByTestId('contract-count').textContent).toBe('2')
  })

  it('should show empty state when no favorites', () => {
    useContractsStore.setState({ favorites: [] })
    render(<FavoritesPage />)
    expect(screen.getByText(/暂无自选合约/)).toBeDefined()
  })

  it('should call removeFromFavorites when unfavorite', () => {
    const removeFromFavorites = vi.fn()
    useContractsStore.setState({ removeFromFavorites } as any)
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('unfav-IF2608'))
    expect(removeFromFavorites).toHaveBeenCalledWith('IF2608')
  })

  it('should call addToFavorites when favoriting', () => {
    const addToFavorites = vi.fn().mockResolvedValue(true)
    const allContracts = [
      { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
    ]
    useContractsStore.setState({ addToFavorites, contracts: allContracts } as any)
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('fav-IF2608'))
    expect(addToFavorites).toHaveBeenCalledWith(allContracts[0])
  })

  it('should render with empty snapshots', () => {
    render(<FavoritesPage />)
    // Should not crash, table still renders
    expect(screen.getByTestId('market-table')).toBeDefined()
  })
})
