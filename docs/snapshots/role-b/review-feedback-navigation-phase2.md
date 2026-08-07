# 审查反馈 — navigation-redesign Phase 2

- **审查窗口**：角色 B（前端）
- **任务来源**：`docs/specs/navigation-redesign.md`（其他路径）
- **审查分支**：`feature/navigation-redesign-phase2`（main...分支 2 commits，对应 Phase 2 步骤 2.1–2.5）
- **审查日期**：2026-08-07

## 审查结论

**有条件通过（🟡 3 项改进建议 + 🔵 3 项疑问，无 🔴 阻断项）**

Phase 2 实现与设计文档一致：GlobalBar 将 status-bar + tab-bar 合并为一行，⚡FPS/🔌IPC 收敛进「⋯」更多菜单，应用标题移除（document.title 保留），自选页 header 彻底移除、计数角标收敛到 ⭐ 快捷入口。全量 1065 测试通过，旧类名（`.status-bar`/`.app-title`/`.favorites-page__header` 等）全仓库无残留。以下为改进建议与待确认项。

---

## 🔴 阻断项

无。

---

## 🟡 改进建议

### 🟡-1 自选计数角标与 QUICK_TABS 隐式耦合

- **文件**：`frontend/src/components/TabBar/index.tsx:215-217`
- **说明**：`{favoritesCount > 0 && <span className="tab-bar__quick-badge">...}` 渲染在 `QUICK_TABS.map` 内**所有**快捷按钮上。当前 `QUICK_TABS` 仅含 ⭐ 自选，功能正确；但若未来新增其他快捷标签（如 📋 查询），自选计数角标会错误地出现在其上，且无从察觉。
- **建议**：限定到自选按钮本身，如 `type === 'favorites' && favoritesCount > 0`，将角标语义与具体快捷类型绑定。

### 🟡-2 GlobalBar「点击菜单外部关闭」交互无测试覆盖

- **文件**：`frontend/src/components/GlobalBar/index.test.tsx`
- **说明**：组件实现了「点击 ⋯ 菜单外部关闭」逻辑（`index.tsx:37-43` 的 document click handler），但测试只覆盖了 Escape 关闭（143-148 行）与「点击菜单项后关闭」（150-155 行），未覆盖「点击外部关闭」。这是该菜单的核心交互路径之一。
- **建议**：补充 `fireEvent.click(document.body)`（或 screen 外部元素）后断言 `queryByRole('menuitem')` 为空的用例；若担心与「点击 ⋯ 按钮切换」冲突，可在该用例中先展开再点击按钮外部。

### 🟡-3 文档 §7 验收标准未同步 Phase 2 状态

- **文件**：`docs/specs/navigation-redesign.md` §7
- **说明**：两处与 Phase 2 实际状态不一致：
  1. 「所有页面标题与标签标题不重复」checkbox 仍为未勾选 `- [ ]`，但说明文字已标注 Phase 1 完成 ✅；
  2. 「`npm test` 全量通过」说明仍写「1047 测试全通过（Phase 1 完成时）」，未更新为 Phase 2 的 **1065**。
- **建议**：勾选第一项；测试数更新为 1065。另「标签拖拽分离…人工走查待 Phase 3」checkbox 保持未勾选是正确的（人工验证确实待做），无需改动。

---

## 🔵 疑问

### 🔵-1 「+」新增标签按钮点击打开「设置」标签

- **文件**：`frontend/src/components/GlobalBar/index.tsx:68`（`onAddTab={openSettings}`）+ `TabBar/index.tsx:221-229`（`+` 按钮 `aria-label="新增标签"`）
- **说明**：`+` 按钮语义为「新增标签」，实际点击打开设置标签。此为历史行为（Phase 2 前 `App.tsx` 同样传 `openTab settings`），非本次回归。确认是否有意为之，还是设计上「+」应有其他新增流程（如新标签选择器）？若保持现状，建议在 `+` 按钮的 title/aria-label 上改为「设置」，避免语义误导。

### 🔵-2 FPS 徽标开启后不可点击关闭

- **文件**：`frontend/src/components/GlobalBar/index.tsx:92-94`
- **说明**：`perfVisible` 开启后徽标为纯展示 `span`（无 onClick），关闭只能经 ⋯ 菜单或 Ctrl+Shift+M。相比旧版 status-bar 的 FPS 按钮（点击即切换），交互路径变长。符合「调试降权」设计原则，确认可接受即可；若希望保留快捷关闭，可给徽标加点击切换。

### 🔵-3 文档「自选为固定标签不可拖离」与实现不一致

- **文件**：`docs/specs/navigation-redesign.md` Phase 2 实施说明 + `TabBar/index.tsx:204`
- **说明**：QUICK_TABS 打开自选标签时 `closable: true`，因此自选标签**可关闭**、也可通过标签 pill 拖拽分离（`handleTabPointerDown` 以 `!tab.closable` return，自选不命中）。文档「固定标签不可拖离」表述不准确。实际结论「移除 header handle 无功能损失」成立——因为 pill 拖拽路径仍保留，自选仍可拖离。建议文档措辞改为「自选页 header 的 data-drag-handle 移除，拖离仍可经标签 pill 完成」；或若意图是自选标签固定不可关闭/拖离，则将其 `closable` 改为 `false`。

---

## 已验证 ✅

- **全量测试**：`npm test` **96 files / 1065 tests 全部通过**，与设计文档 Phase 2 声称一致。
- **受影响测试文件**：GlobalBar(16) / App(9) / TabBar(33) / FavoritesPage(10) = 68 tests 通过。
- **旧类名清理**：`.status-bar`、`.app-title`、`.favorites-page__header`、`.favorites-page__count` 全仓库无残留引用（Grep 确认）；`repro-detach.cjs` 选择器已同步 `.global-bar__tool[title="设置"]`。
- **document.title**：`index.html` `<title>SimNow 交易终端</title>` 保留 ✅（步骤 2.3）。
- **Ctrl+Shift+M**：`App.tsx:79-88` 快捷键保留，App.test 覆盖切换 FPS 徽标 ✅（步骤 2.2）。
- **FLOATING_CHROME_H**：`= 32`，仅作用于浮动窗口自身 chrome（`TabContent/index.tsx:122-124`），与顶部全局栏高度解耦，文档「无需改动」确认成立。
- **PerfMonitor 单实例**：仅 GlobalBar 条件渲染，无重复挂载。
- **TabContent**：`settings` / `ipc-monitor` 标签类型均有 case 处理，菜单打开的标签可正常渲染。
- **全局栏高度**：GlobalBar 40px，内部 tab-bar `height:100%` 覆盖其自身 36px，总行高仍 40px，行情页 2 行 = 40 + 工具栏 ≈ 76px ≤ 80px ✅（§7 第一项）。

---

# 第二轮审查（二次审查）

- **日期**：2026-08-07
- **审查范围**：commit `9068592`（处理审查反馈）
- **结论**：**✅ 通过** — 反馈全部处理，无遗留 🔴/🟡，可进入人工验证

## 反馈处理复核

| 编号 | 级别 | 处理结果 | 复核结论 |
|------|------|----------|----------|
| 🟡-1 | 改进 | `type === 'favorites' && favoritesCount > 0` 限定角标 | ✅ 修复正确。`type` 来自 `QUICK_TABS.map` 解构，语义准确；测试断言角标 `closest('button')` 为 `aria-label="⭐ 自选"`，防止未来扩充误渲染 |
| 🟡-2 | 改进 | 新增「点击菜单外部（body）关闭菜单」用例 | ✅ 修复正确。先展开断言 `getByText('⚡FPS 监控')`，再 `fireEvent.click(document.body)` 断言消失；用文本查询避开 2 个 `menuitem` 的多元素冲突，处理得当 |
| 🟡-3 | 改进 | §7 checkbox 勾选 + 测试数 1047→1065 | ✅ 修复正确。「标题不重复」勾选 `[x]` 并补充 Phase 2 说明；「拖拽分离人工走查待 Phase 3」保持未勾选，判断正确 |
| 🔵-1 | 疑问 | 保留现状，记录理由 | ✅ 理由成立：`+` 打开设置为历史行为（非本次回归），设计文档 §3.1 定位 `+` 为新增入口图标语义，新标签选择器应作为独立迭代 |
| 🔵-2 | 疑问 | 保留现状，记录理由 | ✅ 理由成立：FPS 为调试功能，「调试降权」原则下关闭入口收敛到 ⋯ 菜单 + 快捷键，徽标定位为状态展示，交互面最小化 |
| 🔵-3 | 疑问 | 文档措辞修正 | ✅ 修正正确：实施说明改为「自选标签 `closable:true`，拖离仍可经标签 pill 完成」，与实现一致；不采纳改 `closable:false` 的判断合理（保持既有标签语义） |

## 二次验证

- **全量测试**：`npm test` **96 files / 1066 tests 全部通过**（较上轮 +1：新增「点击外部关闭」用例），与 commit 声称一致。
- **代码改动**：TabBar 角标条件限定（+3）、GlobalBar 测试（+8）、TabBar 测试断言（+3），均与回复记录一致，无新增回归。
- **文档同步**：`navigation-redesign.md` Phase 2 状态行、实施说明、§7 验收标准全部同步。

## 残留观察（不阻塞，仅备注）

- **🔵-A**：TabBar 测试夹具（`index.test.tsx:260-261 / 276-277`）仍有两个 `id: 'tab-settings'` 同数组重复 key，触发 React 重复 key 警告。属**预存在问题**（非本次 PR 引入，第一轮已确认），不影响断言结果。可顺手改为 `tab-settings-2`，或留待后续清理。
- **🔵-B**：§7「npm test 全量通过」说明为 1065，但反馈处理后实测 **1066**（新增 1 用例）。差异 1 条，可在人工验证收尾时一并更新为 1066。
