# 审查回复 · 报单弹窗重构 P3

> 开发窗口回复，对应 `review-feedback-orderpopup-p3.md`
> 修复分支：`feature/order-popup-p3`
> 回复日期：2026-08-07

## 处理结论

| 项 | 级别 | 处理 |
|---|---|---|
| 🔴-1 确认按钮双击重复报单 | 阻断 | ✅ **已修复** + 防重入测试 |
| 🟡-1 pending 档位未禁止叠加点击 | 建议 | ✅ 已修复 |
| 🟡-2 轮询不尊重 isPaused | 建议 | ✅ 已修复 |
| 🟡-3 pending 被同价既有挂单提前移除 | 建议 | ✅ 已修复（净增量判定） |
| 🟡-4 买卖按钮未走 tick 对齐/夹紧 | 建议 | ✅ 已修复 |
| 🟡-5 账户下拉字段与任务清单不符 | 建议 | ✅ 任务文件 #7 字段表述已同步 |
| 🟡-6 下拉点击面板自身关闭 | 建议 | ✅ 已修复 |
| 🔵-1 平净仓实际为一键反向 | 疑问 | 📝 确认命名差异可接受（保留） |
| 🔵-2 撤全部范围与设计不符 | 疑问 | ✅ 设计文档 §4.3 措辞已同步 |
| 🔵-3 价格浮点 Map key | 疑问 | 📝 本期接受，记录理由 |
| 🔵-4 confirmOpen 全局单布尔 | 疑问 | 📝 接受边界，记录理由 |

---

## 🔴-1 确认按钮双击重复报单 — 已修复

**修复内容**
1. `MarketDepth.handleConfirm` 增加 `confirmBusyRef`（useRef 同步锁）：提交期间双击「确认执行」直接忽略，不依赖 React 渲染时序（state 更新是批量的，仅靠 state 无法拦截同一事件循环内的二次点击）
2. `ConfirmDialog` 新增可选 `busy` prop：busy 时禁用 确认/取消 按钮，且 Esc 不再触发取消（提交期间不丢 pending）；MarketDepth 确认框传 `busy={confirmBusy}`
3. 尝试整体放入 `try/finally`，保证无论成功/失败都释放锁并关闭确认框

**新增测试**
- `MarketDepth.test.tsx`：提交挂起期间双击「确认执行」→ `submitOrder` 仅调用 1 次
- `ConfirmDialog.test.tsx`：busy 时 确认/取消 禁用、Esc 不触发取消

## 🟡-1 pending 档位禁止叠加点击 — 已修复

`handleBuyClick/handleSellClick` 在实态撤单判定之后，追加「该价该向 pending 量 > 0 → 忽略点击」守卫（`pendingByPrice`）。pending 转实态或 10s 清理前，同档叠加点击不再弹新确认框。

测试：pending 显示期间再点同档买入列 → 确认框数量仍为 1、`submitOrder` 仅 1 次。

## 🟡-2 轮询尊重 isPaused — 已修复

`MarketDepth` 的 10s `fetchOrders` 轮询 `load()` 开头读 `useQueryStore.isPaused`，暂停时挂起本轮（对齐 AccountBar 语义）。

测试：`isPaused=true` 时 advanceTimers 10s → `refreshOrders` 未被调用。

## 🟡-3 pending 被同价既有挂单提前移除 — 已修复

`PendingOrder` 增加 `baseline`（报单前该价该向既有挂单量）；转实态判定改为「净增量（当前量 − baseline）≥ pending 量」而非「量 > 0」。同价既有历史挂单不再导致新单 pending 被立即移除。

测试：既有卖一挂单 2 手时挂新卖单 3 手 → 聚合未变时 pending 保留；刷新后净增量 3 ≥ 3 → pending 移除、实态徽标 5 手。

## 🟡-4 买卖按钮未走 tick 对齐/夹紧 — 已修复

`QuickTradeBar` 提取 `align(raw)`（解析 → tick 对齐 → 涨跌停夹紧）；`handleBuy/handleSell` 先走 `align` 再 `onBuy/onSell`，不再依赖「blur 先于 click」的事件顺序。blur/Enter 的 `commit` 复用同一 `align`。

测试：输入超涨停 `4705` 未 blur 点买入 → `onBuy(4700)`；输入 `4696.55` 未 blur 点卖出 → `onSell(4696.6)`。

## 🟡-5 账户下拉字段与任务清单不符 — 文档同步

`AccountInfo`（`types.ts:209-224`）无「持仓可用」字段，实现以 可用资金 / 持仓盈亏 / 动态权益 三字段替代。**任务文件 #7 字段表述已同步更新**（注明「AccountInfo 无持仓可用字段，以持仓盈亏替代」），与实现一致。

## 🟡-6 下拉点击面板自身关闭 — 已修复

`AccountBar` 为 portal 下拉增加 `dropdownRef`，外部关闭的 `mousedown` 判断改为「账户区 **或** 下拉面板」`contains`。点击面板内不再关闭（可选中/复制资金数字）。

测试：点击下拉面板自身 → 下拉保持打开。

---

## 🔵 疑问答复

### 🔵-1 平净仓实际为一键反向 — 确认保留

`reversePosition`（后端 `order.py:528`）语义为「平掉全部持仓 + 反向开仓」，与按钮标签「平净仓」存在命名差异。确认框警告文案已透明说明（「将平掉当前合约全部净持仓并反向开仓」），符合 P3 任务清单 #5「平净仓：确认 + reversePosition」的要求。**保留现状**，后续如需精确「只平净仓」可新增后端语义。

### 🔵-2 撤全部范围 — 设计文档已同步

后端 `cancel_all` 为全部合约。实现确认框文案「将撤销所有未成交报单（全部合约）」是正确对齐后端真实行为的。**设计文档 §4.3 措辞已更新**为「撤全部未成交报单（全部合约，后端 `cancel_all` 语义）」。

### 🔵-3 价格浮点 Map key — 本期接受

快照价与报单流水价经 JSON round-trip 后二进制等值，实际匹配风险低；且整数 tick 存储是 P1 既有 `QuickTradeBar`/`MarketDepth` 的全局约定（`Math.round(n / tick) * tick`），单独在 P3 改会造成前后不一致。**本期接受**，建议后续与 P1/P2 一并做整数化重构。

### 🔵-4 confirmOpen 全局单布尔 — 接受边界

弹窗 + 标签页同合约并存时两个实例的 `setConfirmOpen` effect 互相覆盖，属极端边界场景；常规单窗口使用无影响（P1/P2 已约定此模式）。**接受该边界**，不为此引入多实例化改造。

---

## 验证

- 前端全量 **1047 单测全绿**（1039 → 1047，新增 8 例：防重入 1 + pending 禁点 1 + isPaused 1 + 净增量 1 + 买卖按钮对齐 2 + ConfirmDialog busy 1 + 下拉面板 1）
- `tsc --noEmit` 无 P3 新增错误（仅剩 main 既有 `debug-drag-accumulate.test.ts` 3 处，非 P3 引入）

## 状态

任务文件 P3 状态 → **修复完成待二次审查**
