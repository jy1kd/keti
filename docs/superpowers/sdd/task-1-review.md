# Task 1 Review

## Spec: ✅

All4 required methods are implemented with correct signatures and behavior:
- `get_exchanges()` returns sorted deduplicated exchange list
- `get_products(exchange)` returns sorted product list filtered by exchange
- `search_instruments(exchange, product, keyword=None)` filters by exchange+product with optional case-insensitive keyword match on instrumentID and instrumentName
- `get_instruments_by_ids(ids)` returns matching instruments with set-based lookup

No extra features added beyond what was requested. Test coverage matches the brief (11 tests in `TestInstrumentSearch`).

## Task quality: Approved

### Observations (none block approval)

1. **search_instruments keyword scope is narrower than existing get_instruments**: The pre-existing `get_instruments(keyword)` searches across instrumentID, instrumentName, exchangeID, and productID. The new `search_instruments(exchange, product, keyword)` only keyword-matches instrumentID and instrumentName. This is correct -- since `search_instruments` already filters by exchange and product, keyword-matching those fields would be redundant.

2. **Minor discrepancy in report**: The report bullet points list 10 test items but the brief specifies 11 test methods and the diff contains all 11. The actual implementation is complete; this is only a documentation imprecision in the report.

3. **Commit message uses `task-12`**: This matches the commit message template in the brief's Step 5 verbatim. Not an implementer error, though the numbering is inconsistent with the brief title ("Task 1").
