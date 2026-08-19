# Task 2 Review: TQuoteTable 支持 onRowClick

**Commits reviewed:** `e81fc39 feat(options): TQuoteTable 支持 onRowClick 回填合约`
**Scope:** `TQuoteTable.tsx` (impl) + `TQuoteTable.test.tsx` (tests) — 2 files, +152/−3

---

## SPEC: ✅ (met)

Every brief requirement is satisfied:

| Brief requirement | Verdict | Evidence |
|---|---|---|
| `TQuoteRow` 增加 `callInstrumentID`/`putInstrumentID` | ✅ | diff `TQuoteTable.tsx:169,176`; `buildRecords` fills `c?.instrumentID` / `p?.instrumentID` |
| props 增加 `onRowClick?: (instrumentID: string, price: number) => void` | ✅ | `TQuoteTable.tsx:189` |
| 点击 C 侧 (0..4) 回传 `call.instrumentID` + 最新价 | ✅ | handler `colIndex>=0 && <=4 && record.callInstrumentID` |
| 点击 P 侧 (6..10) 回传 `put.instrumentID` + 最新价 | ✅ | handler `colIndex>=6 && <=10 && record.putInstrumentID` |
| 中列 (strike=5) 不回调 | ✅ | col 5 falls through both branches |
| 缺失侧不回调 | ✅ | guarded by `record.callInstrumentID` / `record.putInstrumentID` truthiness |
| 列索引以真实 columns 为准 (C=0..4, strike=5, P=6..10) | ✅ | matches global constraint; brief Step-1 col typo (6/7) corrected to 4/5 in tests |
| 未传 `onRowClick` 时行为不变 (TQuoteView 回归安全) | ✅ | handler first line `if (!onRowClick) return` — no side effect, identical to pre-change |
| TDD 流程 | ⚠️ see below | cannot verify red/green from diff alone; report documents it |

Nothing extra beyond spec (aside from `onTableReady`, which is test-scaffolding — see quality note).

---

## QUALITY: Issues (Minor only — no Critical/Important blockers)

### Important
*(none)*

### Minor
- **M1 — Stale `onRowClick`/`onTableReady` closure.** The `click_cell` handler is registered inside the mount `useEffect(..., [])`, so it closes over the *initial* `onRowClick`/`onTableReady` props. If a parent re-renders `TQuoteTable` with a different `onRowClick` callback, the handler still invokes the stale one. Current usage (TQuoteView passes none; floating window mounts once) makes this safe, but it is a latent correctness trap. Low priority.
- **M2 — Fragile shared-singleton mock in tests.** `getClickHandler` depends on "take the most-recent `click_cell` registration from the global `ListTable` singleton." This works only because each onRowClick test renders exactly once. If a future test renders `TQuoteTable` twice in the same case (e.g. rerender with `onRowClick`), it could capture the wrong handler. Documented as report Concern #1; acceptable for now but brittle.
- **M3 — `onTableReady` is test-only surface on a production component.** It is a pure pass-through with no production consumer (TQuoteView does not pass it). Justified by the jsdom/vtable testing limitation, but it is YAGNI-ish production API. Consider a `data-testid` / module-level test hook instead if this pattern recurs.
- **M4 — Always-registered no-op `click_cell` listener.** Previously the table registered no `click_cell` handler; now it always does (returns early when no `onRowClick`). Functionally identical for TQuoteView, but it is a tiny behavioral diff. Harmless.

---

## ⚠️ Cannot verify from diff
- **Red/green TDD steps.** The diff only shows final committed state (tests + impl together in `e81fc39`). The report claims a failing-test-first cycle, but the intermediate "red" commit is not in the review range. Accept on report's word; not independently verifiable here.
- **Real vtable `click_cell` event shape.** Production vtable (canvas, not jsdom) was never exercised; the `col/row` vs `colIndex/rowIndex` compatibility branch is defensive and unverified. The mock only feeds `{col,row}` so the `colIndex/rowIndex` branch is untested.

---

## Test hygiene
- New tests assert *real* behavior: C-side click → correct instrumentID+price; P-side click → correct instrumentID+price; strike column → no callback; missing C-side → no callback but P-side still works. ✅
- Regression "no `onRowClick` → no crash" asserts `container.firstChild` truthy (render completes). It does not exercise a click, but matches brief intent. ✅
- No leaked global mock state between the 6 cases (each renders once; `getClickHandler` resolves the last registration deterministically). ✅
- `tsc --noEmit` passes; single file 15 passed; options suite 60 passed (per report). ✅

---

## Verdict
- **SPEC:** ✅
- **QUALITY:** Issues (Minor only — M1..M4, no Critical/Important blocker)
- **Critical/Important count:** 0

**Recommendation:** Approve — spec fully met; address M1 (move `onRowClick`/`onTableReady` into refs or include in deps) only if the floating window will ever swap callbacks on a live instance.
