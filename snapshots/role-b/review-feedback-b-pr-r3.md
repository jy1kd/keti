# PR-R3 审查反馈：按需订阅逻辑

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

6 个文件，+216/-12 行：
- `frontend/src/hooks/useSubscriptionManager.ts` — 核心订阅管理器 Hook（138 行新文件）
- `frontend/src/modules/market/store.ts` — 添加 `visibleInstrumentIDs`、`lockedContracts` 状态
- `frontend/src/modules/market/store.test.ts` — 6 个新测试
- `frontend/src/modules/market/MarketPanel.tsx` — 集成 `useSubscriptionManager` + `onVisibleRangeChange`
- `frontend/src/components/TabBar/index.test.tsx` — 添加 `vi` import
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

62 test files, 638 tests passed ✅

---

## 发现问题

### 🟡 改进建议

**S1: `useSubscriptionManager` 缺少单元测试**

- 位置: `useSubscriptionManager.ts`（138 行新文件，无对应测试文件）
- 问题: 核心订阅逻辑（计算订阅/退订、防抖、批量操作）没有独立测试。仅通过 store.test.ts 间接覆盖了 `lockedContracts` 和 `visibleInstrumentIDs` 的状态管理。
- 建议: 添加 `useSubscriptionManager.test.ts`，测试：
  - 可见区域变化触发订阅
  - 自选合约始终在订阅列表中
  - 锁定合约永不退订
  - 滚动出视野的合约自动退订
  - 300ms 防抖正常工作
  - 批量订阅/退订调用正确
- （不阻断，可在后续 PR 中补充）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1 为可选改进
