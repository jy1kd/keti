# OptionsTable isActive 缺失导致订阅污染 与 数据不显示 修复

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `OptionsTable` 增加 `isActive` 守卫，与 `QuoteTable` 对齐，避免隐藏面板污染订阅管理器、并在切换到期权标签时主动重报可见区让期权数据出现。

**Architecture:** 复用现有模式：`QuoteTable` 已经实现了「首次挂载不上报（isActive=false）→ isActive 翻转为 true 时重报 → records 变化时不主动上报（防止覆盖活跃面板可见区）」。本计划把同样的模式镜像到 `OptionsTable` 与 `OptionsPanel`，最小改动、不引入新依赖、不动后端。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5；`@visactor/vtable` 渲染 T 表；Zustand；Vitest + @testing-library/react。

**Spec:** 无专门 spec。Bug 来自现状分析（见 Plan 末尾「根因摘要」），本计划即为修复方案。

## Global Constraints

- 分支 `feature/options-stacked-t`（已存在）；代码改动在该分支内提交；不 merge/push/删分支（用户手动合并）。
- TDD：每个 task 先写失败测试 → 跑红 → 最小实现 → 跑绿 → 提交。同一 task 内完成。
- 测试命令（前端）：`cd frontend && node_modules/.bin/vitest run <path>`；类型 `npx tsc --noEmit`。
- 不引入新依赖、不动 `QuoteTable`、不动 `MarketPanel`、不动 `SubscriptionManager`、不动后端。
- 符号语义沿用 `QuoteTable.isActive`：true=当前面板活跃（应上报可见区）；false=隐藏/未激活（不应上报）。
- `OptionsTable` 的 `notifyVisibleRange` 已有 try/catch 防御，bug 不是空范围导致崩溃，而是「明明面板隐藏也在上报」。

---

## 根因摘要（执行者必读）

`OptionsPanel` 在 `TabContent` 中与 `MarketPanel` 同时挂载，仅靠 `display: none/block` 切换可见性。`OptionsTable` 当前实现：

1. **挂载 useEffect**（`OptionsTable.tsx:268`）无条件调用 `notifyVisibleRange()`，未检查面板是否激活；
2. **records useEffect**（`OptionsTable.tsx:288-303`）每次 records 变化也调用 `notifyVisibleRange()`，同样不检查激活态；
3. **缺少 `isActive` 翻转 effect**：当用户从期货标签切到期权标签时，期权面板由 `display:none` 变为 `block`，vtable 容器尺寸变化但无任何 effect 触发可见区重报。

导致：
- 当 `MarketPanel`（isActive=true）先上报期货可见 IDs → `OptionsTable`（hidden）后挂载并以「预加载 ±10 行」上报期权合约 IDs（覆盖期货 IDs），订阅管理器把应为「期货可订阅」的 should 集合更改为「期权可订阅」。
- 用户切到期权标签时，期权面板内 vtable 已重排，但 `OptionsTable` 没有任何「isActive 翻转 → 立即重报」effect（`QuoteTable:592-619` 是有的），订阅管理器拿到的还是上一份可见 IDs（可能是期货），期权合约不被订阅 → 数据不显示。
- 期货/期权合约混叠在 `subscribedRef` 里，接近 SOFT_LIMIT 时 LRU 淘汰日志频繁，用户看到「容易到达订阅上限」。

`QuoteTable` 早已用 `isActiveRef` + `scheduleVisibleRangeReport` + `[isActive]` effect 解决同类问题（见 `frontend/src/modules/market/QuoteTable.tsx:79-79, 121-147, 620-626`）。本计划将其镜像到 `OptionsTable`。

---

## File Structure

- `frontend/src/modules/options/OptionsTable.tsx` — 新增 `isActive?: boolean` prop；新增 `isActiveRef`；改 `scheduleVisibleRangeReport`（初始挂载 + records 变化仅在激活时上报）；新增 `[isActive]` 激活翻转 effect。
- `frontend/src/modules/options/OptionsTable.test.tsx` — 新增 3 个 isActive 测试（已有 a956b43 重构后的测试文件，如不存在则建）。
- `frontend/src/modules/options/OptionsPanel.tsx` — 计算 `isActive = tabs.some(t => t.id === activeTabId && t.type === 'options')` 并把 `isActive` 传给 `OptionsTable`。

---

### Task 1: `OptionsTable` 增加 `isActive` 守卫并自动激活时重报

**Files:**
- Modify: `frontend/src/modules/options/OptionsTable.tsx:28-36`（接口加 `isActive`）; `:174-192`（改 `notifyVisibleRange` → `scheduleVisibleRangeReport`）; `:194-285`（改首次挂载 effect，使用调度版本）; `:287-303`（records effect 使用调度版本）; 新增 `[isActive]` effect 紧跟 records effect。
- Test: `frontend/src/modules/options/OptionsTable.test.tsx`（如不存在则新建；如存在则追加；先看现有结构再决定）。
- Read-only: `frontend/src/modules/market/QuoteTable.tsx:79-79, 121-147, 620-626`（镜像实现参考）。

**Interfaces:**
- `OptionsTableProps.isActive?: boolean`（默认 `undefined` 视为 `true`，与 `QuoteTable` 的 `isActiveRef.current === false` 严格判断兼容；激活态语义下，未传=激活）。
- `OptionsTable` 内部 `isActiveRef = useRef(isActive)` + `useEffect(() => { isActiveRef.current = isActive }, [isActive])`。
- 新增内部 callback：`scheduleVisibleRangeReport`（仅当 `isActiveRef.current !== false` 时调度 `notifyVisibleRange`）。
- 新增 effect：`useEffect(() => { if (isActive) notifyVisibleRange() }, [isActive])`（isActive 翻转 true 立即重报）。

- [ ] **Step 1: 写失败测试**

新增测试（参考 `OptionsPanel.test.tsx` 的 vtable mock 与全局 store 初始化风格；如 `OptionsTable.test.tsx` 不存在则用最小 mock 现建一个）：

```tsx
// 文件：frontend/src/modules/options/OptionsTable.test.tsx（如已存在则追加）
describe('OptionsTable isActive 守卫', () => {
  beforeEach(() => {
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      snapshots: new Map(),
    })
  })

  it('isActive=false（缺省视激活）：不调用 setVisibleInstrumentIDs 上报期货可见 IDs 占位', async () => {
    // 期货面板先上报期货 IDs
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['cu2608']))
    const before = useMarketStore.getState().visibleInstrumentIDs
    // 期权面板隐藏挂载（isActive=false）
    render(<OptionsTable records={...records} isActive={false} ...other required props />)
    await new Promise(r => setTimeout(r, 50))
    // 隐藏面板不应覆盖期货 IDs
    expect(useMarketStore.getState().visibleInstrumentIDs).toEqual(before)
  })

  it('isActive 从 false 翻转到 true：立即重报可见 IDs（覆盖隐藏期间的过期数据）', async () => {
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['cu2608']))
    const { rerender } = render(<OptionsTable records={...records} isActive={false} ... />)
    await new Promise(r => setTimeout(r, 50))
    expect(useMarketStore.getState().visibleInstrumentIDs).toEqual(['cu2608'])
    rerender(<OptionsTable records={...records} isActive={true} ... />)
    await new Promise(r => setTimeout(r, 50))
    const after = useMarketStore.getState().visibleInstrumentIDs
    expect(after).toEqual(expect.arrayContaining(['FG609-C-1000', 'FG609-P-1000']))
    expect(after).not.toContain('cu2608')
  })

  it('records 变化时面板仍隐藏：不重报', async () => {
    const { rerender } = render(<OptionsTable records={[]} isActive={false} ... />)
    await new Promise(r => setTimeout(r, 50))
    const before = [...useMarketStore.getState().visibleInstrumentIDs]
    rerender(<OptionsTable records={[{kind:'underlying',underlyingID:'FG609'}, ...]} isActive={false} ... />)
    await new Promise(r => setTimeout(r, 50))
    expect(useMarketStore.getState().visibleInstrumentIDs).toEqual(before)
  })
})
```

（实现细节：`OptionsTable` 当前没有 `onVisibleRangeChange` 可观察——它通过 props 接收 `onVisibleRangeChange`。测试用 `useMarketStore.getState().setVisibleInstrumentIDs` 监听。可在测试里给 `OptionsTable` 传一个 spy 作为 `onVisibleRangeChange`。）

- [ ] **Step 2: 跑测试，确认 3 个用例全红（isActive 未实现，所以首次 isActive=false 也会被上报；isActive 翻转也不会触发；records 隐藏时也会上报）**

```bash
cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsTable.test.tsx
```

预期：3 个用例全失败；现有其它测试不受影响。

- [ ] **Step 3: 最小实现 — OptionsTable 加 isActive 守卫**

参考 `QuoteTable.tsx:79-79, 121-147, 620-626`，把：

1. `OptionsTableProps` 加 `isActive?: boolean`。
2. 在 `useRef<HTMLDivElement>` 后增加 `const isActiveRef = useRef(isActive)`，并紧跟 `useEffect(() => { isActiveRef.current = isActive }, [isActive])`。
3. 新增 `scheduleVisibleRangeReport = useCallback(() => { if (isActiveRef.current === false) return; setTimeout(notifyVisibleRange, 0) }, [notifyVisibleRange])`（注意：稳定函数引用用 `useCallback`，避免拖动/重渲染连锁）。
4. 改首次挂载 useEffect（`:268`）末尾的 `notifyVisibleRange()` 为 `scheduleVisibleRangeReport()`。
5. 改 records useEffect（`:301`）的 `notifyVisibleRange()` 为 `scheduleVisibleRangeReport()`。
6. 在 records useEffect 之后新增 `useEffect(() => { if (isActive) notifyVisibleRange() }, [isActive])`（仿照 `QuoteTable.tsx:620-626`）。
7. 确保 `tableRef.current = table` 后再 schedule（保留原顺序，避免「表未就绪 → 旧 schedule 早于表赋值」）。

注意：scoped 调度不得引入新的 setTimeout 句柄 state（保持现有 reset/release 逻辑不被破坏）。

- [ ] **Step 4: 跑测试，确认 3 个新用例全绿**

```bash
cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsTable.test.tsx
```

预期：3 个新用例全绿；现有其它 OptionsTable 测试无回归（mock vtable always returns `rowStart:1,rowEnd:10`）。

- [ ] **Step 5: 类型 & lint**

```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/modules/options/OptionsTable.tsx --max-warnings 0
```

预期：无错。

- [ ] **Step 6: Commit**

```bash
cd "<repo-root>"
git add frontend/src/modules/options/OptionsTable.tsx frontend/src/modules/options/OptionsTable.test.tsx
git commit -m "fix(options): 期权表 isActive 守卫：隐藏面板不上报 + 激活翻转立即重报"
```

---

### Task 2: `OptionsPanel` 计算并传入 `isActive`

**Files:**
- Modify: `frontend/src/modules/options/OptionsPanel.tsx:35-38`（加 `isActive` 计算，紧跟 `useTabStore` 引用块）；`:174-179`（将 `isActive` 传给 `OptionsTable`）。
- Read-only: `frontend/src/modules/market/MarketPanel.tsx:36-37`（参考实现）。
- 不修改测试：本计划验证已有 `OptionsPanel.test.tsx` 不回归；新增的端到端覆盖放进 `OptionsTable.test.tsx`（Task 1 已含）。

**Interfaces:**
- 新增 `const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))`，类型 `boolean`。
- 传入 `<OptionsTable isActive={isActive} ... />`。

- [ ] **Step 1: 跑一次现状测试作为基线**

```bash
cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx
```

预期：15 个测试全绿（已有基线）。

- [ ] **Step 2: 修改 OptionsPanel.tsx**

在 `const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument)` 之后插入：

```tsx
const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))
```

在 `<OptionsTable` 标签上加 `isActive={isActive}`（与现有 `onToggleGroup`/`onRowClick`/`onVisibleRangeChange` 同列）。

不修改其它逻辑。

- [ ] **Step 3: 跑测试，确认无回归**

```bash
cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx
```

预期：15 个测试仍全绿（功能行为不变，仅补一个 prop）。

- [ ] **Step 4: 类型 & lint**

```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/modules/options/OptionsPanel.tsx --max-warnings 0
```

预期：无错。

- [ ] **Step 5: 跑全部期权相关测试套件**

```bash
cd frontend && node_modules/.bin/vitest run src/modules/options
```

预期：所有期权相关测试绿。

- [ ] **Step 6: Commit**

```bash
cd "<repo-root>"
git add frontend/src/modules/options/OptionsPanel.tsx
git commit -m "fix(options): OptionsPanel 透传 isActive 到 OptionsTable（对齐 MarketPanel 模式）"
```

---

### Task 3: 回归确认 — 全部前端测试 + 验证 Bug 已修

**Files:** 无文件修改；纯验证。

- [ ] **Step 1: 跑全部前端测试**

```bash
cd frontend && node_modules/.bin/vitest run
```

预期：所有 469+ 个测试全绿；如新增 3 个测试文件则含 472+ 个。

- [ ] **Step 2: 跑原 Bug 重现脚本（前面给出的）确认已修复**

复制步骤：
- activeTabId = 'tab-market'（期货面板激活）
- 手动 `useMarketStore.setState({ visibleInstrumentIDs: ['cu2608'] })`
- 渲染 `<OptionsPanel />`
- 100ms 后检查 `visibleInstrumentIDs`

预期：`visibleInstrumentIDs === ['cu2608']`（不再被隐藏的期权面板覆盖为期权 IDs）。

- [ ] **Step 3: 跑类型 & lint 全量**

```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint --max-warnings 0 .
```

预期：无错。

- [ ] **Step 4: Commit（如无新增改动则跳过此步）**

```bash
git status  # 如有未提交改动则执行：
git add -A
git commit -m "chore(options): 回归测试通过，确认 isActive 守卫修复数据不显示与订阅污染"
```

---

## Self-Review

- **Spec coverage：** 修复目标是 OptionsTable 在面板隐藏时不上报 + 激活时重报，对齐 QuoteTable 模式 —— 全部覆盖于 Task 1（守卫+激活重报）和 Task 2（透传）。
- **Placeholder scan：** 已确认无 TBD/TODO；测试代码块已给出完整；实现代码展示了具体 diff。
- **类型一致：** `isActive?: boolean` 在 OptionsTableProps 出现一次；OptionsPanel 使用 `useTabStore` selector 计算，与 MarketPanel 一致。
- **Regression risk：** 期权面板自身仍是默认激活（首次挂载时 active tab 可能为 'tab-options'）；用户主动切到期权时 `isActiveRef` 翻转到 true 触发重报 —— 与 QuoteTable 行为一致，无新破坏面。
