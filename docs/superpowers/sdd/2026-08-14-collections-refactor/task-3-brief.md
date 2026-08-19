### Task 3: 行情页收藏入口改造（⭐ / 右键 / 工具栏 / 搜索弹窗 → 选夹面板）

**Files:**
- Modify: `frontend/src/hooks/useContractMenus.tsx`
- Modify: `frontend/src/modules/market/MarketPanel.tsx`
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`
- Modify: `frontend/src/components/InstrumentSearchModal/index.tsx`
- Test: `frontend/src/modules/market/MarketPanel.test.tsx`（更新）、`frontend/src/modules/options/OptionsPanel.test.tsx`（更新）、`frontend/src/components/InstrumentSearchModal/index.test.tsx`（更新）

**Interfaces:**
- Consumes: `useCollectionsStore`、`unionFavoritedIds`（Task 1）、`CollectionPicker`（Task 2）
- Produces: `useContractMenus` 新签名（见 Step 1）；`InstrumentSearchModal` 新 props：`onOpenFavoritePicker(instrumentID)` + `onRemoveFromAllCollections(instrumentIDs)`（替换 `onAddToFavorite`/`onRemoveFromFavorite`），`favoritedIds`/`allContractIds` 保留

- [ ] **Step 1: 写失败测试（useContractMenus picker/folder 模式）**

创建 `frontend/src/hooks/useContractMenus.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContractMenus } from './useContractMenus'

const ctx = { instrumentID: 'au2406', price: 100, x: 10, y: 20 }
const multi = { instrumentIDs: ['au2406', 'rb2406'], x: 10, y: 20 }

function Harness({ favoriteMode, favoritedIds, onOpenFavoritePicker, onRemoveFromAll, onToggleInFolder, onRemoveFromFolderBatch }: any) {
  const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
    contextMenu: ctx,
    multiSelectMenu: multi,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup: vi.fn(),
    openQueryPopup: vi.fn(),
    openKlineTab: vi.fn(),
    openOrderTabs: vi.fn(),
    openKlineTabs: vi.fn(),
    closeMenus: vi.fn(),
  } as any)
  return (
    <>
      {singleMenu}
      {multiMenu}
      <button data-testid="batch" onClick={() => batchToggleFavorite('au2406', new Set())}>
        {favoriteButtonLabel('au2406', new Set())}
      </button>
    </>
  )
}

describe('useContractMenus 收藏双模式', () => {
  it('picker 模式：单选右键「收藏到收藏夹…」打开面板；批量菜单含「批量收藏到收藏夹…」与「批量取消收藏」', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set(['au2406'])} onOpenFavoritePicker={onOpen} onRemoveFromAll={vi.fn()} />)
    expect(screen.getByText('收藏到收藏夹…')).toBeDefined()
    fireEvent.click(screen.getByText('收藏到收藏夹…'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
    expect(screen.getByText(/批量收藏到收藏夹…/)).toBeDefined()
    expect(screen.getByText(/批量取消收藏/)).toBeDefined()
  })

  it('picker 模式：工具栏批量收藏 → onOpenFavoritePicker(选中集)；label=批量收藏', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set()} onOpenFavoritePicker={onOpen} />)
    expect(screen.getByTestId('batch').textContent).toBe('收藏') // 未收藏单选
    fireEvent.click(screen.getByTestId('batch'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
  })

  it('folder 模式：单选右键「从本夹移除」；批量「批量从本夹移除」，无「批量收藏到收藏夹…」', () => {
    const onToggle = vi.fn()
    render(<Harness favoriteMode="folder" favoritedIds={new Set(['au2406'])} onToggleInFolder={onToggle} />)
    expect(screen.getByText('从本夹移除')).toBeDefined()
    fireEvent.click(screen.getByText('从本夹移除'))
    expect(onToggle).toHaveBeenCalledWith('au2406')
    expect(screen.queryByText(/批量收藏到收藏夹…/)).toBeNull()
    expect(screen.getByText(/批量从本夹移除/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/hooks/useContractMenus.test.tsx`
Expected: FAIL — 签名不匹配 / 标签不符。

- [ ] **Step 3: 重写 `useContractMenus.tsx`**

```tsx
import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { ContextMenu } from '@/components/ContextMenu'
import { toast } from '@/components/Toast'

interface SingleMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

interface MultiMenuState {
  instrumentIDs: string[]
  x: number
  y: number
}

interface UseContractMenusArgs {
  contextMenu: SingleMenuState | null
  multiSelectMenu: MultiMenuState | null
  /** 收藏态集合（行情页 = 任一夹；夹页 = 本夹） */
  favoritedIds: Set<string>
  /** 收藏交互模式：picker（行情页，弹选夹面板）| folder（夹页，直接切本夹） */
  favoriteMode: 'picker' | 'folder'
  /** picker 模式：打开选夹面板 */
  onOpenFavoritePicker?: (instrumentIDs: string[]) => void
  /** picker 模式：批量取消收藏（从所有夹移除） */
  onRemoveFromAll?: (instrumentIDs: string[]) => void
  /** folder 模式：本夹内切换收藏 */
  onToggleInFolder?: (instrumentID: string) => void
  /** folder 模式：批量从本夹移除 */
  onRemoveFromFolderBatch?: (instrumentIDs: string[]) => void
  openOrderPopup: (instrumentID: string) => void
  openQueryPopup: (instrumentID: string) => void
  openKlineTab: (instrumentID: string) => void
  openOrderTabs: (instrumentIDs: string[]) => void
  openKlineTabs: (instrumentIDs: string[]) => void
  closeMenus: () => void
}

/**
 * useContractMenus — 合约右键菜单 + 工具栏收藏共享逻辑（picker / folder 双模式）。
 *
 * - picker（行情页）：收藏项统一弹 CollectionPicker；批量取消收藏 = 从所有夹移除。
 * - folder（夹页）：收藏项直接切本夹 / 批量从本夹移除。
 */
export function useContractMenus(args: UseContractMenusArgs) {
  const {
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  } = args

  /** 工具栏收藏按钮：弹选夹面板（picker 模式）；folder 模式不渲染工具栏收藏 */
  const batchToggleFavorite = useCallback((
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ) => {
    if (favoriteMode !== 'picker') return
    const ids = selectedContracts.size > 0
      ? Array.from(selectedContracts)
      : selectedInstrument ? [selectedInstrument] : []
    if (ids.length > 0) onOpenFavoritePicker?.(ids)
  }, [favoriteMode, onOpenFavoritePicker])

  const favoriteButtonLabel = useCallback((
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ): string => {
    if (selectedContracts.size > 1) return '批量收藏'
    return selectedInstrument && favoritedIds.has(selectedInstrument) ? '收藏夹' : '收藏'
  }, [favoritedIds])

  const singleMenu: ReactNode = contextMenu ? (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={[
        { label: '打开报单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
        { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
        { label: '查询', icon: '📋', onClick: () => openQueryPopup(contextMenu.instrumentID) },
        favoriteMode === 'folder'
          ? {
              label: favoritedIds.has(contextMenu.instrumentID) ? '从本夹移除' : '收藏到本夹',
              icon: favoritedIds.has(contextMenu.instrumentID) ? '★' : '⭐',
              onClick: () => onToggleInFolder?.(contextMenu.instrumentID),
            }
          : {
              label: '收藏到收藏夹…',
              icon: '⭐',
              onClick: () => onOpenFavoritePicker?.([contextMenu.instrumentID]),
            },
        { label: '复制合约代码', icon: '📋', onClick: () => navigator.clipboard.writeText(contextMenu.instrumentID) },
      ]}
      onClose={closeMenus}
    />
  ) : null

  const multiMenu: ReactNode = multiSelectMenu ? (() => {
    const favoritedInSelection = multiSelectMenu.instrumentIDs.filter((id) => favoritedIds.has(id))
    const favoriteItem =
      favoriteMode === 'folder'
        ? {
            label: `批量从本夹移除 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromFolderBatch?.(favoritedInSelection)
              toast.success(`已从本夹移除 ${favoritedInSelection.length} 个合约`)
            },
          }
        : {
            label: `批量收藏到收藏夹… (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '⭐',
            onClick: () => onOpenFavoritePicker?.(multiSelectMenu.instrumentIDs),
          }
    const removeAllItem =
      favoriteMode === 'folder'
        ? null
        : {
            label: `批量取消收藏 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromAll?.(favoritedInSelection)
              toast.success(`已移除 ${favoritedInSelection.length} 个合约的全部收藏`)
            },
          }

    return (
      <ContextMenu
        x={multiSelectMenu.x}
        y={multiSelectMenu.y}
        items={[
          { label: `批量打开报单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📝', onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs) },
          { label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📈', onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs) },
          favoriteItem,
          ...(removeAllItem ? [removeAllItem] : []),
          { label: `复制合约代码 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📋', onClick: () => navigator.clipboard.writeText(multiSelectMenu.instrumentIDs.join(',')) },
        ]}
        onClose={closeMenus}
      />
    )
  })() : null

  return { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel }
}
```

- [ ] **Step 4: 更新 `MarketPanel.tsx` 接入 picker**

改动点：
1. `const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()` → `const contracts = useContractsStore((s) => s.contracts)`
2. 新增：`import { useCollectionsStore, unionFavoritedIds } from '@/stores/collections'`、`import { CollectionPicker } from '@/components/CollectionPicker'`、`import { useState }`（已有）
3. `const collections = useCollectionsStore((s) => s.collections)`；`const [picker, setPicker] = useState<{ instrumentIDs: string[] } | null>(null)`
4. `favoritedIds` 改为：`useMemo(() => unionFavoritedIds(collections), [collections])`
5. `sortedFavorites` 改为：`useMemo(() => sortFutures(contracts.filter((c) => c.productClass === '1' && favoritedIds.has(c.instrumentID))), [contracts, favoritedIds])`
6. `useContractMenus` 调用改为：

```tsx
const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
  contextMenu,
  multiSelectMenu,
  favoritedIds,
  favoriteMode: 'picker',
  onOpenFavoritePicker: (instrumentIDs) => setPicker({ instrumentIDs }),
  onRemoveFromAll: (instrumentIDs) => useCollectionsStore.getState().removeFromAllCollections(instrumentIDs),
  openOrderPopup,
  openQueryPopup,
  openKlineTab,
  openOrderTabs,
  openKlineTabs,
  closeMenus,
})
```

7. `QuoteTable` 的 `onFavoriteChange` 改为：`onFavoriteChange={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}`
8. `InstrumentSearchModal` 调用改为：

```tsx
<InstrumentSearchModal
  isOpen={searchModalOpen}
  onClose={() => setSearchModalOpen(false)}
  onOpenFavoritePicker={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}
  onRemoveFromAllCollections={(ids) => useCollectionsStore.getState().removeFromAllCollections(ids)}
  allContractIds={allContractIds}
  favoritedIds={favoritedIds}
/>
```

9. 面板底部（`{multiMenu}` 之后）渲染 picker：

```tsx
<CollectionPicker
  isOpen={!!picker}
  instrumentIDs={picker?.instrumentIDs ?? []}
  onClose={() => setPicker(null)}
/>
```

- [ ] **Step 5: 更新 `OptionsPanel.tsx` 接入 picker**

同 MarketPanel 改动（第 4 步 1-9），差异：
1. `favoriteOptions`（自选视图基础集）改为：`useMemo(() => options.filter((c) => favoritedIds.has(c.instrumentID)), [options, favoritedIds])`（`options` 已存在；删 `favorites` 相关行）
2. `favoritedIds` = `unionFavoritedIds(collections)`（任一夹）
3. `useContractMenus` 同 picker 模式；`QuoteTable.onFavoriteChange` → `setPicker({ instrumentIDs: [instrumentID] })`
4. `InstrumentSearchModal` props 同 MarketPanel；渲染 `CollectionPicker`

- [ ] **Step 6: 更新 `InstrumentSearchModal/index.tsx`**

Props 接口改：

```ts
interface Props {
  isOpen: boolean
  onClose: () => void
  /** 打开选夹面板（收藏入口） */
  onOpenFavoritePicker: (instrumentID: string) => void
  /** 从所有收藏夹移除 */
  onRemoveFromAllCollections: (instrumentIDs: string[]) => void
  allContractIds: Set<string>
  favoritedIds: Set<string>
}
```

函数签名解构同步。`handleSubscribe` 改为：`const handleSubscribe = (inst: ContractInfo) => onOpenFavoritePicker(inst.instrumentID)`（去掉 toast——确认在面板内）。操作列 `移除` 按钮改为：`onClick={() => { onRemoveFromAllCollections([inst.instrumentID]); toast.success(\`已移除 ${inst.instrumentID}\`) }}`（`favoritedIds.has` 判断不变）。

- [ ] **Step 7: 更新三个既有测试文件**

- `MarketPanel.test.tsx`：
  - `useContractsStore.setState({ contracts: [], favorites: [], isLoaded: false })` → 去掉 `favorites` 字段；改为 `useCollectionsStore.setState({ collections: [], loaded: true })`
  - 所有 `favorites: [...]` 播种改为 `useCollectionsStore.setState({ collections: [{ id: 'c1', name: '默认', instrumentIDs: ['cu2609', 'FG609'] }] })`（对应 411/512 自选视图测试）
  - `onMarketView` 测试（line 462）**本任务不改**——内部 `[全部|自选]` 视图仍存在，`view=favorites` → `setActiveTab('favorites')` 继续有效；Task 8 才改向打开管理页
  - DOM 顺序测试（line 486）不变（按钮结构保留）
  - 新增：⭐ 点击 → 打开 CollectionPicker（`render` 后 `fireEvent.click` ⭐ 列回调，断言 `screen.getByText('收藏到收藏夹')` 出现）
- `OptionsPanel.test.tsx`：
  - `收藏列点击：未收藏 → addToFavorites(inst)`（line 214）改为：点击 ⭐ 列回调 → 打开 CollectionPicker（断言面板出现）；`useContractsStore.setState` 播种的 `favorites` 去掉
  - 工具栏 `收藏` 按钮断言（line 315）保留（label 未收藏为 `收藏`）
- `InstrumentSearchModal/index.test.tsx`：
  - `点击收藏弹出 toast` 改为：点击收藏 → `onOpenFavoritePicker` 被调用（断言 prop 收到 instrumentID）
  - `点击移除` → `onRemoveFromAllCollections(['IF2608'])` + toast
  - 渲染 props 更新为 `onOpenFavoritePicker={vi.fn()}` / `onRemoveFromAllCollections={vi.fn()}`

- [ ] **Step 8: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useContractMenus.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx src/components/InstrumentSearchModal/index.test.tsx`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add frontend/src/hooks/useContractMenus.tsx frontend/src/hooks/useContractMenus.test.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionsPanel.test.tsx frontend/src/components/InstrumentSearchModal/index.tsx frontend/src/components/InstrumentSearchModal/index.test.tsx
git commit -m "feat(collections): 行情页收藏入口改造（⭐/右键/工具栏/搜索弹窗 → 选夹面板）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

