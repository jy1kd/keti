# 审查回复 · 报单弹窗重构 P2（order-popup-redesign-tasks P2）

> 开发窗口：角色B
> 审查反馈：`docs/snapshots/role-b/review-feedback-orderpopup-p2.md`
> 修复分支：`feature/order-popup-p2`
> 回复日期：2026-08-06

## 🔴-1 锁仓/解锁开关语义错误 — ✅ 已修复（采用审查「方案 A」）

**方案**：后端 `/api/order/lock` 为单向锁仓（反方向开同等数量仓位、不平原有持仓），无解锁端点。按审查「方案 A」去掉「解锁」方向，改为**一次性「锁仓」按钮**（`AccountBar.tsx`）：

- 点击**强制弹确认框**（`ConfirmDialog`：展示合约 + warning「将在反方向开同等数量仓位，不平原有持仓，锁仓会真实下单」），确认后才调 `lockPosition`
- 按钮**永不变为「解锁」**，不存在「二次点击重复锁仓」的路径；锁仓量由用户显式确认，不再随持仓翻倍
- 成功后 `toast.success('锁仓成功（已反方向开仓）')` 并 `fetchPositions` 刷新持仓，反映反方向开仓后的仓位变化
- 确认框打开状态同步 `popupStore.confirmOpen`（Esc 语义，见 🟡-2）

**必补测试**（`AccountBar.test.tsx`）：
- 「取消不调用 lockPosition」（取消不触发任何下单）
- 「确认锁仓才调用 lockPosition，锁仓后仍为『锁仓』（无解锁方向重复锁仓）」
- 「锁仓成功后刷新持仓」（点击前捕获基准计数，断言确认后 `refreshPositions` 多一次）

## 🔴-2 tsc 类型错误 — ✅ 已修复

`LockResponse` 增加 `message?: string`（`api.ts:285-288`，与 `ReverseResponse` 错误形态对齐）。`npx tsc --noEmit` **exit 0**，生产构建 `tsc && vite build` 不再失败。

> 审查指出「自验证声明 954 全绿未覆盖 tsc」——接受，本次修复后已把 `tsc --noEmit` 纳入复验基线。

## 🟡-1 AccountBar 与 QueryPanel 双重轮询 — ✅ 已修复

`AccountBar.tsx` 的 `load` 循环读取 `useQueryStore.getState().isPaused`，**暂停时挂起本轮**、仅调度下一轮 10s 检查，恢复后继续（与 QueryPanel 的 `refreshAll` 首行 `if (isPaused) return` 语义对齐）。彻底消除「用户暂停查询后弹窗仍持续拉取」的分叉。

**测试**：`AccountBar.test.tsx` 新增「暂停期间 t=0 与整个周期不发起任何查询；恢复后下一轮周期继续拉取」。

## 🟡-2 P1 承诺的 `popupStore.confirmOpen` — ✅ 已落地

P1 审查 🔵-1 承诺的「确认框打开时 Esc 先取消确认框，再关弹窗」本期实现：

- `popupStore` 增加 `confirmOpen` 瞬态（默认 false，**不持久化**）+ `setConfirmOpen`
- `OrderPopup` Esc 守卫：`confirmOpen` 为 true 时返回，不关闭整个弹窗、不丢失待确认报单意图
- `ConfirmDialog` 增加 **Esc → onCancel**（与「取消」按钮/遮罩点击等价；共享组件，OrderPanel 的确认框同样受益）
- `MarketDepth` 点价确认、`AccountBar` 锁仓确认打开时均同步 `confirmOpen`

**测试**：`popupStore.test.ts`（confirmOpen 瞬态与不持久化）、`OrderPopup.test.tsx`（集成：点价弹确认 → Esc 取消确认框且弹窗保持 / 确认框关闭后 Esc 恢复关弹窗）、`ConfirmDialog.test.tsx`（新，4 用例含 Esc）。

## 🟡-3 锁仓为下单操作但无确认框 — ✅ 已修复

与 🔴-1 一并处理：锁仓点击前强制弹确认框（对齐设计 §5「下单即确认」原则），见 🔴-1 说明。

## 🔵-1 QuoteStatsBar 最高/最低固定着色语义 — 📝 答复

**确认可接受**。着色逻辑与 `OrderQuotePanel.tsx:89-93` 完全一致，属面板既有约定：最高恒 up（红）、最低恒 down（绿）。设计 §4.6「涨跌方向着色」在实现中用于**最新价相对昨结的涨跌**（`QuoteStatsBar` 涨跌项按 `last - preSettlementPrice` 动态着色），最高/最低两项固定着色是行业惯例（最高价/最低价本身即区间极值，通常以红/绿标识方向）。深跌日「最高 < 昨结」时最高仍显红属该约定下的已知语义，与全站盘口面板保持一致，不做单独反转。

## 🔵-2 账户「下拉」交互范围 — 📝 答复

**下拉资金明细不属于 P2 验收**。任务清单 P2-1 仅要求「账户下拉（超长省略）」，实现为超长省略（>12 位截断 9 位 + `…`）+ hover `title` 显示全席位号，满足验收。设计 §4.2 备注的「下拉列出可用资金/持仓可用」属增强项，**延后至 P3**，已同步在任务文件 P3 任务清单注明（见下）。

---

## 测试结果

- 全量前端回归：**964 passed / 88 files**（修复前 954/87，+10 用例：ConfirmDialog 新文件 4 + AccountBar isPaused 1 + popupStore confirmOpen 1 + OrderPopup Esc 集成 2 + 锁仓确认 3 − 旧锁仓开关 1）
  - `AccountBar.test.tsx` 11（+3 锁仓确认语义 +1 isPaused，−1 旧开关）
  - `OrderPopup.test.tsx` 24（+2 Esc 语义）
  - `popupStore.test.ts` 9（+1 confirmOpen 瞬态）
  - `ConfirmDialog.test.tsx` 4（新）
- `npx tsc --noEmit` **exit 0**
- 后端 108 单测未涉及（无后端改动）

## 结论

🔴-1（锁仓语义）、🔴-2（类型错误）已修复并各单独 commit、含补测试；🟡-1~3 全部处理；🔵-1~2 已答复（🔵-2 延后项已在任务文件注明）。请审查窗口做二次审查。
