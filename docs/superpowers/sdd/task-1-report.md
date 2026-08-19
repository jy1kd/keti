# Task 1 Report

## Status
DONE

## Commits
- `28debab` - feat(task-12): MarketService 新增 get_exchanges/get_products/search_instruments/get_instruments_by_ids

## Test Summary
- Command: `cd server && python -m pytest tests/test_market_service.py -v`
- Result: 63 passed, 0 failed (52 existing + 11 new)
- New test class: `TestInstrumentSearch` with 11 tests covering all 4 new methods

## Changes Made

### `server/services/market_service.py`
Added 4 new methods after `get_instruments`:

1. **`get_exchanges() -> List[str]`** - Returns sorted deduplicated list of exchange IDs from `_instruments`.
2. **`get_products(exchange) -> List[str]`** - Returns sorted product IDs filtered by exchange.
3. **`search_instruments(exchange, product, keyword=None) -> List[dict]`** - Filters by exchange + product, with optional case-insensitive keyword match on instrumentID and instrumentName.
4. **`get_instruments_by_ids(ids) -> List[dict]`** - Returns instruments matching given IDs, using set lookup for efficiency.

### `server/tests/test_market_service.py`
Added `TestInstrumentSearch` class with 11 tests:
- get_exchanges: unique list, empty when no data
- get_products: filtered by exchange, empty for unknown exchange
- search_instruments: by exchange+product, with keyword, no match, returns all fields
- get_instruments_by_ids: full match, partial match, empty input

## Concerns
None. All tests pass, no regressions in existing tests.
