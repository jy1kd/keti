# PR-R6 审查反馈：多选功能

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

5 个文件，+150/-21 行：
- `frontend/src/modules/market/MarketTable.tsx` — 多选逻辑（Ctrl+点击、Shift+点击、Ctrl+A）+ 行高亮
- `frontend/src/modules/market/store.ts` — `selectedContracts` 状态 + 方法
- `frontend/src/modules/market/store.test.ts` — 6 个新测试
- `frontend/src/modules/market/MarketPanel.tsx` — 接线 selectedContracts
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

65 test files, 682 tests passed ✅（query/store.test.ts 超时为资源竞争，单独运行通过）

---

## 发现问题

### 🟡 改进建议

**S1: `toggleContractSelection` 定义但未使用**

- 位置: `store.ts:128-135`
- 问题: store 中定义了 `toggleContractSelection` 方法，但 MarketTable 的 Ctrl+点击逻辑直接在组件内创建新 `Set` 并调用 `setSelectedContracts`，未使用 store 的 toggle 方法。
- 建议: 统一使用 store 方法，或移除未使用的 toggle 方法（不阻断）

**S2: `Shift+点击` 范围选择在 contracts 列表变化后可能不准确**

- 位置: `MarketTable.tsx:228-236`
- 问题: `lastClickedIndexRef` 记录的是上次点击的行索引。当 contracts 列表因搜索/过滤变化后，该索引可能指向不同的合约。
- 场景: 用户在全量列表中点击 A 合约（index=5），搜索过滤后列表变短，Shift+点击 B 合约（index=3），此时 range 3-5 可能包含不存在的行。
- 影响: 低频场景，且 `recordsRef.current[i]` 有 null 检查不会崩溃。可选优化：contracts 变化时重置 `lastClickedIndexRef`。（不阻断）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1/S2 为可选改进
