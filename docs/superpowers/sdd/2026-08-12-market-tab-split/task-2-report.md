# Task 2 Report: 标签栏双固定标签（期货 + 期权）

## 1. Status

**DONE**

## 2. Commits made

- `85856e8` — `feat(tabs): 标签栏双固定标签（期货+期权），固定区判断泛化为 closable=false`

## 3. Test result

- Targeted: `npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx` → 2 files / 91 tests passed (33 + 58).
- Full suite: `npx vitest run` → 100 files / 1174 tests passed. No regressions.

## 4. Self-review notes

- **Store** (`frontend/src/stores/tabs.ts`): `DEFAULT_TAB` replaced by `DEFAULT_TABS` (array of two `closable:false` tabs: `tab-market`/`📊 期货`, `tab-options`/`📈 期权`). Updated `tabs: DEFAULT_TABS`, `activeTabId: DEFAULT_TABS[0].id`, and the `closeTab` fallback `DEFAULT_TAB.id` → `DEFAULT_TABS[0].id`. Grep confirmed no other `DEFAULT_TAB` references remain (`generateTabId`/`getTabByType` never referenced it).
- **TabBar** (`frontend/src/components/TabBar/index.tsx`): `marketTab` (single `type==='market'` find) → `fixedTabs = visibleTabs.filter((t) => !t.closable)`; `scrollTabs` filter changed from `type !== 'market'` to `t.closable`. JSX single-tab block → `fixedTabs.map(...)`, preserving every existing behavior: `tab-bar__market` fixed-region class (kept unchanged, so `.tab-bar__market.tab-bar__tab` CSS and existing fixed-region tests still apply), `data-tab-id`, `aria-selected`, active class, `suppressClickRef` handling, `onContextMenu` preventDefault (no right-click menu on fixed tabs), Enter/Space activation. Wheel/overflow/hidden/context-menu logic untouched and operating on `scrollTabs` (unchanged semantics).
- **Existing TabBar tests**: none needed updating — every existing test seeds its own tab state (single market tab), so the dual-tab default doesn't affect them; behavior for a single non-closable tab is identical after the generalization.
- **Existing store tests**: none needed updating — the `useTabStore` `describe` seeds single-tab state in its `beforeEach`, and the store default is not asserted anywhere without seeding.
- **Deviations from brief's literal test code**: (1) The brief's appended `tabs.test.ts` block includes `import { useTabStore } from './tabs'`; the file already imports it at the top, and a duplicate import binding is a module SyntaxError, so the redundant import was omitted (test semantics identical). (2) In the appended TabBar test, the fixed-region assertion uses `.tab-bar__market` (the brief explicitly permits "`tab-bar__market` 或等价 class"), which is the class the component actually renders.
- **Red step**: before implementation, `stores/tabs.test.ts` passed (33) because the brief's store test seeds its own state; the genuine red came from the new TabBar test (`tab-options` rendered in the scroll region, not the fixed region) — matching the brief's expected-FAIL description.

## 5. Concerns

- None for this task's scope. Note for downstream tasks: `tab-options` now exists as a fixed tab but has no TabContent routing yet — that is Task 6 (`TabContent` renders the options panel for `tab-options`). `App.tsx` Electron IPC still opens `type:'market'` with title `'📊 行情'`; `openTab` dedupes by id `tab-market`, so no duplicate tab is created (out of scope for Task 2, left untouched per brief).

---

## Fix Round 1 (reviewer finding + build constraint)

### 6. Status

**DONE** (fix committed)

### 7. Commits made

- `2206a96` — `test(tabs): 新增未播种的默认态断言，验证 DEFAULT_TABS 双固定标签`

### 8. Test result

- Targeted: `npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx` → 2 files / 92 tests passed (34 + 58).
- Full suite: `npx vitest run` → 100 files / 1175 tests passed (1174 + 1 new).

### 9. Build result

- `cd frontend && npm run build` (`tsc && vite build`) → PASS. 2395 modules transformed, built in ~28s. Only pre-existing non-fatal chunk-size warning (>500 kB), unrelated to this change.

### 10. Reviewer finding fix

- The seeded `双固定标签初始化` block only exercised a hand-seeded state, so a regression of the store's actual default (`tabs: DEFAULT_TABS`, `activeTabId: DEFAULT_TABS[0].id`) would go undetected.
- Fix: added an unseeded `describe('双固定标签默认初始化（未播种）')` with one test that resets the store to its true default via `useTabStore.setState(defaultTabStoreState, true)`, where `defaultTabStoreState = useTabStore.getState()` is captured at module load. Vitest isolates each test file (config has no `isolate` override) and `src/setupTests.ts` only mocks `@visactor/vtable` (does not seed the tab store), so the module-load capture is the genuine initial state. `replace: true` is safe because the captured snapshot includes the store methods (zustand `setState` with `replace` swaps the whole state object; the method closures keep working).
- The test asserts: `tabs.length === 2`, titles `['📊 期货', '📈 期权']`, every tab `closable === false`, `activeTabId === 'tab-market'`.
- Mutation-checked: temporarily changed `DEFAULT_TABS` to a single `'📊 行情'` tab → the new test FAILED (1 failed / 33 passed); reverted to the correct two-tab default → 92/92 green. Confirms the test is non-circular (asserts against requirement literals, not the constant) and genuinely guards the deliverable.

