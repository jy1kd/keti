import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FavoritesPage } from './FavoritesPage'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'
import { useOrderPopupStore } from '@/modules/order/popupStore'

// Mock MarketTable to simplify testing
vi.mock('@/modules/market/MarketTable', () => ({
  MarketTable: ({ contracts, onFavoriteChange, onRowDoubleClick, onContextMenu }: any) => (
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
          <button
            data-testid={`dbl-${c.instrumentID}`}
            onClick={() => onRowDoubleClick?.(c.instrumentID, 0)}
          >
            双击
          </button>
          <button
            data-testid={`ctx-${c.instrumentID}`}
            onClick={() => onContextMenu?.(c.instrumentID, 0, { preventDefault: vi.fn(), clientX: 100, clientY: 200 })}
          >
            右键
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
    // 重置标签页 store（保留固定行情标签）
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
    // 重置悬浮报单弹窗
    useOrderPopupStore.setState({ instrumentID: null })
  })

  it('移除标题栏「⭐ 自选合约」与计数角标（计数收敛到全局栏 ⭐ 快捷入口），表格顶到全局栏下', () => {
    render(<FavoritesPage />)
    // 无 header：无标题、无计数角标
    expect(screen.queryByText(/自选合约/)).toBeNull()
    expect(document.querySelector('.favorites-page__header')).toBeNull()
    // 表格直接渲染
    expect(screen.getByTestId('market-table')).toBeDefined()
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

  // --- 标签页打开方式测试 (PR-R13) ---

  it('自选合约双击打开报单弹窗', () => {
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('dbl-IF2608'))

    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2608')
  })

  it('自选合约右键显示上下文菜单', () => {
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('ctx-IF2608'))
    expect(screen.getByText('打开报单')).toBeDefined()
    expect(screen.getByText('打开K线')).toBeDefined()
  })

  it('右键菜单点击「打开报单」打开报单弹窗', () => {
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('ctx-IF2608'))
    fireEvent.click(screen.getByText('打开报单'))

    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2608')
  })

  it('右键菜单点击「打开K线」打开K线标签', () => {
    render(<FavoritesPage />)
    fireEvent.click(screen.getByTestId('ctx-IF2608'))
    fireEvent.click(screen.getByText('打开K线'))

    const tabs = useTabStore.getState().tabs
    const klineTab = tabs.find(t => t.type === 'kline' && t.props?.instrumentID === 'IF2608')
    expect(klineTab).toBeDefined()
    expect(useTabStore.getState().activeTabId).toBe(klineTab?.id)
  })
})
