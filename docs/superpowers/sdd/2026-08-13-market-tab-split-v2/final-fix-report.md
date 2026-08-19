# Final Fix Report — 行情表拆分 v2 全分支审查整改

- **Status**: DONE
- **Branch**: feature/md-refactor
- **Date**: 2026-08-13

## Commits

- `fix(options): 全分支审查整改（TQuoteView订阅退订/标底菜单外部关闭/标底行不覆盖限价/筛选useMemo去重/去getVolatility mock）`（1 个提交，含 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`）

## Findings

### Important #1 — TQuoteView 直接 subscribeMarket 泄漏（无退订）
- **修复** `frontend/src/modules/options/TQuoteView.tsx`
  - import `unsubscribeMarket`（L3）。
  - 新增 `subscribedIdsRef = useRef<string[]>([])` 记录当前直接订阅的 ID（L49）。
  - 订阅 effect（L156–L185）：订阅新链前先退订 `subscribedIdsRef.current`；返回 cleanup，在组件卸载 / `selectedChain` 变化（换标底、换到期日）时退订当前链并清空 ref。沿用 `.catch(() => {})` 错误处理风格，保留 `getSnapshots` 主动刷新。
- **测试** `frontend/src/modules/options/TQuoteView.test.tsx`
  - `订阅后卸载组件 → 退订该链全部合约（避免订阅泄漏）`（L174）。
  - `切换标的链 → 先退订上一链合约，再订阅新链（无泄漏叠加）`（L192），并断言退订调用先于重新订阅。

### Important #2 — 标底行右键菜单叠加 + 无外部点击关闭
- **修复** `frontend/src/modules/options/OptionsPanel.tsx`
  - `handleRowContextMenu`（L198）顶部 `closeMenus(); setUnderlyingMenu(null)`，任何路径打开前先关闭已有单选/多选/标底菜单。
  - 新增 `underlyingMenuRef` + 外部点击 effect（L50–L63）：document `mousedown` 落在菜单外时 `setUnderlyingMenu(null)`（仅菜单打开时挂监听）。
  - 标底菜单包 `<div ref={underlyingMenuRef}>`（L319）。
  - 新增 `handleMultiSelectContextMenuWrapped`（L211）并传给 `onMultiSelectContextMenu`（L286），多选路径同样先关标底菜单——切换永不叠加。
- **测试** `frontend/src/modules/options/OptionsPanel.test.tsx`
  - `右键标底行后点击菜单外部 → 关闭标底菜单（外部点击关闭）`（L383）。
  - `右键期权行打开单选菜单后，再右键标底行 → 单选菜单关闭，仅剩标底菜单（不叠加）`（L398）。
  - `右键标底行打开标底菜单后，再右键期权行 → 标底菜单关闭，只显示单选菜单（不叠加）`（L419）。

### Minor #3 — 单击标底行把报单表 limitPrice 归零
- **修复** `frontend/src/modules/options/OptionsPanel.tsx` `usePointOrder` onOrder（L153–L162）：标底合约（productClass `'1'`）跳过 `setOrderForm({ limitPrice })`（单击 price=0），仍保留 `setSelectedInstrument`/`setOrderInstrument`；期权行照常填充快照价。
- **测试** `frontend/src/modules/options/OptionsPanel.test.tsx` `单击标底行（productClass 1，无 lastPrice）不覆盖报单表 limitPrice`（L366）：预填 limitPrice=1500 后单击标底行 FG609，断言 limitPrice 仍为 1500、选中与报单合约同步为 FG609。

### Minor #4 — ContractFilter getProduct 内联箭头使 useMemo 失效
- **修复** `frontend/src/components/ContractFilter/index.tsx`（L34–L39）：从 useMemo 依赖数组移除 `getProduct`（纯映射函数，结果只由 allContracts 与已选值决定），附代码注释 + `eslint-disable-next-line react-hooks/exhaustive-deps` 说明安全性。行为不变。
- **测试** 既有 `ContractFilter/index.test.tsx`（13 用例）与 `MarketPanel.test.tsx`（22 用例）全绿。

### Minor #6 — 移除 TQuoteView.test.tsx 中残留 getVolatility mock
- **修复** `frontend/src/modules/options/TQuoteView.test.tsx`：删除 `mockGetVolatility` 声明、`vi.mock('@/services/api')` 中的 `getVolatility` 映射、beforeEach 中的 `mockGetVolatility.mockResolvedValue` 三处。
- `getVolatility` 保留在 `@/services/api`（仍为后端接口面）。

## Test results

- `cd frontend && npm test` → **105 test files / 1229 tests passed（全绿）**
- `cd frontend && npm run build`（tsc && vite build）→ **成功**
- `cd frontend && npx tsc --noEmit` → **无错误**

## Concerns

- 无阻塞性问题。
- 说明：计划文档写的「既有 1232 测试」与当前 1229 的差异是分支开发过程中测试净变化所致（本次新增 6 个用例、无删除用例）；全量套件 0 失败 0 跳过，无回归。
- 全量运行中存在与本整改无关的既有 React `act()` 警告（`TQuoteView` 的 `shows loading text when loading=true` 用例，挂起 promise 未包 act），不影响结果。
