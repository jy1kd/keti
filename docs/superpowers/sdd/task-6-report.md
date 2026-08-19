# Task 6 Report: Contracts Store 改造 + 持久化

## Status: DONE

## Commits

- `c370914` — `feat(task-15): contracts store 改造 — 预设+用户订阅合并 + localStorage 持久化`

## What was done

Rewrote `frontend/src/stores/contracts.ts` to add three new methods while preserving full backward compatibility:

1. **`addContractInfo(contract: ContractInfo)`** — Adds a contract with full metadata to the `contracts` array (deduplicates by `instrumentID`), then persists the instrument ID to `useUserPrefsStore` and saves to localStorage.

2. **`removeContractById(instrumentId: string)`** — Calls `unsubscribeMarket` to unsubscribe from CTP (silent fail on error), removes the contract from the `contracts` array, and cleans up `useUserPrefsStore` + localStorage.

3. **`loadSubscribedContracts()`** — Orchestrates startup loading: loads user prefs from localStorage, fetches preset instruments from the API, merges and deduplicates both ID lists, then fetches full contract details via `getInstrumentsByIds`.

### Backward compatibility preserved

- `addContract`, `removeContract`, `setContracts` — unchanged signatures and behavior
- All existing consumers (`MarketPanel.tsx`, `market/store.ts`, `market/store.test.ts`) continue to work without modification

### Test results

- **TypeScript**: `npx tsc --noEmit` — 0 new errors (2 pre-existing errors in `modules/order/` unrelated to this change)
- **Tests**: 34 files, 305 tests pass, 0 failures
- **New tests added**: 6 tests covering `addContractInfo` (dedup, persistence), `removeContractById` (removal, prefs sync), `loadSubscribedContracts` (merge, fallback, empty guard)

## Concerns

None. The implementation matches the brief exactly with two minor adjustments:
- Removed unused `subscribeMarket` import (imported in brief but not called in the code)
- Removed unused `get` parameter from `create` callback (not referenced in implementation)
