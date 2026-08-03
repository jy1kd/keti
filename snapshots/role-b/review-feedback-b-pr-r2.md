# PR-R2 审查反馈：MarketTable 虚拟滚动 + 可见行检测

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-01
**审查轮次**: R1

---

## 改动范围

5 个文件，+136/-8 行：
- `frontend/src/modules/market/MarketTable.tsx` — 添加 `onVisibleRangeChange` 回调 + 可见行检测逻辑
- `frontend/src/modules/market/MarketTable.test.tsx` — 3 个新测试
- `frontend/src/setupTests.ts` — vtable mock 添加 `getBodyVisibleCellRange`/`selectRow`/`scrollToCell`
- `frontend/src/modules/market/MarketPanel.test.tsx` — 移除未使用的 import
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

61 test files, 609 tests passed ✅

---

## 发现问题

### 🟡 改进建议

**S1: `notifyVisibleRange` 逻辑重复**

- 位置: `MarketTable.tsx:178-194`（初始 effect）和 `MarketTable.tsx:221-238`（contracts effect）
- 问题: 两处几乎相同的可见行检测代码（getBodyVisibleCellRange → 遍历 → 回调）
- 建议: 提取为共享的 `notifyVisibleRange` 函数（初始 effect 中已定义，contracts effect 可复用）

**S2: 测试断言可加强**

- 位置: `MarketTable.test.tsx:105-114`、`MarketTable.test.tsx:135-148`
- 问题: 测试仅验证 `onVisibleRangeChange` 被调用（`toHaveBeenCalled()`），未验证返回的合约 ID 列表内容。mock 返回 `{ rowStart: 1, rowEnd: 30 }`，3 个合约全部可见，可断言具体 ID。
- 建议: 添加 `expect(calledWith).toEqual(expect.arrayContaining(['IF2608', 'au2406', 'rb2410']))`（不阻断）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1/S2 为可选改进
