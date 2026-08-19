# Task 5 Report: InstrumentSearchModal 组件

## Status: DONE

## Files Created

- `frontend/src/components/InstrumentSearchModal/index.tsx` — Modal component with exchange/product/instrument three-level drill-down
- `frontend/src/components/InstrumentSearchModal/index.css` — Dark theme styling using CSS variables

## Component Summary

`InstrumentSearchModal` is a React modal component that provides:

1. **Exchange select** — loaded on modal open via `getExchanges()`
2. **Product select** — loaded when exchange changes via `getProducts(exchange)`
3. **Keyword input** — Enter key or search button triggers `searchInstruments(exchange, product, keyword)`
4. **Results table** — shows instrumentID, instrumentName, expireDate, isTrading status
5. **Subscribe action** — calls `subscribeMarket([id])` then `onSubscribe` callback; shows "已订阅" badge if already in `subscribedIds`

## TypeScript Compilation

`npx tsc --noEmit` result: **0 errors in the new component**.

2 pre-existing errors exist in `src/modules/order/store.ts` and `src/modules/order/store.test.ts` (unrelated to this component).

## Commits

- `e70b000` — `feat(task-14): InstrumentSearchModal 组件 — 交易所+品种二级筛选`
- `d0e650b` — `fix(task-5): review反馈 — useEffect cleanup 防止卸载后setState`

## Review Fixes

### useEffect cleanup (Medium)

All three async useEffects now use the `ignore` flag pattern to prevent setState on unmounted components:

1. **exchanges useEffect** — `let ignore = false` + cleanup `return () => { ignore = true }`, guards `setExchanges` and `setError`
2. **products useEffect** — same pattern, guards `setProducts`, `setSelectedProduct`, `setInstruments`, `setError`
3. **instruments useEffect** — refactored `loadInstruments` to accept optional `onCleanup?: () => boolean` parameter; the useEffect passes `() => ignore` while button click and Enter key call without the parameter (no-op guard via optional chaining)

TypeScript check: `npx tsc --noEmit` — 0 errors in the component (2 pre-existing errors in order/store remain unrelated).
