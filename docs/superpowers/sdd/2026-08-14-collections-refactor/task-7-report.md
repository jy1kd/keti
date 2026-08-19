# Task 7 Report: 订阅去 favorites + contracts/userPrefs 清理 + 启动 loadCollections

## Status: DONE_WITH_CONCERNS (1 non-fixed dead-type hit, justified)

## What was implemented

### 1. `frontend/src/hooks/useSubscriptionManager.ts`
- Removed `useContractsStore` import (was only used for `favorites`).
- Removed `const favorites = useContractsStore((s) => s.favorites)`.
- `calculateShouldSubscribe` is now 可见区 ∪ 锁定 only, deps `[visibleInstrumentIDs, lockedContracts]`.
- Updated 4 stale comments that referenced 自选 (favorites) in the should-subscribe / LRU / drag-heuristic context.

### 2. `frontend/src/stores/contracts.ts`
- Deleted `favorites` field, `loadFavoriteContracts`, `addToFavorites`, `removeFromFavorites` from interface + implementation.
- Removed `useUserPrefsStore` import and `getInstrumentsByIds` import; only `getInstruments` remains.
- `create((set, get))` → `create((set))` (no `get` needed anymore).
- Kept `contracts` / `isLoaded` / `setContracts` / `loadAllInstruments`.

### 3. `frontend/src/stores/userPrefs.ts`
- Deleted `selectedContracts` field, `addSelectedContract`, `removeSelectedContract` from interface + implementation.
- `saveToLocalStorage` no longer persists `selectedContracts`.
- `loadFromLocalStorage` **keeps** the migration read: `const legacy = Array.isArray(data.selectedContracts) ...` → migrates to `coll-default` 默认收藏夹 on first load. The `set({...})` payload no longer writes `selectedContracts` into the store.
- Removed the Task-1-era "已废弃：保留至 Task 7" comment.

### 4. `frontend/src/App.tsx`
- Added `import { useCollectionsStore } from '@/stores/collections'`.
- Startup effect: `useContractsStore.getState().loadFavoriteContracts()` → `useCollectionsStore.getState().loadCollections()`.
- Updated 2 stale comments.

### 5. Test files (brief's 4)
- `useSubscriptionManager.test.ts`: no existing favorites-seeding cases to remove; added a new describe "收藏不再自动订阅" asserting that seeding the collections store does NOT auto-subscribe (`shouldSubscribe` 仅可见区 ∪ 锁定).
- `contracts.test.ts`: removed `favorites` from beforeEach + 初始状态; deleted loadFavoriteContracts/addToFavorites/removeFromFavorites test blocks; trimmed `vi.mock('@/services/api')` to `getInstruments` only; removed `useUserPrefsStore` import.
- `userPrefs.test.ts`: removed `selectedContracts` from beforeEach; deleted the 3 add/remove tests; `saveToLocalStorage` test no longer asserts `stored.selectedContracts`; `loadFromLocalStorage 恢复状态` and `为空时保持默认值` tests no longer touch `selectedContracts`. The two migration tests in the collections describe (旧 selectedContracts → 默认收藏夹 / 已有 collections 时不覆盖) are **kept** — they cover the preserved migration read.
- `App.test.tsx`: `loadFavSpy` → `vi.spyOn(useCollectionsStore.getState(), 'loadCollections').mockResolvedValue(undefined)` (both tests); added import.

### 6. Extra test-file fixes (found via tsc, NOT in brief's list but required to keep suite green)
Deleting `favorites` from the contracts store broke `setState({ favorites: [] })` calls in 6 test files (10 occurrences):
- `src/modules/market/MarketPanel.test.tsx` — removed 3 dead `vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts')` lines (the method no longer exists).
- `src/modules/order/OrderQuotePanel.test.tsx`, `QuoteStatsBar.test.tsx` (2×), `TradeParams.test.tsx` (8×), `src/pages/__tests__/KLinePage.test.tsx`, `OrderPage.test.tsx` — removed `favorites: []` from `useContractsStore.setState(...)`.

### 7. FavoritesPage deletion
`frontend/src/pages/FavoritesPage.{tsx,test.tsx,css}` were **already deleted in Task 4** — nothing to delete. Leftover inert `vi.mock('@/pages/FavoritesPage', ...)` factories in `src/components/TabContent/detachFlow.{repro,integration}.test.tsx` are harmless (factory mocks never resolve the real module; the tests pass) and out of this task's grep scope.

## TDD evidence

Deletions + test-surface updates are the "test" step here:

1. **Red phase (implicit)** — after applying the store/source deletions but before fixing the extra consumers, `npx tsc --noEmit` reported `TS2353` errors in 6 test files (10 `favorites` references + 3 `loadFavoriteContracts` spyOn lines). These were the leftover consumption points the brief's Step 7 anticipated.
2. **Green phase** — focused run of the brief's 4 files: `npx vitest run src/hooks/useSubscriptionManager.test.ts src/stores/contracts.test.ts src/stores/userPrefs.test.ts src/App.test.tsx` → **46 tests passed (4 files)**.
3. After fixing the extra consumers, the 6 additionally-affected files: **91 tests passed (6 files)**.
4. Full regression: `npx vitest run` → **116 files, 1301 tests, all passed**.
5. `npx tsc --noEmit` → clean.

## Files changed

```
frontend/src/App.tsx
frontend/src/App.test.tsx
frontend/src/hooks/useSubscriptionManager.ts
frontend/src/hooks/useSubscriptionManager.test.ts
frontend/src/stores/contracts.ts
frontend/src/stores/contracts.test.ts
frontend/src/stores/userPrefs.ts
frontend/src/stores/userPrefs.test.ts
frontend/src/modules/market/MarketPanel.test.tsx
frontend/src/modules/order/OrderQuotePanel.test.tsx
frontend/src/modules/order/QuoteStatsBar.test.tsx
frontend/src/modules/order/TradeParams.test.tsx
frontend/src/pages/__tests__/KLinePage.test.tsx
frontend/src/pages/__tests__/OrderPage.test.tsx
```

## Grep results

Pattern `\.favorites|addToFavorites|removeFromFavorites|loadFavoriteContracts` → **zero hits in `src/`**.

Pattern `favorites: []` → **zero hits**.

Pattern `selectedContracts` → remaining hits are all legitimate:
- `src/modules/market/*` (MarketPanel/OptionsPanel/QuoteTable/quoteTableCore/store/dragSelectAnchor/store.test/CollectionPage) — the **market store's row-selection `Set<string>`** (`useMarketStore.selectedContracts`), a different concept that still exists and is unrelated to the removed userPrefs deprecated `string[]`.
- `src/hooks/useContractMenus.tsx` — same market-store `Set` param.
- `src/stores/userPrefs.ts:78-79` — the **kept migration read** (`const legacy = Array.isArray(data.selectedContracts) ...`).
- `src/stores/userPrefs.test.ts:76,79,90` — migration tests seeding legacy localStorage `selectedContracts` (kept, covers migration).

Bare word `favorites` → remaining are legitimate: `App.tsx:71` (electron IPC nav `case 'favorites'` → opens collections tab), `MarketPanel.tsx`/`OptionsPanel.tsx` `'all' | 'favorites'` internal view-filter union, `services/electron.ts:124` `MarketView` type string.

### One non-fixed hit (judged justified)
`src/services/types.ts:372` — `UserPreferences.selectedContracts: string[]` in an **unused exported interface** (only occurrence of `UserPreferences` anywhere is its own definition; nothing imports it). It mirrors the old userPrefs shape but is dead type-only code, not wired to any store, and does not break compilation. It is outside the brief's file list, so I left it per "only the deletions the brief lists". Flagging for the coordinator — happy to remove it in a follow-up if desired.

## Self-review findings

- Completeness: all listed deletions applied; migration read preserved; subscription manager has no favorites dependency; App startup loads collections.
- Quality: no orphan imports (`useContractsStore` import in `useSubscriptionManager.ts` removed; `useUserPrefsStore`/`getInstrumentsByIds` imports in `contracts.ts` removed); test files match the new surface; the 6 extra test files were the only additional consumers and were fixed.
- Discipline: only the brief's deletions + the necessarily-broken extra test files; no incidental refactors (comment updates only where the touched files referenced the removed 自选 concept).
- Testing: 1301/1301 full suite green; tsc clean; grep clean (except the justified `UserPreferences` dead type).

## Concerns

1. `services/types.ts:372` `UserPreferences.selectedContracts` left as dead type (see above) — outside brief's file list.
2. The brief's Step 2 (useSubscriptionManager.test.ts "remove favorites auto-subscribe cases") had nothing to remove — no such cases existed in the current file. I added the "收藏不再自动订阅" regression test instead to document the new contract.
3. The brief's commit command listed only the 8 core files; I extended it with the 6 extra test files since they are part of the same deletion cleanup and are required for `tsc`/suite to pass.
