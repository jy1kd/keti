# Task 1 Report: 数据层 — userPrefs collections 迁移 + collections store CRUD

**Status:** DONE
**Branch:** feature/fav-refactor
**Commit:** `10e9bb7` feat(collections): 数据层——userPrefs collections 迁移 + collections store CRUD

## What was implemented

1. **`frontend/src/stores/userPrefs.ts`** (modified) — kept `DEFAULT_HOT_KEYS` / `DEFAULT_QUICK_TRADE_CONFIG` verbatim; added:
   - `collections: Collection[]` state + `setCollections(collections)` action
   - Deprecated `selectedContracts` field + `addSelectedContract`/`removeSelectedContract` **retained** (needed by `contracts.ts` until Task 7)
   - `saveToLocalStorage` now persists `{ collections, selectedContracts, hotKeys, quickTradeConfig }`
   - `loadFromLocalStorage` migration: old flat `selectedContracts` → default collection `{ id: 'coll-default', name: '默认收藏夹', instrumentIDs: legacy }`, **only when** `collections` is empty; never overwrites existing collections
   - Uses `import type { Collection } from './collections'` (type-only — no runtime circular import)

2. **`frontend/src/stores/collections.ts`** (new) — `Collection` interface, `nextCollectionId()` (`coll-<timestamp36>-<counter36>`), `unionFavoritedIds`, `collectionFavoritedIds`, and `useCollectionsStore` with `loadCollections/createCollection/renameCollection/deleteCollection/addToCollections/removeFromCollection/removeFromAllCollections`. Persistence flows through `useUserPrefsStore.setCollections()` + `saveToLocalStorage()`. `loadCollections` union-fetches via `getInstrumentsByIds`, cleans invalid IDs, and writes back to localStorage only when a change occurred.

3. **`frontend/src/stores/userPrefs.test.ts`** (updated) — existing 8 tests preserved verbatim (pre-check ruling); `beforeEach` now also resets `collections: []`; appended `useUserPrefsStore collections` describe (3 tests: persist, migration, no-overwrite).

4. **`frontend/src/stores/collections.test.ts`** (new) — 6 tests exactly as specified in the brief.

## TDD evidence

**RED** — `npx vitest run src/stores/collections.test.ts src/stores/userPrefs.test.ts`
```
Test Files  2 failed (2)
     Tests  3 failed | 8 passed (11)
```
- `collections.test.ts`: module-level failure (`./collections` not found)
- `userPrefs.test.ts`: `setCollections` missing + migration not implemented (3 assertion failures at the new describe block)

**GREEN** — same command
```
✓ src/stores/userPrefs.test.ts (11 tests)
✓ src/stores/collections.test.ts (6 tests)
Test Files  2 passed (2)
     Tests  17 passed (17)
```

**Regression** — `npx vitest run src/stores/contracts.test.ts`: 9/9 pass.

**Type-check** — `npx tsc --noEmit`: exit 0.

**Full suite** — `npx vitest run`: 113 files / 1288 tests pass, no regressions.

## Files changed

- `frontend/src/stores/userPrefs.ts` (modified)
- `frontend/src/stores/collections.ts` (new)
- `frontend/src/stores/userPrefs.test.ts` (modified)
- `frontend/src/stores/collections.test.ts` (new)

## Self-review findings

- **Deliberate deviation from brief:** the brief's `collections.ts` skeleton included `import type { ContractInfo } from '@/services/types'` which is never referenced in the code. `tsconfig.json` has `noUnusedLocals: true`, so keeping it would break `npm run build` (`tsc`). Dropped the unused import; verified `tsc --noEmit` passes. All other code matches the brief verbatim.
- Circular import constraint honored: `userPrefs.ts → collections.ts` is `import type` only; `collections.ts → userPrefs.ts` is a runtime value import.
- Edge cases covered and tested: migration only when collections empty; invalid-ID cleanup writes back to localStorage; empty-collection early return sets `loaded: true` without hitting the API.
- `contracts.ts`/`contracts.test.ts` untouched and green (regression requirement met).
- No overbuilding: nothing beyond the brief; `selectedContracts` retained intentionally until Task 7.

## Concerns

- None blocking. One note: the brief's Step 7 contingency (contracts.test.ts going red) did not occur — it stayed green because `selectedContracts` was retained.

---

# 审查修复补充（Important #1）

**Commit:** `1bebddc` feat(collections): loadCollections 空夹守卫——allIds 为空时不调 API

## 缺陷描述

`loadCollections` 在 collections 存在但所有夹 `instrumentIDs` 均为空时仍会调用 `getInstrumentsByIds([])`。后端 `ids.join(',')` → `''` 会回退返回全市场合约（1000+），每次建了空夹后重启即 dump 整个行情。

## 改动

- `frontend/src/stores/collections.ts` `loadCollections`：在 `allIds` 计算后加守卫：

```ts
const allIds = Array.from(new Set(collections.flatMap((c) => c.instrumentIDs)))
// 守卫：所有夹均为空时不调 API——后端 ids 为空会回退返回全市场合约（1000+）
if (allIds.length === 0) {
  set({ collections, loaded: true })
  return
}
```

- `frontend/src/stores/collections.test.ts`：新增用例 `loadCollections：存在夹但全部为空时不调 API（避免后端空 ids 回退全市场）`，经 `useUserPrefsStore.getState().setCollections([{ id: 'a', name: 'A', instrumentIDs: [] }])` 播种，断言 `getInstrumentsByIds` 未被调用、`loaded` 为 true、collections 原样保留。

## TDD evidence

**RED** — `npx vitest run src/stores/collections.test.ts`
```
Test Files  1 failed (1)
     Tests  1 failed | 6 passed (7)
```
失败断言：`expect(getInstrumentsByIds).not.toHaveBeenCalled()`，实际调用次数 1（传入 `[]`）。

**GREEN** — `npx vitest run src/stores/collections.test.ts src/stores/userPrefs.test.ts src/stores/contracts.test.ts`
```
Test Files  3 passed (3)
     Tests  27 passed (27)
```

**Type-check** — `npx tsc --noEmit`: exit 0。

## 说明

仅修复此 Important，其余 Minor 按协调者指示不纳入本次修复。

