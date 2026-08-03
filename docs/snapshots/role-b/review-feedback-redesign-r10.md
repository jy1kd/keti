# PR-R10 审查反馈

**审查窗口** | **审查时间**：2026-08-03 | **审查轮次**：第 1 轮

---

## 改动范围

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/TabContent/index.tsx` | +62 | TabContent 组件 |
| `frontend/src/components/TabContent/styles.css` | +9 | 样式 |
| `frontend/src/components/TabContent/index.test.tsx` | +190 | 测试 |
| `docs/tasks/task-redesign.md` | +11/-5 | 状态更新 |

总计：+267 / -5 行

---

## 审查结论：✅ 通过

无阻断性问题。发现 1 个改进建议，不阻塞合入。

---

## 🔴 阻断性问题

无。

---

## 🟡 改进建议

### 🟡-1：tabpanel 缺少 tabIndex，键盘用户无法聚焦

**文件**：`frontend/src/components/TabContent/index.tsx:49-55`

**问题**：WAI-ARIA Authoring Practices 建议 tabpanel 元素设置 `tabIndex={0}`，使键盘用户可以通过 Tab 键聚焦到面板内容区域。当前面板 `<div>` 没有 `tabIndex` 属性，键盘用户在标签栏操作后无法直接跳转到内容区。

**建议**：在面板 `<div>` 上添加 `tabIndex={0}`：

```tsx
<div
  key={tab.id}
  role="tabpanel"
  aria-labelledby={tab.id}
  aria-hidden={!isActive}
  className="tab-content__panel"
  tabIndex={0}
  style={{ display: isActive ? 'block' : 'none' }}
>
```

**优先级**：低。PR-R11 替换为实际页面组件后，面板内会有可聚焦元素（按钮、输入框等），此问题自然缓解。可在 PR-R11 中一并处理。

---

## 🔵 疑问确认

### 🔵-1：renderTabContent 返回占位文本

**文件**：`frontend/src/components/TabContent/index.tsx:10-31`

**确认**：`renderTabContent` 对所有标签类型返回 `<span>` 占位文本（如 `<span>行情</span>`）。JSDoc 注释明确说明「PR-R11（App.tsx 重构）会将占位文本替换为实际页面组件」。✅ 符合设计意图，非遗漏。

### 🔵-2：display:none 状态保持策略

**文件**：`frontend/src/components/TabContent/index.tsx:54`

**确认**：使用 `style={{ display: isActive ? 'block' : 'none' }}` 实现面板切换，隐藏的面板保留在 DOM 中。这是标准的「状态保持」方案，React reconciliation 不会销毁隐藏组件。✅ 与 PR 描述和验收标准一致。

### 🔵-3：CSS 变量依赖

**文件**：`frontend/src/components/TabContent/styles.css`

**确认**：样式文件仅使用 `flex: 1`、`overflow: hidden`、`width: 100%`、`height: 100%`，不依赖 CSS 变量。✅ 无外部依赖问题。

---

## 测试质量

18 个测试全部通过 ✅，覆盖：

| 分组 | 用例数 | 覆盖内容 |
|------|--------|----------|
| 渲染 | 3 | 容器元素、role=tabpanel、多标签面板数量 |
| 活跃标签可见性 | 3 | 活跃面板可见、非活跃面板隐藏、切换后新面板可见 |
| 标签类型渲染 | 8 | 全部 8 种 TabType（it.each 参数化） |
| 状态保持 | 1 | 切换再切回后面板仍在 |
| 无障碍 | 3 | aria-hidden、aria-labelledby |

**测试亮点**：
- `getAllByRole('tabpanel', { hidden: true })` 正确获取所有面板（含隐藏的）
- `it.each` 参数化覆盖全部标签类型，避免重复代码
- 状态保持测试通过 `rerender` 模拟真实切换流程

---

## 设计对齐

| 设计要求 | 实现状态 |
|----------|---------|
| 根据 activeTabId 渲染对应内容 | ✅ `useTabStore` 读取 `activeTabId`，`isActive` 控制显示 |
| 支持 8 种标签类型 | ✅ switch-case 覆盖 `market/favorites/order/query/kline/options/ipc-monitor/settings` |
| 切换时保持状态 | ✅ display:none 隐藏而非卸载 |
| 懒加载（可选） | ⏭️ 未实现（占位文本无需懒加载，PR-R11 可按需补充） |
