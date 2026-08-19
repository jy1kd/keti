# Task 5 Report: collections store 加 seriesIDs

## Status: DONE

## Commit
- `73a9d15` feat(collections): 支持系列收藏 seriesIDs

## Files Modified
- `frontend/src/stores/collections.ts` — Collection interface + seriesIDs field, 3 new actions, unionSerializedIds, loadCollections series validation
- `frontend/src/stores/collections.test.ts` — 4 new tests in '系列收藏' describe block, 1 existing test updated

## Test Summary
- 12 tests pass (8 existing + 4 new series tests), 0 fail
- TypeScript check: clean (0 errors)

## Implementation Details
- `Collection.seriesIDs` is optional (`seriesIDs?: string[]`) for backward compatibility with existing persisted data
- All consumers use `c.seriesIDs ?? []` defensive fallback
- `createCollection` initializes `seriesIDs: []` on new collections
- `loadCollections` validates series against `useContractsStore` contracts (productClass '2'/'6' with matching underlyingInstrID); if contracts store not loaded, series kept optimistically
- Early return guard updated to also check `hasAnySeries` so series-only collections don't skip validation
- Existing `addToCollections`/`removeFromCollection`/`removeFromAllCollections` remain instrumentIDs-only (no seriesIDs mutation)

## Concerns
- None. All backward-compatible, existing tests unaffected, new tests cover core scenarios.
