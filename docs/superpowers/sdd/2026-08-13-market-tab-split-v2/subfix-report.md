# Subfix Report: T型报价订阅路由到共享订阅管理器

- Date: 2026-08-13
- Branch: feature/md-refactor

## 1. Status

DONE

## 2. Commit

- Hash: `56fdbf7`
- Subject: `fix(options): T型报价链订阅路由到共享订阅管理器（lockedContracts 取代直连订阅/退订）`

## 3. What changed

### `frontend/src/modules/options/TQuoteView.tsx`

- **Import (line 3)**: removed `subscribeMarket`, `unsubscribeMarket` from the `@/services/api` import. Kept `getOptionUnderlyings`, `getOptionChains`, `getSnapshots`.
- **Removed** the `subscribedIdsRef` (previously lines 47-49) added in the earlier fix.
- **Subscription effect (lines 147-174)**: replaced the direct subscribe/unsubscribe logic with the market store's `lockedContracts` mechanism:
  - For the selected chain's option ids (calls + puts instrumentIDs), calls `useMarketStore.getState().addLockedContract(id)` per id → the shared `useSubscriptionManager` (mounted in `App.tsx`) now sees these in `shouldSubscribe` (visible + favorites + locked), subscribes them, accounts them in `subscribedRef`, and never LRU-evicts while locked.
  - Cleanup calls `useMarketStore.getState().removeLockedContract(id)` for the SAME closure-captured ids → runs on chain switch and unmount, unlocking the old chain. The manager then grace-unsubscribes after 10s; if the id is still in the options list's visible range, the manager keeps it (no freeze).
  - Kept the proactive `getSnapshots(ids)` refetch → `batchUpdate` (store snapshots fill so the T型报价 table renders immediately; manager's own prefetch is async).

### `frontend/src/modules/options/TQuoteView.test.tsx`

- **Mock cleanup**: removed `mockUnsubscribeMarket` and its factory entry (nothing imports `unsubscribeMarket` after the fix). Kept `subscribeMarket` in the `@/services/api` mock factory because `@/modules/market/store` still imports it (the mock factory replaces the whole module).
- **beforeEach**: now also resets `lockedContracts: new Map()` in `useMarketStore.setState` (store is a module singleton; prevents cross-test lock leakage).
- **Replaced the two subscribe/unsubscribe tests with three lock/unlock tests against the real zustand store**:
  1. `选择期权链 → 锁定该链全部合约（进入共享订阅管理器记账）` — asserts `lockedContracts.get('IF2608-C-1300')` / `('IF2608-P-1300')` are `1` after a chain renders.
  2. `切换期权链 → 解锁旧链并锁定新链（无泄漏叠加）` — rerender to `IF2609`; waits until `IF2609-C-1300` is locked; asserts old chain ids are no longer in `lockedContracts`.
  3. `卸载组件 → 解锁该链全部合约（管理器按宽限期优雅退订，列表行不冻结）` — mounts, asserts locked, unmounts, asserts both chain ids unlocked.

## 4. Test results

- Targeted (`TQuoteView.test.tsx`, `OptionsPanel.test.tsx`, `useSubscriptionManager.test.ts`, `MarketPanel.test.tsx`): **4 files / 74 tests passed**.
- Full suite (`npm test`): **105 files / 1230 tests passed**.
- Build (`npm run build`, which runs `tsc && vite build`): **clean** (only pre-existing chunk-size warning).
- `npx tsc --noEmit`: **clean** (no output).

## 5. Underlying futures id — decided NOT to lock

`frontend/src/modules/options/TQuoteTable.tsx` renders only the call/put/strike columns; it does **not** render the underlying futures price/change (grep for `underlying|selectedUnderlying` in that file returns nothing). Since the underlying price isn't displayed anywhere in the table, locking `selectedUnderlying` would only consume a slot in the manager's subscribed accounting with no display benefit. Skipped per the task's "if not needed, skip" guidance.

## 6. Concerns

- None blocking. Minor: the `getSnapshots` refetch from a chain that was just switched away may resolve after the switch and call `batchUpdate` with the old chain's snapshot data — harmless (store snapshots are keyed by instrumentID and overwritten by newer data) and identical to the pre-fix behavior.
- The test run shows pre-existing `act(...)` warnings in the `shows loading text when loading=true` test (async chain resolution outside `act`) — present before this change, not introduced here.
