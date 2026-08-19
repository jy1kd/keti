# Task 4 Report: Frontend API Functions

## Status: DONE

## Commits
- `b987f92` feat(task-14): 新增合约搜索/预设/退订 API 函数

## What was done
Added 7 new API functions to `frontend/src/services/api.ts` after `refreshInstruments`:

1. `getExchanges()` - GET `/api/market/instruments/exchanges` -> `ExchangesResponse`
2. `getProducts(exchange)` - GET `/api/market/instruments/products` -> `ProductsResponse`
3. `searchInstruments(exchange, product, keyword?)` - GET `/api/market/instruments/search` -> `InstrumentsResponse`
4. `getPresetInstruments()` - GET `/api/market/preset` -> `PresetResponse`
5. `getInstrumentsByIds(ids)` - GET `/api/market/instruments` with `ids` joined by comma -> `InstrumentsResponse`
6. `refreshPresetInstruments()` - POST `/api/market/preset/refresh` -> `{ success, instruments }`
7. `unsubscribeMarket(instruments)` - POST `/api/market/unsubscribe` -> `UnsubscribeResponse`

Added 4 new local interfaces: `ExchangesResponse`, `ProductsResponse`, `PresetResponse`, `UnsubscribeResponse`.

## Test Summary
- `npx tsc --noEmit`: 2 pre-existing errors (unrelated to this change -- `CancelResponse.error` missing in `store.ts` and `store.test.ts`). Zero new errors introduced.
- Verified by stashing changes and confirming same 2 errors exist on the base branch.

## Concerns
None.
