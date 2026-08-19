# Task 1 Report — 查询面板移除「合约」「K线」Tab

- Status: DONE
- Commit: `b097c2f` on branch `feature/table-refactor` (baseline 2d049bb)
- Date: 2026-08-07

## Summary

Removed the 合约 (contracts) and K线 (kline) tabs from the query panel (`QueryPanel.tsx`),
narrowed the `QueryTab` type, deleted the now-unused `ContractQuery` component + its test,
cleaned dead CSS and stale comments, and updated the affected tests. K-line functionality
(KLineChart / KLinePage / useMarketWs / store klineData) is preserved untouched.

## Changes per file

- `frontend/src/modules/query/QueryPanel.tsx`
  - Removed imports: `ContractQuery`, `KLineChart`, `useMarketStore`, `PERIOD_MS`, `getKlineData`, `ErrorBoundary`. Import block now only has the 6 real deps + `./styles.css`.
  - `TABS` reduced from 7 to 5 entries (dropped `contracts`, `kline`).
  - Removed store bindings `selectedInstrument` / `klineData` / `setKlineData` / `period` / `setPeriod`.
  - Removed the entire「获取K线数据」`useEffect` (the `getKlineData(selectedInstrument, period, 200)` block).
  - `renderContent` switch: removed `case 'contracts'` and `case 'kline'` (incl. the `<ErrorBoundary>`/`<KLineChart>` kline block); 5 cases + `default` remain.
  - Top bar: dropped the `{activeTab !== 'kline' && (...)}` conditional; `.panel-controls` now renders unconditionally.

- `frontend/src/modules/query/store.ts`
  - `QueryTab` narrowed to `'orders' | 'trades' | 'positions' | 'account' | 'stop_orders'` (line 58).

- `frontend/src/modules/query/styles.css`
  - Removed `.contract-query` from the combined flow-component selector (kept `.order-flow,.trade-flow,.position-table-wrap,.account-query,.stop-order-list,.quote-query`).
  - Deleted `.contract-grid` / `.contract-item` / `.contract-label` / `.contract-value`.
  - Deleted the entire `/* ── K线样式 ── */` block (`.kline-query` / `.kline-placeholder`).

- `frontend/src/modules/query/popupStore.ts`
  - `open` JSDoc now reads「打开查询弹窗；传入合约时同步设置全局选中合约（在行情表格中高亮）」.
  - Block comment no longer references「合约/K线」子页 (now「报单/成交/持仓/资金/止损单」).

- `frontend/src/modules/query/QueryPanel.test.tsx`
  - Added new failing test `不再显示 合约/K线 Tab` (checks `合约`/`K线` are absent).
  - Test title `renders all 6 tab buttons` → `renders all 5 tab buttons`; removed the `expect(screen.getByText('合约'))` line.
  - Test title comment `7 个子 Tab` → `5 个子 Tab`.

- `frontend/src/modules/query/store.test.ts`
  - `supports all tab values including stop_orders, contracts` → `supports all remaining tab values`, tabs list now `['orders','trades','positions','account','stop_orders']`.

- Deleted:
  - `frontend/src/modules/query/ContractQuery.tsx` (via `git rm`)
  - `frontend/src/modules/query/ContractQuery.test.tsx` (via `git rm`)

## Test commands run & outcomes

1. `npx vitest run src/modules/query/QueryPanel.test.tsx -t "不再显示"` → FAIL (expected, red). Old code rendered 合约 tab button.
2. After implementation:
   - `npx vitest run src/modules/query/` → 9 files / 92 tests PASS.
   - `npx tsc --noEmit` → exit 0 (no dangling ContractQuery / removed-import references).
3. Full suite `npx vitest run` → 92 files / 1045 tests PASS, exit 0.
   (CLAUDE.md says "469 单元测试" — stale; the repo now has 1045.)

## Deviations from the brief

None. Line numbers in the brief were slightly stale relative to the checked-out baseline
(line 58 in store.ts and the CSS ranges shifted); all code was located by content as instructed.
A pre-existing React `act(...)` warning appears in QueryPanel.test.tsx output (OrderFlow's async
refresh) — present before this change, unrelated, not a failure.

## Self-review

- Verified by grep that no `ContractQuery` / `contract-query` / `kline-query` / `kline-placeholder` /
  `contract-grid|item|label|value` references remain in `frontend/src`.
- All remaining `kline` matches are the preserved K-line feature: `stores/tabs.ts`, `App.tsx`
  (`openTab({type:'kline'})`), `useContractContextMenu`, `useTabContractLocks`, `components/TabContent`,
  and `pages/KLinePage` — all intentionally untouched.
- `market/styles.css` `.market-panel__kline-placeholder` is a different class (MarketPanel K-line
  area) — untouched. `pages/KLinePage.style.test.tsx` contains one historical comment mentioning
  `.kline-query` in its prose (line 10); it is a comment only (tsc confirms no code reference) and
  lives in the preserved K-line area — left as-is per scope.
- `getContracts` was NOT removed from `services/api.ts` (per constraint) even though it is now unused
  by the query panel.
- No new API calls introduced; no changes to `services/api.ts`.
- Commit uses the exact message from the brief's Step 7.
