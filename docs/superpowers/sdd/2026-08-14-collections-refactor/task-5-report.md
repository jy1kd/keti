# Task 5 Report: 收藏夹管理页完整实现

## Status: DONE

## What was implemented

Replaced the Task 4 shell `frontend/src/pages/CollectionsPage.tsx` with the full collections manage page, per the task brief verbatim:

- **Create**: input + `+ 新建收藏夹` button, Enter key also triggers create; trims name, empty name is a no-op; calls `createCollection(name)` and `toast.success`.
- **List**: renders each collection with name and `${instrumentIDs.length} 个合约` count.
- **Open**: `openTab({ type: 'collection', title: '📁 '+name, props: { collectionId: id } })`; dedup by collectionId is handled by the TabStore's existing `openTab` logic (verified by test — opening twice yields one collection tab).
- **Rename**: inline input (autoFocus), commit on Enter or blur, cancel on Escape; calls `renameCollection`; syncs titles of all open `type==='collection'` tabs whose `props.collectionId === id` via `useTabStore.getState().tabs.filter(...)` + `updateTab(t.id, { title: '📁 '+name })`.
- **Delete**: row button sets `deletingId`; confirm dialog reuses global `modal-overlay`/`modal-content` classes; cancel closes dialog, confirm (`data-testid="confirm-delete"`) calls `deleteCollection` (removes only the folder, instruments untouched).
- **Empty state**: "还没有收藏夹" + hint when `collections.length === 0`.
- **Toast**: only `toast.success` / `toast.error` used (mock matches).
- `data-testid="collections-page"` on the section kept from the shell.
- CSS rewritten per brief, all classes scoped under `.collections-page*`.

## Files changed

- `frontend/src/pages/CollectionsPage.tsx` (modified, 108 lines)
- `frontend/src/pages/CollectionsPage.css` (modified, 141 lines)
- `frontend/src/pages/CollectionsPage.test.tsx` (new, 6 tests)

## TDD evidence

### RED — shell only renders empty state

Command: `cd /d/103/note/zhongjin/keti/frontend && npx vitest run src/pages/CollectionsPage.test.tsx`

Output (tail):
```
 Test Files  1 failed (1)
      Tests  6 failed (6)
   Start at  11:11:07
   Duration  3.76s
```
Failing test bodies rendered the shell's `管理页实现中…` empty div instead of collection rows / create bar.

### GREEN — full implementation

Command: `cd /d/103/note/zhongjin/keti/frontend && npx vitest run src/pages/CollectionsPage.test.tsx`

Output:
```
 ✓ src/pages/CollectionsPage.test.tsx (6 tests) 119ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  11:11:31
   Duration  3.78s
```

### TypeScript

Command: `cd /d/103/note/zhongjin/keti/frontend && npx tsc --noEmit` → EXIT 0.

### Full suite sanity check

Command: `cd /d/103/note/zhongjin/keti/frontend && npx vitest run` → **115 files / 1302 tests passed**, exit 0. No regressions (including the two `detachFlow.*.test.tsx` files that `vi.mock('@/pages/FavoritesPage', ...)` — those still resolve as virtual modules even though FavoritesPage.tsx was deleted in Task 4).

## Self-review findings

- Completeness: create / list (name + count) / open (dedup by collectionId) / rename (inline, Enter/Escape/blur, syncs open tab titles) / delete (confirm dialog, only removes folder) / empty state — all present and covered by tests.
- Quality: component code and CSS match the brief exactly; `data-testid="collections-page"` preserved; CSS scoped under `.collections-page*`; names match the shell's BEM-ish structure.
- Discipline: no overbuilding — only what the brief specifies; no extra deps, no extra components.
- Testing: tests exercise real store mutations (`useCollectionsStore.setState`, `useTabStore.getState()`), only `@/components/Toast` is mocked. Not mock-verify tests.

## Concerns

- None blocking. Note (out of scope, pre-existing from Task 4): `frontend/src/components/TabContent/detachFlow.integration.test.tsx` and `detachFlow.repro.test.tsx` still `vi.mock('@/pages/FavoritesPage')` — passes currently, but could be cleaned up in a later task.

## Commit

- `c678ed8` feat(collections): 收藏夹管理页完整实现（新建/列表/打开/重命名同步标题/删除确认）
