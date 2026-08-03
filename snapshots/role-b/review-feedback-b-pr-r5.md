# PR-R5 审查反馈：表格内搜索功能

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

8 个文件，+315/-20 行：
- `frontend/src/modules/market/useContractSearch.ts` — 搜索 Hook（66 行新文件）
- `frontend/src/modules/market/useContractSearch.test.ts` — 7 个测试（147 行新文件）
- `frontend/src/modules/market/MarketPanel.tsx` — 集成搜索栏 + Ctrl+F 快捷键
- `frontend/src/modules/market/styles.css` — 搜索栏样式
- `frontend/src/components/TabContent/index.tsx` — 移除未使用 import
- `frontend/src/components/TabContent/index.test.tsx` — 移除未使用常量
- `frontend/src/hooks/useSubscriptionManager.ts` — 移除未使用 PRELOAD_ROWS
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

64 test files, 666 tests passed ✅

---

## 发现问题

### 🟡 改进建议

**S1: 清空按钮受 300ms 防抖影响**

- 位置: `MarketPanel.tsx:181-186`
- 问题: 点击清空按钮（✕）调用 `setSearchQuery('')`，该方法有 300ms 防抖。导致点击后输入框立即清空，但搜索结果延迟 300ms 才恢复显示全部合约，体验不一致。
- 建议: 在 `useContractSearch` 中暴露 `clearQuery` 方法，直接 `setQuery('')` 跳过防抖（不阻断）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1 为可选改进
