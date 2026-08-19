### Task 6: 收藏夹页完整实现（类型切换 / 本夹 ⭐ 直切 / 从本夹移除）

**Files:**
- Modify: `frontend/src/pages/CollectionPage.tsx`（替换壳）
- Modify: `frontend/src/pages/CollectionPage.css`
- Test: `frontend/src/pages/CollectionPage.test.tsx`（新）

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）、`useContractsStore.contracts`、`groupOptionsByUnderlying`（`@/modules/market/sort`）、`futuresSpec`/`optionsSpec`、`useContractMenus`（folder 模式，Task 3）、`useContractContextMenu`、`usePointOrder`、`useMarketStore`
- Produces: 无（页面终端）

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/pages/CollectionPage.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionPage } from './CollectionPage'
import { useCollectionsStore } from '@/stores/collections'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'

vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/market/QuoteTable', () => ({
  QuoteTable: ({ contracts, onFavoriteChange, onContextMenu }: any) => (
    <div data-testid="quote-table">
      {contracts.map((c: any) => (
        <div key={c.instrumentID} data-testid={`row-${c.instrumentID}`}>
          <span>{c.instrumentID}</span>
          <button data-testid={`fav-${c.instrumentID}`} onClick={() => onFavoriteChange?.(c.instrumentID, true)}>⭐</button>
          <button data-testid={`ctx-${c.instrumentID}`} onClick={() => onContextMenu?.(c.instrumentID, 0, { preventDefault: vi.fn(), clientX: 100, clientY: 200 })}>右键</button>
        </div>
      ))}
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

  it('空夹态', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '农产品', instrumentIDs: [] }] })
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    expect(screen.getByText(/收藏夹为空/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/CollectionPage.test.tsx`
Expected: FAIL — 壳只渲染空态。

- [ ] **Step 3: 实现 `CollectionPage.tsx`**（替换壳）

```tsx
import { useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { futuresSpec } from '@/modules/market/futuresSpec'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { groupOptionsByUnderlying } from '@/modules/market/sort'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore, collectionFavoritedIds } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'
import './CollectionPage.css'

type TypeView = 'all' | 'futures' | 'options'

export function CollectionPage({ collectionId, tabId }: { collectionId: string; tabId: string }) {
  const [typeView, setTypeView] = useState<TypeView>('all')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const collections = useCollectionsStore((s) => s.collections)
  const { addToCollections, removeFromCollection } = useCollectionsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openQueryPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const isActive = useTabStore((s) => s.tabs.some((t) => t.id === s.activeTabId && t.type === 'collection' && t.props.collectionId === collectionId))

  const collection = collections.find((c) => c.id === collectionId)
  const favoritedIds = useMemo(() => collectionFavoritedIds(collections, collectionId), [collections, collectionId])

  // 从全量合约解析本夹合约（保持夹内加入顺序；全局合约未加载完的先缺省）
  const memberContracts = useMemo(() => {
    if (!collection) return []
    const byId = new Map(contracts.map((c) => [c.instrumentID, c]))
    return collection.instrumentIDs.map((id) => byId.get(id)).filter((c): c is ContractInfo => !!c)
  }, [collection, contracts])

  const futures = useMemo(() => memberContracts.filter((c) => c.productClass === '1'), [memberContracts])
  const options = useMemo(() => memberContracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [memberContracts])
  const allFutures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])

  // 期权段：按标底分组展平（标底行在前 + 期权行随后），复用 optionsSpec 渲染
  const optionRows = useMemo(() => {
    const groups = groupOptionsByUnderlying(options, allFutures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [options, allFutures])

  // 「全部」模式两段同时渲染时可见区上报合并（避免后报告的表覆盖前者）
  const rangesRef = useRef<{ futures: string[]; options: string[] }>({ futures: [], options: [] })
  const reportVisible = (part: 'futures' | 'options') => (ids: string[]) => {
    rangesRef.current[part] = ids
    const merged = Array.from(new Set([...rangesRef.current.futures, ...rangesRef.current.options]))
    setVisibleInstrumentIDs(merged)
  }

  const handleToggleFavorite = (instrumentID: string) => {
    if (favoritedIds.has(instrumentID)) {
      removeFromCollection(instrumentID, collectionId)
      toast.success(`已从本夹移除 ${instrumentID}`)
    } else {
      addToCollections([instrumentID], [collectionId])
      toast.success(`已收藏到本夹 ${instrumentID}`)
    }
  }

  const { singleMenu, multiMenu } = useContractMenus({
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode: 'folder',
    onToggleInFolder: handleToggleFavorite,
    onRemoveFromFolderBatch: (ids) => {
      for (const id of ids) removeFromCollection(id, collectionId)
      toast.success(`已从本夹移除 ${ids.length} 个合约`)
    },
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  })

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      const inst = contracts.find((c) => c.instrumentID === instrumentID)
      if (!(inst && inst.productClass === '1')) setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  if (!collection) return <div className="collection-page collection-page__empty">收藏夹不存在</div>

  const isEmpty = memberContracts.length === 0
  const showFutures = typeView === 'all' ? futures.length > 0 : typeView === 'futures'
  const showOptions = typeView === 'all' ? options.length > 0 : typeView === 'options'

  return (
    <section className="collection-page" data-testid="collection-page">
      <div className="market-toolbar">
        <div className="market-toolbar__tabs">
          {(['all', 'futures', 'options'] as TypeView[]).map((v) => (
            <button
              key={v}
              className={`btn-tab${typeView === v ? ' active' : ''}`}
              onClick={() => setTypeView(v)}
            >
              {{ all: '全部', futures: '期货', options: '期权' }[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-content">
        {isEmpty ? (
          <div className="collection-page__empty">
            <p>收藏夹为空</p>
            <p className="collection-page__hint">去行情页点 ⭐ 收藏合约</p>
          </div>
        ) : (
          <ErrorBoundary>
            {showFutures && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期货</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={futuresSpec}
                    contracts={futures}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('futures') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
            {showOptions && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期权</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={optionsSpec}
                    contracts={optionRows}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('options') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
          </ErrorBoundary>
        )}
      </div>
      {singleMenu}
      {multiMenu}
    </section>
  )
}
```

- [ ] **Step 4: 实现 `CollectionPage.css`**（替换壳 css）

```css
.collection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.collection-page .panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.collection-page__table {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.collection-page__section-title {
  flex-shrink: 0;
  padding: 4px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.collection-page__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.collection-page__hint {
  font-size: 13px;
  margin-top: 8px;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/CollectionPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/CollectionPage.tsx frontend/src/pages/CollectionPage.css frontend/src/pages/CollectionPage.test.tsx
git commit -m "feat(collections): 收藏夹页完整实现（类型切换/分段、本夹⭐直切、右键从本夹移除）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

