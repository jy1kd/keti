# PR-R9 审查反馈

**审查窗口** | **审查时间**：2026-08-03 | **审查轮次**：第 1 轮

---

## 改动范围

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/TabBar/index.tsx` | +50 | TabBar 组件 |
| `frontend/src/components/TabBar/styles.css` | +86 | 样式 |
| `frontend/src/components/TabBar/index.test.tsx` | +180 | 测试 |

总计：+316 / -0 行（不含 task-redesign.md 状态更新）

---

## 审查结论：❌ 不通过

发现 2 个阻断性问题需要修复。

---

## 🔴 阻断性问题

### 🔴-1："+" 按钮无 onClick 处理

**文件**：`frontend/src/components/TabBar/index.tsx:41-48`

**问题**：`+` 按钮渲染了但没有绑定 `onClick` 事件，点击后无任何响应。

**PR-R9 验收标准**明确要求：「"+" 按钮能打开新标签页」。当前实现仅渲染了一个空壳按钮。

**修复建议**：按钮应触发一个回调（如 `onAddTab`），或直接调用 `openTab` 打开默认标签类型（如 `query`）。具体行为需与后续 PR-R10（TabContent）对齐。如果暂时无法确定打开什么，至少需要一个 `onAddTab` prop 或注释说明待实现。

### 🔴-2：关闭按钮使用 `<span>` 而非 `<button>`

**文件**：`frontend/src/components/TabBar/index.tsx:31-42`

**问题**：关闭按钮使用 `<span role="button">` 而非原生 `<button>` 元素。这导致：

1. **键盘不可操作**：`<span>` 不响应 `Enter` / `Space` 键，键盘用户无法关闭标签
2. **缺少 `type="button"`**：如果改为 `<button>`，需要显式设置 `type="button"` 防止表单提交
3. **样式问题**：`<span>` 没有浏览器默认的 button reset 样式，需依赖 CSS 覆盖

**修复建议**：改为 `<button type="button" aria-label="关闭标签" className="tab-bar__close" onClick={...}>×</button>`。

---

## 🟡 改进建议

### 🟡-1：标签栏缺少键盘导航

**文件**：`frontend/src/components/TabBar/index.tsx:15`

**问题**：`role="tablist"` 容器不支持 WAI-ARIA 标准的键盘导航模式（左/右箭头切换标签、`Home`/`End` 跳转首尾标签）。当前只能用鼠标点击切换。

**建议**：在容器上添加 `onKeyDown` 处理，支持左/右箭头切换标签。这是 WAI-ARIA tablist pattern 的推荐做法，不阻塞合入但建议后续 PR 补充。

### 🟡-2：tablist 容器缺少 `aria-label`

**文件**：`frontend/src/components/TabBar/index.tsx:15`

**问题**：`<div className="tab-bar" role="tablist">` 没有 `aria-label`，屏幕阅读器用户无法知道这是什么 tablist。

**建议**：添加 `aria-label="标签栏"` 或 `aria-label="Tab Bar"`。

---

## 🔵 疑问确认

### 🔵-1：CSS 变量是否全局定义

**文件**：`frontend/src/components/TabBar/styles.css`

**确认**：已验证 `--bg-secondary`、`--accent`、`--border-color`、`--text-secondary`、`--text-primary`、`--text-muted` 均在 `frontend/src/assets/styles/global.css` 中定义。✅ 无问题。

---

## 测试质量

测试覆盖全面（13 个用例），涵盖：
- 渲染（容器、单标签、多标签）
- 标签切换（onClick 调用、aria-selected 状态）
- 关闭按钮（显示/隐藏、onClick 调用、不冒泡）
- 新增按钮（存在性）
- 无障碍（role=tablist、role=tab、aria-selected）

**注意**：`openTab` 在测试中被 mock 但从未被调用——这与 🔴-1 问题一致：组件中未使用 `openTab`。

---

## 第 2 轮审查

**审查时间**：2026-08-03

### 改动范围

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/TabBar/index.tsx` | +101 | 修复后（+51 行） |
| `frontend/src/components/TabBar/styles.css` | +86 | 无变化 |
| `frontend/src/components/TabBar/index.test.tsx` | +304 | 修复后（+124 行） |

### 逐条验证

| # | 问题 | 修复状态 | 验证说明 |
|---|------|---------|---------|
| 🔴-1 | "+" 按钮无 onClick | ✅ 已修复 | 新增 `onAddTab` 可选 prop，onClick 绑定到该回调 |
| 🔴-2 | 关闭按钮用 `<span>` | ✅ 已修复 | 改为 `<button type="button">`；外层 tab 改为 `<div role="tab" tabIndex={0}>` 避免 button 嵌套，添加 Enter/Space 键支持 |
| 🟡-1 | 缺少键盘导航 | ✅ 已修复 | tablist 添加 `onKeyDown`，支持 ArrowLeft/Right（循环）、Home/End |
| 🟡-2 | 缺少 aria-label | ✅ 已修复 | 添加 `aria-label="标签栏"` |

### 测试质量

23 个测试全部通过（原 13 个 + 新增 10 个），覆盖：
- 渲染（3）、标签切换（3）、关闭标签（5）
- 新增标签按钮（2）、键盘导航（6）、无障碍（5）

### 审查结论：✅ 通过

所有阻断性问题已修复，改进建议已采纳。PR-R9 可以进入下一步。
