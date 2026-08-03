# PR-R4 审查反馈：收藏功能

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

3 个文件，+50/-16 行：
- `frontend/src/modules/market/MarketTable.tsx` — 添加收藏列（⭐/☆）+ 点击事件
- `frontend/src/modules/market/MarketPanel.tsx` — 集成收藏回调
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

63 test files, 656 tests passed ✅

---

## 发现问题

### 🟡 改进建议

**S1: `onFavoriteChange` 未处理 `addToFavorites` 失败情况**

- 位置: `MarketPanel.tsx:166-170`
- 问题: `addToFavorites` 返回 `Promise<boolean>`（订阅失败时返回 `false`），但 `onFavoriteChange` 未 `await` 结果。当 `subscribeMarket` 失败时，toast 仍显示「已收藏」，但合约实际未添加到收藏（PR-R1 修复逻辑）。
- 建议: `await addToFavorites(inst)` 并根据返回值决定是否显示 toast（不阻断，与 PR-R1 S2 同类问题）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1 为可选改进
