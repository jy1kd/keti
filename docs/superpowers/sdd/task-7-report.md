## Task 7 Report: MarketPanel Integration

**Status:** DONE

**Commits:**
- `e275f87` — `feat(task-15): MarketPanel 集成 — 搜索合约按钮 + 退订按钮 + 启动流程改造`

**Files Modified:**
- `frontend/src/modules/market/MarketPanel.tsx` — rewrote to integrate InstrumentSearchModal + new startup flow
- `frontend/src/modules/market/styles.css` — added `.btn-search-instruments` and `.btn-unsubscribe` styles

**Changes Summary:**

1. **Imports updated:**
   - Added `useMemo`, `InstrumentSearchModal`, `subscribeMarket`
   - Removed unused `fetchInstruments`, `subscribeInstruments`, `refreshInstruments`, `isRefreshing` from market store

2. **Contracts store integration:**
   - Uses `addContractInfo(contract)` (full info from search modal) instead of `addContract(instrumentId)`
   - Uses `removeContractById(id)` for unsubscribe (calls CTP unsubscribe + removes from state + persists)

3. **Startup flow rewritten:**
   - Removed old `fetchInstruments()` + `subscribeInstruments()` pattern
   - New flow: `loadSubscribedContracts()` loads presets + user prefs, then subscribes all via `subscribeMarket()`

4. **UI changes:**
   - Replaced "刷新合约" button with "搜索合约" button (opens InstrumentSearchModal)
   - Added "退订" button (disabled when no instrument selected, calls `removeContractById`)
   - Added `subscribedIds` memoized set for modal to show "已订阅" badges
   - Added `handleSubscribeFromModal` — calls `addContractInfo` + `subscribeMarket`

5. **Styles added:**
   - `.btn-search-instruments` — accent-colored button
   - `.btn-unsubscribe` — secondary button with disabled state

**Test Summary:**
- TypeScript compilation: No new errors. Pre-existing errors in `order/store.ts` (unrelated `CancelResponse` type issue) remain.
- Dev server: Starts successfully on port 5173.

**Concerns:** None. All pieces connect properly — InstrumentSearchModal, contracts store, market store, and subscribeMarket API are wired together.

---

## Review Fix: Test File Updated

**Commit:** `db592a3` — `fix(task-7): review反馈 — 更新 MarketPanel 测试匹配新行为`

**Issue:** 5 tests referenced removed UI ("刷新合约" button, `fetchInstruments`, `refreshInstruments`, `isRefreshing`).

**Changes to `MarketPanel.test.tsx`:**

1. **Removed:** `mockRefreshInstruments`, `refreshInstruments` mock from api module
2. **Added:** mock for `subscribeMarket`, `InstrumentSearchModal`, `PERIOD_MS`
3. **Replaced test** `启动时调用 fetchInstruments` → `启动时调用 loadSubscribedContracts` (spies on contracts store)
4. **Replaced test** `renders refresh contracts button` → `renders 搜索合约 and 退订 buttons`
5. **Replaced test** `refresh button calls refreshInstruments` → `点击 搜索合约 按钮打开搜索弹窗` (verifies modal opens)
6. **Removed tests:** `refresh button shows loading text` and `refresh button is disabled while refreshing` (feature removed)
7. **Added tests:** `退订 button disabled when no selection` and `退订 button enabled when instrument selected`

**Result:** 11 tests pass (was 11, removed 4 old + added 4 new = net same count but all green).
