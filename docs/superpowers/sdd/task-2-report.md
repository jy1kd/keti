# Task 2 Report: Backend — Market API 新增筛选端点

## Status: DONE

## Commits

- `4b91f00` — feat(task-12): 新增 /exchanges, /products, /search 端点 + /instruments?ids= 支持

## Changes

### `server/api/market.py`
- Extended `GET /api/market/instruments` with `ids` query parameter (comma-separated batch lookup via `get_instruments_by_ids`)
- Added `GET /api/market/instruments/exchanges` — returns deduplicated exchange IDs
- Added `GET /api/market/instruments/products` — returns product IDs for a given exchange (required `exchange` param)
- Added `GET /api/market/instruments/search` — search by exchange + product with optional keyword filter

### `server/tests/test_market_api.py`
- Added `TestGetExchanges` (1 test)
- Added `TestGetProducts` (2 tests: success + missing param 422)
- Added `TestSearchInstruments` (3 tests: by exchange+product, with keyword, missing params 422)
- Added `TestGetInstrumentsByIds` (2 tests: batch lookup, empty ids returns all)

## Test Summary

```
cd server && python -m pytest tests/test_market_api.py tests/test_market_service.py -v
Result: 94 passed, 1 failed
```

The 1 failure (`TestGetDepth::test_depth_returns_snapshot_depth`) is a pre-existing issue unrelated to this task — the test snapshot only provides 2 bid/ask levels but asserts 5.

## Concerns

None. All endpoints follow existing patterns exactly. The `ids` parameter on `/instruments` is backward-compatible (empty string falls through to existing keyword behavior).
