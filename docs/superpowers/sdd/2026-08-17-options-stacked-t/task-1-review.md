# Task 1 Review — 合成标底合约 `syntheticUnderlyingContract`

**Reviewer:** Task-scoped code review gate
**Commit under review:** `88268ec` (feat(options): 合成标底合约工具（指数期权组头）)
**Diff scope:** `frontend/src/modules/market/sort.ts` (+22), `sort.test.ts` (+19/-1)

---

## SPEC: ✅

All brief requirements met:

- [x] **File scope** — Modifies `sort.ts` and `sort.test.ts`, no other files touched.
- [x] **Placement** — `syntheticUnderlyingContract` added after `groupOptionsByUnderlying` (lines 70–86).
- [x] **Consumes** `deriveUnderlyingProduct` — defined locally in `sort.ts` (line 29), reused, no duplicate.
- [x] **Consumes** `getProductName` — imported from `@/utils/productNames` (line 2).
- [x] **Produces** `syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo` — signature matches brief exactly.
- [x] **Output shape** — `instrumentID=underlyingInstrID`, `productClass='1'`, `isTrading=0`, `productID=deriveUnderlyingProduct(...)`, `instrumentName=getProductName(productID)`, `exchangeID=''`, `volumeMultiple=0`, `priceTick=0`, `expireDate=''`, optional option fields `undefined`.
- [x] **Values verified by inspection** — `getProductName('MO')` → `'中证1000期权'` (productNames.ts:6); `deriveUnderlyingProduct('MO2608')` → `'MO'`, `('FG609')` → `'FG'`. Test assertions are correct.
- [x] **TDD** — Two tests from brief added verbatim; report states red→green (10 passed: 8 existing + 2 new).
- [x] **Global constraints** — No new dependencies. `MarketPanel` not modified. `TQuoteView` floating window not touched. `isTrading=0` ensures non-tradable/non-subscribable group header per the index-options binding.

No extra scope, no missing requirements.

---

## QUALITY: Approved

### Findings

**Minor (non-blocking):**
- M1 — `exchangeID` is empty string on the synthetic contract; consumers (Task 5 / OptionsPanel) must not rely on exchange grouping for synthetic headers. Already flagged by implementer; matches brief intent. (Per spec design, not a defect.)
- M2 — `volumeMultiple`/`priceTick` = 0 and option fields `undefined`; consumers must treat the header as navigation-only (no live price / no order entry). Expected per global binding.

**Verified-good:**
- Typing correct: `ContractInfo` requires `exchangeID`/`instrumentName`/`productID` as non-optional `string` — empty-string/`''` and real strings satisfy it; optional fields (`underlyingInstrID?`/`optionsType?`/`strikePrice?`) accept `undefined`.
- No duplication: reuses local `deriveUnderlyingProduct` rather than reimplementing the regex.
- Tests assert real behavior (exact field values), not vacuous — both assert `instrumentID`, `productClass`, `isTrading`, and one asserts `productID` + `instrumentName` mapping.

**Severity counts:** Critical = 0, Important = 0, Minor = 2.

---

## ⚠️ Cannot verify from diff

- ⚠️ The red-run confirmation (`FAIL syntheticUnderlyingContract is not defined`) relies on the implementer report rather than a captured test log in the diff. However, the test file imports the symbol at top-level (line 20), so a pre-implementation run would genuinely fail to compile/resolve — consistent with the reported red. Low risk.
- ⚠️ No `vitest` run was re-executed by the reviewer against the actual working tree (read-only gate; review performed on diff + file inspection). Implementation and tests are internally consistent with the reported green result.

---

## Overall recommendation

**PASS** — Spec fully met, clean minimal implementation, real-behavior tests, no quality defects. Safe to proceed to Task 5 / OptionsPanel integration.
