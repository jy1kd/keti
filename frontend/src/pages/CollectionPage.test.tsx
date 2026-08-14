import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionPage } from './CollectionPage'
import { useCollectionsStore } from '@/stores/collections'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'

vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/market/QuoteTable', () => ({
  QuoteTable: ({ contracts, onFavoriteChange, onContextMenu, onMultiSelectContextMenu }: any) => (
    <div data-testid="quote-table">
      {contracts.map((c: any) => (
        <div key={c.instrumentID} data-testid={`row-${c.instrumentID}`}>
          <span>{c.instrumentID}</span>
          <button data-testid={`fav-${c.instrumentID}`} onClick={() => onFavoriteChange?.(c.instrumentID, true)}>⭐</button>
          <button data-testid={`ctx-${c.instrumentID}`} onClick={() => onContextMenu?.(c.instrumentID, 0, { preventDefault: vi.fn(), clientX: 100, clientY: 200 })}>右键</button>
        </div>
      ))}
      <button
        data-testid="multi-ctx"
        onClick={() =>
          onMultiSelectContextMenu?.(contracts.map((c: any) => c.instrumentID), { preventDefault: vi.fn(), clientX: 100, clientY: 200 })
        }
      >
        多选右键
      </button>
    </div>
  ),
}))

const futures = [
  { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
  { instrumentID: 'au2406', instrumentName: '黄金', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2024-06-15', isTrading: 1, productClass: '1' },
]

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '农产品', instrumentIDs: ['IF2608', 'au2406'] }],
      loaded: true,
    })
    useContractsStore.setState({ contracts: futures, isLoaded: true } as any)
    useMarketStore.setState({ snapshots: new Map(), selectedInstrument: null, selectedContracts: new Set() })
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('展示夹内合约（期货段）', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    expect(screen.getByTestId('row-IF2608')).toBeDefined()
    expect(screen.getByTestId('row-au2406')).toBeDefined()
  })

  it('[全部|期货|期权] 类型切换', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByRole('button', { name: '期权' }))
    expect(screen.queryByTestId('row-IF2608')).toBeNull() // 无期权合约 → 空
    fireEvent.click(screen.getByRole('button', { name: '期货' }))
    expect(screen.getByTestId('row-IF2608')).toBeDefined()
  })

  it('⭐ 本夹直切：点击收藏 → 加入本夹；再点 → 移除', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByTestId('fav-IF2608')) // 已在夹，点击移除
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406'])
  })

  it('右键菜单含「从本夹移除」', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByTestId('ctx-IF2608'))
    expect(screen.getByText('从本夹移除')).toBeDefined() // IF2608 在本夹 → folder 模式单选右键为「从本夹移除」
  })

  it('批量从本夹移除：仅弹一条 toast（共享 toast 在 useContractMenus，夹页不再重复弹）', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByTestId('multi-ctx'))
    fireEvent.click(screen.getByText(/批量从本夹移除 \(2个\)/))
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual([])
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('已从本夹移除 2 个合约')
  })

  it('空夹态', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '农产品', instrumentIDs: [] }] })
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    expect(screen.getByText(/收藏夹为空/)).toBeDefined()
  })

  it('收藏夹不存在态', () => {
    render(<CollectionPage collectionId="missing" tabId="tab-collection-missing" />)
    expect(screen.getByText('收藏夹不存在')).toBeDefined()
  })
})
