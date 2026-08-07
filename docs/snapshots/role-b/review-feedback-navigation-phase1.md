# 审查反馈 — navigation-redesign Phase 1

- **审查窗口**：角色 B（前端）
- **任务来源**：`docs/specs/navigation-redesign.md`（其他路径）
- **审查分支**：`feature/navigation-redesign-phase1`（main...分支 4 commits，对应 Phase 1 步骤 1.1–1.5）
- **审查日期**：2026-08-07

## 审查结论

**有条件通过（🟡 3 项改进建议，无 🔴 阻断项）**

Phase 1 实现与设计文档一致：行情页 `market-tabs` + `panel-header` 合并为单条工具栏、K线拖拽条上移 KLineChart 标题栏、查询/自选页删除冗余标题，全量 1047 测试通过，标签拖拽分离/浮动窗口回归由 detachFlow 测试覆盖。以下为改进建议与待确认项。

---

## 🔴 阻断项

无。

---

## 🟡 改进建议

### 🟡-1 工具栏布局：搜索区 max-width 360px 与 actions `margin-left: auto` 可能产生空隙

- **文件**：`frontend/src/modules/market/styles.css`（`.market-toolbar__search` / `.market-toolbar__actions`）
- **说明**：`.market-toolbar__search` 设 `flex: 1; max-width: 360px`，同时 `.market-toolbar__actions` 设 `margin-left: auto`。在宽屏下搜索区被 360px 封顶后，剩余空白不会被消费，而 actions 被 `margin-left: auto` 推到最右——「全部/自选」与「仅交易中/收藏」之间可能出现一段明显空隙，与设计稿 §3.2 的紧凑排布（`[搜索...] │ [全部|自选] │ [仅交易中] [收藏]`）不一致。
- **建议**：若意图是 actions 右对齐则保留现状并确认；若按设计稿紧凑排布，则去掉 actions 的 `margin-left: auto`，或让搜索区 `flex: 1` 不设 max-width（由 ContractSearch 内部 `width: 100%` 控制实际宽度）。请人工验证宽屏/窄屏两种宽度下的观感。

### 🟡-2 KLineChart 标题栏 `title` 与 `cursor: grab` 覆盖整行，悬停周期/指标控件也会提示「可拖」

- **文件**：`frontend/src/modules/market/KLineChart.tsx:337`、`styles.css:119-125`
- **说明**：`data-drag-handle` 与 `title="拖动此栏可将标签转为弹窗"` 挂在整行 header 上，浏览器会将该 tooltip 也显示在悬停周期按钮 / 指标 select 时（子元素无自己的 title）。虽然 `TabContent` 的指针处理对 `button/input/select/a` 已排除（点击不受影响），但「可拖」提示出现在本应操作周期/指标的区域，语义上易误导。
- **建议**：将 `title` 仅保留在非交互区（如 `.kline-chart__contract`），或给控件区加 `data-no-drag` + 各自无 title，避免 tooltip 覆盖到交互控件。

### 🟡-3 死代码：`.query-panel .panel-header h2` 样式已无对应 DOM

- **文件**：`frontend/src/modules/query/styles.css:49`
- **说明**：查询页删除「查询面板」`<h2>` 后，`.query-panel .panel-header h2` 规则不再命中任何元素（`.panel-header h2` 全局规则仍被 OrderPanel「报单面板」使用，保留）。全局 `.market-tabs`/`.market-tab` 已清理，FavoritesPage 的 `.favorites-page__title` 已同步删除，唯此处遗漏。
- **建议**：删除 `.query-panel .panel-header h2` 死规则。

---

## 🔵 疑问

### 🔵-1 `market-toolbar` 上的 `data-drag-handle` 实际是惰性的

- **文件**：`frontend/src/modules/market/MarketPanel.tsx:104`
- **说明**：`market` 标签是固定标签（`tabs.ts` 中 `closable: false`），而 `TabContent/index.tsx:103` 在 `!tab.closable` 时直接 return，因此行情页工具栏上的 `data-drag-handle` 在当前结构下不会触发任何拖拽脱离。这与旧版 `.market-tabs` 上的 `data-drag-handle`（同样惰性）行为一致，**非回归**。仅确认：保留它是为了与 Phase 2 全局栏合并后的语义对齐，还是本就计划移除？若为前者建议加注释说明。

### 🔵-2 TabContent 测试断言从「⭐ 自选合约」改为「暂无自选合约」

- **文件**：`frontend/src/components/TabContent/index.test.tsx:156`
- **说明**：删除自选页标题后，测试改为断言空状态文案「暂无自选合约」。这使该用例从「验证页面存在」退化为「验证空状态文案」，若空状态文案变更会连带失败。可接受，但建议考虑用更稳定的标识（如 `data-testid`）断言页面渲染。

---

## 已验证 ✅

- **全量测试**：`npm test` 1047 passed，与设计文档 §7 声称一致。
- **受影响测试文件**：MarketPanel / KLineChart / QueryPanel / FavoritesPage / KLinePage / TabContent 共 98 tests 通过。
- **拖拽回归**：TabContent 的 `detachDrag` 单测 + detachFlow 集成/repro 测试均通过；KLineChart 标题栏 handle 与周期按钮/指标 select 的 `button/input/select` 排除逻辑正确（`index.tsx:106`），点击交互不受拖拽影响。
- **设计文档对齐**：Phase 1 表格 1.1–1.5 全部 ✅；验收标准「页面标题不重复」✅；「npm test 全量通过」✅。
- **期权模式**：仅保留模式切换，搜索/全部自选/操作仅行情模式展示，与原行为一致 ✅。
