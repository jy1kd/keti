# PR-R13 审查反馈 — 标签页打开方式（双击、右键）

## 审查信息

| 项目 | 内容 |
|------|------|
| **审查轮次** | R1 |
| **审查日期** | 2026-08-03 |
| **审查分支** | `feature/redesign-r13-tab-open` |
| **审查范围** | `git diff main...feature/redesign-r13-tab-open`（8 文件，+424/−18） |
| **审查方式** | 只读审查 + 受影响测试（56 通过）+ 全量测试（679 通过） |

## 审查结论

**✅ 通过** — 无 🔴 阻断性问题。含 4 项 🟡 改进建议与 3 项 🔵 疑问，均不阻塞合入，可由开发窗口酌情处理或记录理由。

## 验收标准核对

| 验收标准 | 状态 | 说明 |
|----------|------|------|
| 双击能打开报单标签 | ✅ | `MarketPanel.onFill → openOrderTab`，`openTab` 按 `type+instrumentID` 去重，测试覆盖 |
| 右键菜单能打开报单/K线标签 | ✅ | `contextmenu_cell` 事件（已核实为 vtable 真实事件 `TABLE_EVENT_TYPE.CONTEXTMENU_CELL`），测试覆盖两个入口 |
| 持仓平仓按钮能打开报单标签 | ⏸️ | 推迟到 PR-R20，注记理由成立（依赖 PR-R14 报单页） |
| 所有测试通过（679 tests passed） | ✅ | 已独立运行全量测试：64 文件 / 679 测试全部通过 |

## 已核实的关键点

1. **`contextmenu_cell` 事件名正确** — 存在 `@visactor/vtable/cjs/core/TABLE_EVENT_TYPE.js`，类型为 `MousePointerMultiCellEvent`，`args.event` 为原生 MouseEvent，`preventDefault()` 可抑制浏览器原生菜单。✅
2. **`openTab` 对同一合约去重** — `generateTabId` 生成 `tab-{type}-{instrumentID}`，双击同一合约激活已有标签而非重复打开。✅
3. **TabContent 渲染链路** — `order`/`kline` 标签打开后渲染占位页（PR-R14/R16 待实现），标签可正常打开与切换，符合当前阶段预期。✅
4. **`args.row - 1` 行映射** — 与已有 `click_cell`/`dblclick_cell` 处理一致（vtable row 0 = 表头）。✅

---

## 🟡 改进建议（不阻塞合入）

### Y1. 右键菜单逻辑与 JSX 在 MarketPanel 与 FavoritesPage 中完全重复
`openOrderTab`/`openKlineTab`/`handleContextMenu`/菜单关闭 useEffect + 菜单 JSX 在 `MarketPanel.tsx`（88-117, 254-273 行）与 `FavoritesPage.tsx`（27-53, 114-136 行）中逐字重复，约 50 行。
- **建议**：提取共享 hook（如 `useContractContextMenu`）或共享 `ContextMenu` 组件，两处复用。
- **注意**：PR-R7 规划了 `components/ContextMenu` 组件（含批量操作），R7 实施时需与此统一，避免出现两套右键菜单实现。

### Y2. `openOrderTab` 先使用后声明（TDZ 隐患）
`MarketPanel.tsx:75` 的 `onFill` 回调引用 `openOrderTab`，而 `const openOrderTab = useCallback(...)` 声明在 `:88`。运行时因闭包延迟执行（用户双击时才调用）不会触发 TDZ，但若未来有人在 render 期间同步调用 `handleDoubleClick` 会抛 ReferenceError，且可读性差。
- **建议**：将 `openOrderTab`/`openKlineTab` 定义移到 `usePointOrder` 调用之前。

### Y3. MarketPanel.test.tsx 存在多处 act() 警告
运行测试时出现多处 `An update to MarketPanel inside a test was not wrapped in act(...)`，来自 `setupContracts()` 中 `mockResolvedValue` 的异步状态更新未包裹。
- **建议**：相关用例用 `await act(async () => { ... })` 包裹异步更新，防止未来因时序变化导致的偶发不稳定。

### Y4. task-redesign.md PR-R13「提交文件」清单与实际改动不一致
文档列出 MarketTable/MarketPanel/Position，但实际还改动了 `FavoritesPage.tsx` 与 `FavoritesPage.test.tsx`（实现方式 #3/#4 明确要求自选合约双击/右键，属合理改动，但清单漏列）。
- **建议**：补充两个文件到提交文件清单。

---

## 🔵 疑问确认

### B1. 双击打开的报单标签未携带价格
旧逻辑双击会 `setOrderForm({ limitPrice: price })`，现 `onFill` 中 `price` 参数未使用，`openOrderTab` 仅传 `instrumentID`。
- PR-R14 报单页 props 契约尚未定义。若 R14 期望双击后预填价格，需 R13 将 `price` 传入 props，或 R14 从行情快照自行取值。请确认设计意图。

### B2. 右键菜单位置无边缘翻转
菜单固定于右键坐标（`position: fixed`），靠近屏幕右/下边缘时可能溢出可视区。v1 可接受，建议后续加边界翻转（flip）或限制在容器内。

### B3. 与 PR-R7（右键菜单）的关系
PR-R7 规划创建 `components/ContextMenu`（单选/多选菜单 + 批量操作）。R13 内置的简版右键菜单（仅「打开报单/打开K线」）在 R7 实施时如何处理？建议 R7 复用/扩展本菜单逻辑，避免两套实现并存。

---

## 审查结论（重申）

**✅ 通过** — 功能正确、测试充分（679 全部通过）、范围合理、文档推迟注记理由成立。🟡 建议项与 🔵 疑问项由开发窗口酌情处理或记录理由。

---

# 二次审查（R2）

## 审查信息

| 项目 | 内容 |
|------|------|
| **审查轮次** | R2 |
| **审查日期** | 2026-08-03 |
| **审查范围** | `git diff f50a032..HEAD`（`fbb74ca` 修复 + `b20e187` 文档） |
| **审查方式** | 只读审查 + 全量测试验证（683 passed） |

## 审查结论

**✅ 通过** — 上一轮 🟡/🔵 项均已处理或确认，修复未引入新问题，可进入人工验证。

## 🟡 修复项复核

| 项 | 处理 | 复核结果 |
|----|------|----------|
| Y1 代码重复 | 提取 `useContractContextMenu` hook，MarketPanel/FavoritesPage 复用 | ✅ hook 封装状态 + 标签页打开 + 菜单关闭逻辑，两组件仅保留 ~10 行菜单 JSX 标记；新增 4 个 hook 单测 |
| Y2 TDZ 隐患 | hook 在 `usePointOrder` 前调用（MarketPanel.tsx:29），`openOrderTab` 前置 | ✅ 声明顺序已消除隐患；hook 无条件调用（在 `viewMode === 'options'` 早退之前），hooks 规则合规 |
| Y3 act 警告 | 本 PR 引入的警告已包裹 `act()`；其余为既有 MarketTable `setTimeout` 计时器泄漏 | ✅ 理由充分，非本 PR 引入 |
| Y4 文档同步 | 提交文件清单补 `FavoritesPage.tsx`/`FavoritesPage.test.tsx`，`Position.tsx` 标注 ⏸️ | ✅ task-redesign.md 状态同步为「改进建议已处理，待确认合并」 |

## 🔵 疑问项复核

- **B1**：已确认设计 — R14 报单页从行情快照取价，R13 保持仅传 `instrumentID`。✅
- **B2**：边缘翻转记录推迟，建议后续在 hook 或 PR-R7 ContextMenu 中实现。✅ 记录在案
- **B3**：PR-R7 应基于 `useContractContextMenu` 扩展菜单项。✅ 记录在案

## 测试验证

全量测试 **65 文件 / 683 测试全部通过**（679 → 683，+4 为 `useContractContextMenu.test.ts`）。✅
