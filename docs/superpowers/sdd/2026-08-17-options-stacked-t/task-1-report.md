# Task 1 Report — 合成标底合约 `syntheticUnderlyingContract`

## Status: DONE

## Commit
- `88268ec` — feat(options): 合成标底合约工具（指数期权组头）

## What was done
- Added `syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo` to
  `frontend/src/modules/market/sort.ts`, placed after `groupOptionsByUnderlying`.
- Added `getProductName` import from `@/utils/productNames` (already had
  `deriveUnderlyingProduct` available locally).
- Added the two failing tests from the brief to `sort.test.ts` and confirmed
  red → green via TDD.

## Test summary
`node_modules/.bin/vitest run src/modules/market/sort.test.ts` → **10 passed
(8 existing + 2 new)**.
- New test 1: index-option synthetic contract — productClass='1', isTrading=0,
  productID='MO', instrumentName='中证1000期权'.
- New test 2: real future underlying same shape (synthetic always isTrading=0).

## Concerns
- None functional. Minor note: the synthetic contract uses `productClass='1'`
  (futures) per the brief so it renders via the underlying red/bold branch, even
  though it is non-trading/non-subscribable. This is intentional per the brief and
  the global binding (index options MO/IO/HO are not tradable contracts).
- `exchangeID` is empty string on the synthetic contract; the brief leaves it as
  such, so Task 5 / OptionsPanel must not rely on exchange grouping for synthetic
  headers.
- `volumeMultiple`/`priceTick`/etc. are 0 on the synthetic contract — consumers
  must treat the header as navigation-only (no live price / no order entry).
