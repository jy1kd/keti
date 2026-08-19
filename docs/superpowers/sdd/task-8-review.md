# Task 8 Review: Market Store Cleanup

**Commit:** `6389e13 refactor(task-15): market store 清理 — 移除 fetchInstruments/refreshInstruments/isRefreshing`

**Files reviewed:**
- `frontend/src/modules/market/store.ts`
- `frontend/src/modules/market/store.test.ts`
- `frontend/src/hooks/useMarketWs.ts`
- `frontend/src/hooks/useMarketWs.test.ts`

---

## Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| `fetchInstruments` removed from store | ✅ | Interface, implementation, and all imports removed |
| `refreshInstruments` removed from store | ✅ | Interface, implementation, and `refreshApi` alias removed |
| `isRefreshing` removed from store | ✅ | State field removed from interface and implementation |
| `subscribeInstruments` kept | ✅ | Still present, unchanged |
| `useContractsStore` import removed | ✅ | No longer needed in store.ts |
| No regressions | ✅ | `instruments_refreshed` handler moved to `useMarketWs.ts` with equivalent logic |
| Tests cleaned up | ✅ | `fetchInstruments` and `refreshInstruments` test suites fully removed |

## Detailed Findings

### store.ts - Clean removal

The store interface and implementation correctly remove all three targets. The remaining store is minimal and focused: snapshots, kline data, and `subscribeInstruments`. Only `subscribeMarket` is imported from `@/services/api`.

### useMarketWs.ts - Logic migration

The `instruments_refreshed` handler was updated to call `getInstruments()` and `useContractsStore.getState().setContracts()` directly, replacing the removed `fetchInstruments()` from the market store. Error handling is present via `.catch()`. This preserves the original behavior.

### store.test.ts - Complete cleanup

- Removed `MarketStore - fetchInstruments` describe block (2 tests)
- Removed `MarketStore - refreshInstruments` describe block (4 tests)
- Removed stale mock entries (`getInstruments`, `refreshInstruments`) from `vi.mock` and `beforeEach` reset calls
- Remaining tests (13 tests) all pass for the retained functionality

### useMarketWs.test.ts - Minor stale comment

Line 198 contains `// fetchInstruments() 是异步的，toast 在 .then() 中调用，需要刷新微任务队列`. The code now calls `getInstruments()` not `fetchInstruments()`. The comment is slightly stale but the logic it describes is still accurate (async API call followed by toast in `.then()`). Cosmetic only.

---

## Verdict

**Spec: ✅ Pass**
**Task Quality: Approved**

All required removals complete. Logic correctly migrated to `useMarketWs.ts`. No regressions. Tests properly cleaned up. One cosmetic stale comment in test file (non-blocking).
