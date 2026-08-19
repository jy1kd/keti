## Status: DONE

## Commits
- `6389e13` — refactor(task-15): market store 清理 — 移除 fetchInstruments/refreshInstruments/isRefreshing

## Changes Summary

### `frontend/src/modules/market/store.ts`
- Removed `fetchInstruments` method (was a bridge calling `getInstruments()` and syncing to contracts store)
- Removed `refreshInstruments` method (was calling `refreshApi()` with loading state)
- Removed `isRefreshing` state
- Removed unused imports: `getInstruments`, `refreshInstruments as refreshApi`, `useContractsStore`
- Kept: `subscribeInstruments`, `updateSnapshot`, `batchUpdate`, `setKlineData`, `appendKline`, `setSelectedInstrument`

### `frontend/src/hooks/useMarketWs.ts`
- Replaced `fetchInstruments()` call with direct `getInstruments()` + `useContractsStore.getState().setContracts()` in the `instruments_refreshed` WS handler
- Added imports: `getInstruments` from `@/services/api`, `useContractsStore` from `@/stores/contracts`
- Removed `fetchInstruments` selector from market store

### `frontend/src/modules/market/store.test.ts`
- Removed `fetchInstruments` test block (2 tests)
- Removed `refreshInstruments` test block (4 tests)
- Removed unused mocks: `getInstruments`, `refreshInstruments`
- Removed unused import: `useContractsStore`

### `frontend/src/hooks/useMarketWs.test.ts`
- Removed `refreshInstruments` from API mock

## Test Summary
- TypeScript compilation: 0 new errors (2 pre-existing errors in `order/store.ts`, unrelated)
- All frontend tests: **34 files, 299 tests passed**

## Concerns
None. The `instruments_refreshed` WS handler behavior is preserved — it still calls `getInstruments()` API and syncs results to contracts store, just directly instead of through the removed market store method.
