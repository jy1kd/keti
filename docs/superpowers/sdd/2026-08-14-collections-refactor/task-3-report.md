# Task 3 Report: 行情页收藏入口改造（⭐ / 右键 / 工具栏 / 搜索弹窗 → 选夹面板）

**Status:** DONE
**Commit:** `735fcb9` — feat(collections): 行情页收藏入口改造（⭐/右键/工具栏/搜索弹窗 → 选夹面板）

## What Was Implemented

Wired the `CollectionPicker` (Task 2) into the market panels and rewrote `useContractMenus` to a two-mode signature:

1. **`useContractMenus.tsx` rewrite (picker / folder 双模式)** — per brief verbatim. Drops `contracts`/`addToFavorites`/`removeFromFavorites` args; adds `favoriteMode: 'picker' | 'folder'`, `onOpenFavoritePicker?`, `onRemoveFromAll?`, `onToggleInFolder?`, `onRemoveFromFolderBatch?`. In picker mode: single right-click item is always 「收藏到收藏夹…」, multi menu has 「批量收藏到收藏夹… (N个)」 + 「批量取消收藏 (N个)」(disabled when 0 favorited in selection), toolbar button opens the picker (batch = selected set, single = selected instrument), label = `收藏`/`收藏夹`/`批量收藏`. In folder mode: single item toggles 本夹 (`从本夹移除`/`收藏到本夹`), multi menu has only 「批量从本夹移除 (N个)」.

2. **`MarketPanel.tsx`** — `useContractsStore` narrowed to `contracts`; added `useCollectionsStore` + `unionFavoritedIds`; `favoritedIds` = union of any-folder collections (spec §5.4); `sortedFavorites` = `contracts.filter(productClass==='1' && favoritedIds.has(...))`; `useContractMenus` in `favoriteMode:'picker'`; `QuoteTable.onFavoriteChange` → `setPicker({instrumentIDs:[id]})`; `InstrumentSearchModal` props swapped to `onOpenFavoritePicker`/`onRemoveFromAllCollections`; renders `<CollectionPicker>` after menus. Removed now-unused `toast` import. `onMarketView` IPC handler untouched.

3. **`OptionsPanel.tsx`** — same changes; `favoriteOptions` = `options.filter((c) => favoritedIds.has(c.instrumentID))` (options-in-any-folder 自选 view).

4. **`InstrumentSearchModal/index.tsx`** — props replaced with `onOpenFavoritePicker(instrumentID)` + `onRemoveFromAllCollections(instrumentIDs[])`; `handleSubscribe` opens the picker (toast removed — confirmation lives in the panel); 移除 button calls `onRemoveFromAllCollections([id])` + toast.

## TDD Evidence

**RED** — Step 2, `useContractMenus.test.tsx` against the old hook:
```
npx vitest run src/hooks/useContractMenus.test.tsx
1 failed | 3 tests failed
```
Failures: `getByText('收藏到收藏夹…')` not found (old labels `收藏`/`取消收藏`); unhandled `TypeError: Cannot read properties of undefined (reading 'find')` at old hook line 102 (`contracts.find`) — signature mismatch confirmed.

**GREEN** — Step 3 after rewrite:
```
npx vitest run src/hooks/useContractMenus.test.tsx
✓ src/hooks/useContractMenus.test.tsx (3 tests)
Test Files 1 passed (1) | Tests 3 passed (3)
```

**Step 8 focused suite:**
```
npx vitest run src/hooks/useContractMenus.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx src/components/InstrumentSearchModal/index.test.tsx
Test Files 4 passed (4) | Tests 51 passed (51)
```

**CollectionPicker regression:**
```
npx vitest run src/components/CollectionPicker/index.test.tsx
Test Files 1 passed (1) | Tests 9 passed (9)
```

**Full suite (safety net):** `npx vitest run` → 115 files / 1302 tests passed.

**Type-check:** `npx tsc --noEmit` → clean (no output, exit 0).

## Files Changed

- `frontend/src/hooks/useContractMenus.tsx` (rewrite)
- `frontend/src/hooks/useContractMenus.test.tsx` (new — brief verbatim)
- `frontend/src/modules/market/MarketPanel.tsx`
- `frontend/src/modules/market/MarketPanel.test.tsx`
- `frontend/src/modules/options/OptionsPanel.tsx`
- `frontend/src/modules/options/OptionsPanel.test.tsx`
- `frontend/src/components/InstrumentSearchModal/index.tsx`
- `frontend/src/components/InstrumentSearchModal/index.test.tsx`

## Test Updates

- **MarketPanel.test.tsx**: removed `favorites` seedings; `beforeEach` resets `useCollectionsStore({ collections: [], loaded: true })`; the two 自选 view tests (筛选在自选视图, 自选排序) seed collections `[{ id:'c1', name:'默认', instrumentIDs:[...] }]` instead of `favorites`; added new test ⭐ 列点击 → CollectionPicker (`getByText('收藏到收藏夹')`). `onMarketView` test and DOM-order test unchanged, per brief.
- **OptionsPanel.test.tsx**: removed `favorites` seedings; `收藏列点击：未收藏 → addToFavorites(inst)` replaced with `收藏列点击 → 打开 CollectionPicker`. 工具栏 `收藏` button assertion kept (passes: unselected label = `收藏`).
- **InstrumentSearchModal/index.test.tsx**: `点击收藏 → onOpenFavoritePicker('IF2608')` (toast removed); `点击移除 → onRemoveFromAllCollections(['IF2608'])` + toast「已移除」.

## Self-Review Findings

- Verified all entry points open the picker in both panels: ⭐ column (`onFavoriteChange`), single right-click (`收藏到收藏夹…`), multi right-click (`批量收藏到收藏夹…`), toolbar (`batchToggleFavorite`), search modal (`onOpenFavoritePicker`).
- picker/folder mode labels match the brief exactly; folder-mode batch item excludes 「批量收藏到收藏夹…」 (removed in picker branch only).
- 自选 aggregate views still sort/filter correctly — the two 自选 tests (sorting + exchange filter) were migrated to collections seeding and pass, proving `unionFavoritedIds` any-folder semantics.
- `onMarketView` handler byte-for-byte untouched; `stores/contracts.ts` untouched (still owns `favorites`/`addToFavorites`/`removeFromFavorites` — Task 7 removes them).
- Removed dead `toast` imports from both panels (would have tripped `noUnusedLocals`).
- Grepped for stray `onAddToFavorite`/`onRemoveFromFavorite` consumers — none remain.

## Concerns

- One mid-run fix: the first version of the new InstrumentSearchModal test title contained an unescaped `'` inside a single-quoted string (`onRemoveFromAllCollections(['IF2608'])`), causing an esbuild transform error. Fixed by rewording the title to avoid the quote. Final title: `点击移除 → onRemoveFromAllCollections 被调用 + toast 提示「已移除」`.
- Minor: the brief's MarketPanel change item 1 says `const contracts = useContractsStore((s) => s.contracts)` — I also added `const collections = useCollectionsStore((s) => s.collections)` on the adjacent line; `favoritedIds` was moved above `sortedFavorites` (dependency order), matching the brief's item 4/5 outcome.
