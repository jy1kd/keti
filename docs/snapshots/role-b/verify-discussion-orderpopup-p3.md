# 人工验证讨论 · 报单弹窗重构 P3（order-popup-redesign-tasks P3）

> 开发窗口：角色B
> 验证分支：`feature/order-popup-p3`
> 验证日期：2026-08-07
> 验证方式：组件代码走查 + 单测覆盖确认 + 全量回归（`npm test` / `tsc --noEmit`）
> 状态：✅ 全部通过。8 项验证全部通过，无失败项。
>
> ⚠️ 说明：验证以代码/单测为准（组件交互逻辑 + 断言覆盖）。真实 CTP 报单/撤单往返需交易时段（09:00-15:00 / 21:00-02:30）+ 登录 SimNow，留待上线前冒烟。

---

## 验证项 1：合约步进切换（步进切月正确） — ✅ 通过

**前置条件**：报单弹窗/标签页打开，参数区顶部「合约 ‹ IF2608 ›」步进行。

**验证步骤**：
1. 点击 `›` → 解析 `IF2608` 月份 +1 → `IF2609`（目标存在合约才可切）→ `setOrderForm({ instrumentID })`；弹窗打开时联动 `popupStore.instrumentID`（标题/订阅/盘口随动）
2. 点击 `‹` → `IF2607`；跨年：`IF2612` +1 → `IF2701`、`IF2601` -1 → `IF2512`
3. 点击 `▲/▼` → 同交易所品种序列（CFFEX IF→IH→IC→IM）切换，目标品种须有可交易合约
4. 期权/套利代码（`IO2608-C-4700`/`SPD…`）→ 显示 `--`、全部箭头禁用

**代码**：`contractStep.ts`（parseInstrumentCode/stepMonth/stepProduct）+ `ContractStepper.tsx`
**测试**：`contractStep.test.ts`（13）、`ContractStepper.test.tsx`（9）、`TradeParams.test.tsx` 步进集成（2）
**验收「步进切月正确」** ✅

## 验证项 2：快捷手数预设（QtyPreset） — ✅ 通过

**前置条件**：参数区「快捷 1 20 50 100」。

**验证步骤**：点击预设 → `setOrderForm({ volumeTotalOriginal })`；当前手数命中预设高亮；市价单上限 60 时点「100」→ 钳制到 60。

**代码**：`QtyPreset.tsx`
**测试**：`QtyPreset.test.tsx`（5）、`TradeParams.test.tsx` 快捷手数集成（2）
✅

## 验证项 3：盘口我方挂单量显示与点击撤单（盘口挂单可撤） — ✅ 通过

**前置条件**：弹窗打开后 10s 内 `refreshOrders` 拉取到当前合约活动挂单。

**验证步骤**：
1. 挂单按 合约 + 活动状态(1/2/3) + 限价 + 方向 聚合：`direction '0'`→买入列、`'1'`→卖出列；剩余量 = 原量 − 已成交量
2. 汇总行委买/委卖显示我方挂单笔数 `(N)`；匹配档位买卖列显示挂单量徽标（红买/绿卖）
3. 点击含我方挂单的档位 → 撤该档全部挂单（逐 orderRef `cancelOrder`），不弹点价确认框
4. 点击不含我方挂单的档位 → 仍弹确认报单（下单语义保留）

**代码**：`myOrders.ts`（aggregateMyOrders）+ `MarketDepth.tsx`（handleBuyClick/handleSellClick/cancelLevel、DepthRow 徽标）
**测试**：`myOrders.test.ts`（7）、`MarketDepth.test.tsx` P3-3 盘口挂单（5，含买/卖双向撤单）
**验收「盘口挂单可撤」** ✅

## 验证项 4：乐观渲染与失败回滚（报单失败回滚正确） — ✅ 通过

**前置条件**：点档位 → 确认框 → 确认执行。

**验证步骤**：
1. 确认瞬间档位立即显示半透明 pending 徽标（当前手数）；成功 → `refreshOrders` 拉到真实单转实态（净增量 ≥ pending 量判定），10s 兜底清理
2. 失败 → pending 回滚移除 + 顶部红条（`store.lastSubmitError`，如「资金不足」）展示原因，4s 自动消失
3. 提交挂起期间双击「确认执行」→ 仅提交一次（🔴-1 防重入，`confirmBusyRef` + ConfirmDialog `busy`）
4. pending 未转实态期间同档禁止叠加点击（🟡-1）
5. 同价既有挂单不提前移除新单 pending（🟡-3 净增量判定）

**代码**：`store.ts`（lastSubmitError + fail 出口）+ `MarketDepth.tsx`（handleConfirm/confirmBusyRef/baseline/红条）
**测试**：`MarketDepth.test.tsx` P3-4 乐观渲染（3）+ 审查修复（防重入/pending 禁点/净增量 3）+ `store.test.ts` lastSubmitError（4）+ `ConfirmDialog.test.tsx` busy（1）
**验收「报单失败回滚正确」** ✅

## 验证项 5：TradeParams 操作按钮（撤全部/平净仓强制确认） — ✅ 通过

**前置条件**：参数区底部「撤最新 撤全部 / 平净仓」。

**验证步骤**：
1. 撤最新：`refreshOrders` 取当前合约 insertTime 最新活动挂单 → 撤单；无挂单 toast 提示
2. 撤全部：点击**强制弹确认框**（警示「全部合约」）→ 确认才调 `cancelAllOrders`；取消不调用
3. 平净仓：点击**强制弹确认框**（警示「会真实下单」）→ 确认调 `reversePosition(当前合约)` → 成功刷新持仓
4. 大额订单：因每次点价必弹确认框（P1 决策，更强约束）隐含满足

**代码**：`TradeParams.tsx`（handleCancelLatest/handleCancelAll/handleFlatNet + ConfirmDialog）
**测试**：`TradeParams.test.tsx` 操作按钮（7，含撤全部确认/取消、平净仓确认/刷新持仓）
**验收「大额/撤全部/平净仓均强制确认」** ✅

## 验证项 6：账户下拉资金明细 — ✅ 通过

**前置条件**：账户栏账户号可点击。

**验证步骤**：
1. 点击账户号 → 展开下拉（createPortal 到 body）：可用资金 / 持仓盈亏 / 动态权益（千分位两位小数）
2. 点击外部 → 关闭；点击下拉面板自身 → 不关闭（🟡-6，可选中复制）
3. 账户为 null → 不可展开

**代码**：`AccountBar.tsx`（dropdownRef/portal/外部关闭）
**测试**：`AccountBar.test.tsx` 下拉（4，含字段、外部关闭、面板自身不关闭、null 不展开）
**P3 任务 #7（P2 🔵-2 延后项）** ✅

## 验证项 7：查询限频合规（轮询尊重 isPaused） — ✅ 通过

**验证步骤**：MarketDepth 报单轮询每 10s 串行；用户暂停查询时挂起本轮、不发起 CTP 报单流水查询（🟡-2）；恢复后继续。与 AccountBar（持仓→1200ms→账户→10s）节奏一致，平均 <0.2 次/秒。

**代码**：`MarketDepth.tsx` load() isPaused 分支
**测试**：`MarketDepth.test.tsx` 🟡-2 isPaused 用例、`AccountBar.test.tsx` 暂停/恢复
✅

## 验证项 8：类型与全量回归 — ✅ 通过

- 前端全量 **1047 passed / 94 files**（新增 P3 用例：contractStep 13 + ContractStepper 9 + QtyPreset 5 + myOrders 7 + MarketDepth 盘口挂单 5 + 乐观渲染 3 + 审查修复 6 + TradeParams 操作按钮/集成 13 + AccountBar 下拉 4 + ConfirmDialog busy 1 + store lastSubmitError 4）
- `tsc --noEmit`：P3 无新增错误（仅剩 main 既有 `debug-drag-accumulate.test.ts` 3 处，非 P3 引入）
- 后端未改动（108 单测不受影响）
✅

---

## 推迟项（任务清单标注「可选」，本期不验证）

- QtyPreset 右键自定义预设
- 盘口长按/右键菜单（撤该档/改价/反手）

## 总结

P3 验收四项（盘口挂单可撤 / 报单失败回滚正确 / 步进切月正确 / 大额·撤全部·平净仓强制确认）全部达成，审查 🔴/🟡 修复项（防重入、pending 禁点、isPaused、净增量、买卖按钮对齐、下拉行为）复验通过，账户资金明细（P2 🔵-2 延后项）落地。进入收尾合并。
