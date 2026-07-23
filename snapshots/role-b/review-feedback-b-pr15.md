# PR-15 Code Review 反馈

## 第 1 轮审查（初审）

审查分支：`feature/pr-15-quick-actions`
审查 commit：`684d49c .. c396d31`（8 commits）
审查时间：2026-07-23

---

### 🔴 阻断性问题（必须修改）

1. **【OrderPanel.tsx:66-73】BatchCancel 展示的订单数据使用 hardcode 假值**
   - 原因：`getOrders()`（api.ts:260-268）返回的 `OrdersResponse.orders` 仅包含 4 个字段（`orderRef`, `instrumentID`, `direction`, `orderStatus`），但 `BatchCancel` 组件的 `OrderItem` 接口需要 7 个字段（含 `combOffsetFlag`, `limitPrice`, `volumeTotalOriginal`）。当前在 `handleBatchCancel` 中用 hardcode 值填充（`combOffsetFlag: 'open'`, `limitPrice: 0`, `volumeTotalOriginal: 0`），导致用户看到的报单列表显示错误的价格和数量。
   - 建议：
     - **方案A（推荐）**：扩展 `getOrders()` 的返回类型，要求后端 `/api/query/orders` 返回完整字段
     - **方案B**：`BatchCancel` 的 `OrderItem` 中 `combOffsetFlag`、`limitPrice`、`volumeTotalOriginal` 改为可选字段，未提供时不渲染对应列

2. **【QuickKeys/index.tsx:46-49】handleReset 无确认直接保存**
   - 原因：用户误点"恢复默认"时，快捷键立即被覆盖并持久化到 localStorage，没有撤销机会
   - 建议：`handleReset` 先只更新 `localHotKeys` 状态（恢复 UI 为默认值），不调用 `onSave`；用户需点"保存"按钮才持久化

3. **【QuickActions/index.tsx:18-52】handleReverse / handleLock 大量重复代码**
   - 原因：两个函数有完全相同的 try/catch 结构、501 判断、loading 管理逻辑，仅文案不同。违反 DRY 原则
   - 建议：提取公共函数 `executeAction(action, fn, successMsg, errorPrefix)`

---

### 🟡 改进建议

1. **【BatchCancel/index.tsx:73-81】串行撤单性能问题**
   - 建议：当前逐个 `await onCancelOrder(orderRef)` 串行，如选中 10 个订单需等待 10 次。改为 `Promise.allSettled` 并发执行

2. **【OrderPanel.tsx:94-97】handleSaveHotKeys 调用 4 次 store 方法**
   - 建议：在 `userPrefsStore` 中加 `setHotKeys(hotKeys)` 方法，一次批量更新后统一持久化，避免触发 4 次 re-render

3. **【api.ts】`cancelAllOrders` 已定义但未被任何组件使用**
   - 建议：如果后续使用加 TODO，无计划则删除

4. **【QuickKeys/index.tsx】快捷键捕获未做去重校验**
   - 建议：保存时检测是否有重复键绑定，提示用户冲突

---

### 🔵 疑问确认

1. **【useHotKeys.ts:35-40】部分 hotKeys 时的静默失效**
   - 疑问：如果 `hotKeys` prop 仅传入 `{ buy: 'x' }`（缺少 sell/cancel），未配置的键应回退到 `DEFAULT_KEYS` 还是静默失效？

2. **【QuickActions/index.tsx:7】`onReverse` / `onLock` 类型为 `Promise<unknown>`**
   - 疑问：为何不用更具体的返回类型（如 `Promise<{ success: boolean }>`）？`unknown` 导致调用方无法安全使用返回值

---

### 审查结论

❌ 需要修改后再审（3 个 🔴 阻断性问题）

下一步：请切回开发窗口，输入审查反馈进行修复
