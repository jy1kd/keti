# PR-R7 审查反馈：右键菜单

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

7 个文件，+327/-53 行：
- `frontend/src/components/ContextMenu/index.tsx` — 通用右键菜单组件（72 行新文件）
- `frontend/src/components/ContextMenu/styles.css` — 菜单样式（50 行新文件）
- `frontend/src/components/ContextMenu/index.test.tsx` — 6 个测试（62 行新文件）
- `frontend/src/hooks/useContractContextMenu.ts` — 扩展多选菜单支持
- `frontend/src/modules/market/MarketPanel.tsx` — 集成单选/多选右键菜单
- `frontend/src/modules/market/MarketTable.tsx` — 右键事件处理 + 多选检测
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

67 test files, 701 tests passed ✅

---

## 发现问题

### 🔴 阻断性

**B1: `onClose` 传入空函数，Escape 键无法关闭菜单**

- 位置: `MarketPanel.tsx:262`（单选菜单）、`MarketPanel.tsx:289`（多选菜单）
- 问题: 两处 `<ContextMenu onClose={() => {}}>` 传入空函数。ContextMenu 组件内部的 Escape 键处理（line 39-41）调用 `onClose()`，但空函数不执行任何操作，导致按 Escape 键无法关闭菜单。
- 测试掩盖: 测试使用 `vi.fn()` 作为 `onClose`，能检测到调用，但无法发现生产环境中空函数的问题。
- 建议: 传入实际关闭函数：
  ```tsx
  // 单选菜单
  <ContextMenu onClose={() => setContextMenu(null)} ... />
  // 多选菜单
  <ContextMenu onClose={() => setMultiSelectMenu(null)} ... />
  ```
  或使用统一关闭函数 `closeMenus`（`setContextMenu(null); setMultiSelectMenu(null)`）

---

### 🟡 改进建议

**S1: 批量收藏未处理 `addToFavorites` 异步结果**

- 位置: `MarketPanel.tsx:292-297`
- 问题: `multiSelectMenu.instrumentIDs.forEach((id) => { addToFavorites(inst) })` 在 `forEach` 中调用异步函数但未 `await`。如果部分合约订阅失败，toast 仍显示全部收藏成功。
- 建议: 使用 `Promise.all` 并检查结果（不阻断，与 PR-R1 S2 同类问题）

---

## 审查结论

❌ **需要修改** — B1 必须修复后再审

修复建议：
1. 将 `<ContextMenu onClose={() => {}}>` 改为传入实际关闭函数
2. 建议提取 `closeMenus` 统一关闭函数：`const closeMenus = () => { setContextMenu(null); setMultiSelectMenu(null) }`
