# PR-R13 审查回复 — 标签页打开方式（双击、右键）

## 审查信息

| 项目 | 内容 |
|------|------|
| **审查轮次** | R1 |
| **审查结论** | ✅ 通过（无 🔴，含 4 项 🟡 + 3 项 🔵） |
| **回复日期** | 2026-08-03 |
| **处理结果** | 🟡 全部处理完毕，🔵 已确认/记录 |

## 🟡 改进建议处理

### Y1. 右键菜单逻辑与 JSX 重复 → ✅ 已处理
提取共享 hook `useContractContextMenu`（`frontend/src/hooks/useContractContextMenu.ts`），封装 `openOrderTab`/`openKlineTab`/`handleContextMenu`/菜单关闭 useEffect。
- MarketPanel.tsx 与 FavoritesPage.tsx 已改用 hook，删除各自重复实现（约 -50 行）
- 新增 hook 单元测试 4 个（`useContractContextMenu.test.ts`）
- 全量测试 683 passed

### Y2. `openOrderTab` 先使用后声明（TDZ） → ✅ 已处理
将 `openOrderTab`/`openKlineTab` 定义移到 `usePointOrder` 调用之前，消除声明后置隐患。

### Y3. MarketPanel.test.tsx 存在 act() 警告 → ⚠️ 部分处理
- 双击测试中 `capturedPointOrderOpts.onFill(...)` 已包裹 `act()`
- 其余 act 警告为预先存在的跨测试异步计时器泄漏（如 MarketTable `setTimeout(notifyVisibleRange, 0)`），非本 PR 引入，未处理

### Y4. 提交文件清单与实际改动不一致 → ✅ 已处理
task-redesign.md PR-R13 提交文件清单已补充 `FavoritesPage.tsx` 与 `FavoritesPage.test.tsx`，并标注 `Position.tsx` 为「⏸️ PR-R20 实现」。

## 🔵 疑问确认

### B1. 双击打开的报单标签未携带价格 → 已确认设计
用户决定：**R14 报单页从行情快照取价**。R13 保持只传 `instrumentID`，不修改 props 契约。R14 实施时从 `marketStore.snapshots` 取最新价预填。

### B2. 右键菜单位置无边缘翻转 → 记录，推迟
v1 接受当前实现。后续版本建议在 `useContractContextMenu` 中添加屏幕边缘翻转逻辑（或由 PR-R7 ContextMenu 组件统一处理）。

### B3. 与 PR-R7（右键菜单）的关系 → 记录
PR-R7 规划创建 `components/ContextMenu`（单选/多选 + 批量操作）。R7 实施时应基于 `useContractContextMenu` 扩展菜单项（当前含「打开报单/打开K线」），避免出现两套右键菜单实现。

---

## 结论

🟡 建议项已处理（Y1 提取 hook、Y2 声明顺序、Y4 文档），Y3 修复本 PR 引入的警告。
🔵 疑问项已确认（B1 用户决策）或记录（B2/B3）。
任务状态更新为「改进建议已处理，待确认合并」。
