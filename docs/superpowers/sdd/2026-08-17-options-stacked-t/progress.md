# SDD ledger — plan: docs/superpowers/plans/2026-08-17-options-stacked-t.md

## Tasks
- [ ] Task 1: 合成标底合约 syntheticUnderlyingContract (sort.ts)
- [ ] Task 2: TQuoteTable 支持 onRowClick
- [ ] Task 3: OptionChainGroup 组件
- [ ] Task 4: OptionsPanel 重写为组列表 + 工具栏改造 (P1)
- [ ] Task 5: collections store 加 seriesIDs (P2)
- [ ] Task 6: CollectionPicker 加 series 模式 (P2)
- [ ] Task 7: OptionsPanel 组头 ⭐ 系列收藏 (P2)
- [ ] Task 8: CollectionPage 渲染 series 为堆叠 T 型 (P2)
- [ ] Task 9: 全量回归 + 收尾

## Pre-flight scan (干净)
- T1→T4/T8 签名一致；T2→T3→T4/7 onRowClick 透传一致；T3 props 一致；T5→T6/7/8 一致；T4 与 T7 为增量非冲突。
- 无违反 Global Constraints；无 task 间矛盾。无需 ruling。

## Completions
- Task 1: complete (commits ff4065f..88268ec, review clean; 2 Minor non-blocking — synthetic header is navigation-only, exchangeID empty + zero numeric fields, consumers must not rely on them)

- Task 2: complete (commits 88268ec..e81fc39, review clean; 4 Minor non-blocking — onRowClick stale-closure over props, brittle shared mock, test-only onTableReady, always-on no-op click_cell listener)

- Task 3: complete (commits e81fc39..92f0219, review clean; 4 Minor non-blocking — re-expand resets to earliest, brief test mock had empty calls/puts fixed by impl, etc.)

- Task 4: complete (commits 92f0219..b8963e6, review clean — 65 tests pass, tsc/eslint clean, manual review confirmed spec compliance; 0 Critical/Important)

## P2 starts

- Task 5: complete (commits b8963e6..73a9d15, review clean — 12 tests pass, tsc clean, 0 concerns)

- Task 6: complete (commit cccd10a, review clean — 15 tests pass, 0 concerns)

- Task 7: complete (commit fcda953, review clean — 21 tests pass, 0 concerns)

- Task 8: complete (commit aebc822, review clean — 10 tests pass, 0 concerns)

- Task 8: complete (commit aebc822, review clean — 10 tests pass, 0 concerns)

## Task 9: 全量回归 + 收尾
- tsc --noEmit: clean (after fixing 3 TS errors in TS fix commit)
- 114 test files, 1299 tests, ALL PASS
- TS fix commit: 6d1ac0d — seriesIDs optional guard + unused var cleanup
- Branch: feature/options-stacked-t
- Full commit log: ff4065f..6d1ac0d (10 commits)
