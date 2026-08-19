### Task 6 Report: CollectionPicker 加 series 模式

**Status:** Done
**Commit:** cccd10a

**What was done:**
- `CollectionPicker` now accepts an optional `seriesIDs?: string[]` prop, mutually exclusive with `instrumentIDs` (which also became optional with `= []` default for backward compat)
- `isSeries = seriesIDs != null` controls mode switching throughout
- Initial checked state: uses `c[key].includes(targetId)` where key is `'seriesIDs'` or `'instrumentIDs'` based on mode
- `handleConfirm`: single series computes `current` from `seriesIDs`, calculates `toAdd`/`toRemove`, calls `addSeriesToCollections` / `removeSeriesFromCollection`; multi-series calls `addSeriesToCollections(ids, checkedIds)`
- `handleRemoveAll`: calls `removeSeriesFromAllCollections(seriesIDs!)`
- Toast text says "系列" in series mode, "合约" in instrument mode
- Header text: "收藏系列到收藏夹" (single) / "收藏 N 个系列到收藏夹" (multi) in series mode
- Collection badge count shows `c.seriesIDs?.length` in series mode
- All 8 existing instrument-mode tests pass unchanged
- 7 new series-mode tests added and passing

**Test summary:** 15/15 tests pass (8 existing + 7 new)

**Concerns:** None. The `instrumentIDs` prop becoming optional is backward-compatible since callers that already pass it continue to work. The `isSeries` check (`seriesIDs != null`) cleanly gates all branching paths.
