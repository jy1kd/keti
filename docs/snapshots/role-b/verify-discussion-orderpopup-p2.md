# 人工验证讨论 · 报单弹窗重构 P2（order-popup-redesign-tasks P2）

> 开发窗口：角色B
> 验证分支：`feature/order-popup-p2`
> 验证日期：2026-08-06
> 状态：✅ 全部通过（2026-08-06 人工验证通过）。7 项全部验证通过，无一轮失败项。

---

## 验证项 1：弹窗打开（精简态）+ AccountBar 渲染 — ✅ 通过

打开报单弹窗：标题栏 → 账户栏（顶部）→ 参数区 + 三列盘口 → 底部工具条；账户栏右侧为一次性「锁仓」按钮（非开关）；默认精简态不渲染行情统计栏。

- 代码：`OrderPopup.tsx` 布局 `AccountBar → OrderTradeBody → {expanded && QuoteStatsBar} → FooterBar`；`AccountBar.tsx` 顶部渲染
- 测试：`OrderPopup.test.tsx`「渲染账户栏 AccountBar（精简态也显示）与底部工具条 FooterBar」「精简态默认不渲染 QuoteStatsBar」；`AccountBar.test.tsx` 全组
- 人工复验通过

## 验证项 2：一键展开/收起完整态 + 持久化 — ✅ 通过

FooterBar `∧/∨` 展开/收起 QuoteStatsBar；标题栏 `—` 等价收起；展开状态写入 `popupStore.expanded`（zustand persist，partialize 仅 expanded），重开弹窗/刷新恢复。

- 测试：`OrderPopup.test.tsx`「FooterBar ∧/∨ 切换」「标题栏 — 按钮收起完整态」「完整态展开状态持久化到 localStorage」；`popupStore.test.ts`「toggleExpanded/setExpanded/持久化/rehydrate」
- 人工复验通过

## 验证项 3：AccountBar 持仓/资金展示与着色 — ✅ 通过

账户号超长省略（>12 位截断 9 位 + `…`）+ hover `title` 全席位号；持仓按当前合约过滤、`posiDirection '2'/'3'` 求和 多|空(净)；持盈盈红亏绿（`--color-up`/`--color-down`），平盘中性。

- 测试：`AccountBar.test.tsx`「账户 ID 与当前合约持仓 多|空(净)、持盈」「持仓仅统计当前合约」「持盈盈红亏绿」「无持仓时净仓为 0 中性着色」「账户 ID 超长省略」
- 人工复验通过

## 验证项 4：AccountBar 数据刷新节奏（限频合规） — ✅ 通过

打开即触发 `fetchPositions` + `fetchAccount`，每 10s 串行自刷新（持仓 → 1200ms → 账户 → 10s → 下一轮，平均 <0.2 次/秒）；暂停查询时挂起本轮、恢复后继续（`isPaused`）。

- 测试：`AccountBar.test.tsx`「挂载时触发持仓与账户串行拉取（查询间 1200ms 延迟）」「每 10s 串行自刷新」「暂停查询时挂起轮询」
- 验收「刷新节奏不触发 CTP 限频」达成：串行 + 1200ms 间隔对齐 QueryPanel 节奏
- 人工复验通过

## 验证项 5：锁仓一次性操作 + 强制确认 — ✅ 通过

锁仓为下单操作（反方向开同等数量仓位、不平原有持仓），点击**强制弹确认框**（展示合约 + warning「锁仓会真实下单」）；取消不调用 `lockPosition`；确认才报单 + toast「锁仓成功（已反方向开仓）」+ 刷新持仓；按钮**永不变为「解锁」**（后端 `lockPosition` 单向锁仓、无解锁端点，杜绝重复反向开仓）。

- 测试：`AccountBar.test.tsx`「锁仓为下单操作：点击先弹确认框，取消不调用 lockPosition」「确认锁仓才调用 lockPosition，锁仓后仍为『锁仓』（无解锁方向重复锁仓）」「锁仓成功后刷新持仓」
- 人工复验通过

## 验证项 6：确认框 Esc 优先取消（不关弹窗） — ✅ 通过

弹窗内确认框打开时按 Esc → 取消确认框（`ConfirmDialog` 自身 Esc→onCancel），弹窗保持、不丢失待确认报单意图；无确认框时按 Esc → 关闭弹窗。共享组件 Esc 处理器对 OrderPanel 属纯增强（其无自有 Esc 监听）。

- 测试：`OrderPopup.test.tsx`「确认框打开时按 Esc 取消确认框而非关闭弹窗」「确认框关闭后 Esc 恢复关闭弹窗」「按 ESC 关闭弹窗」；`ConfirmDialog.test.tsx`「按 Esc 触发 onCancel」
- 人工复验通过

## 验证项 7：QuoteStatsBar 行情统计栏内容与着色 — ✅ 通过

完整态渲染 `今开 / 昨结 / 最高 / 最低 / 成交量 / 持仓量` 六项 KV，全部来自 `MarketSnapshot`；最高恒 up（红）/ 最低恒 down（绿），涨跌项相对昨结动态着色（对齐 `OrderQuotePanel` 既有约定）。

- 测试：`QuoteStatsBar.test.tsx`（5 用例：六项渲染、着色、formatPrice 精度 0.2→1 位小数）
- 人工复验通过

---

## 总结

全部 7 项人工验证通过。前端全量 **964 passed / 88 files**，`tsc --noEmit` exit 0，后端未改动（108 单测不受影响）。P2 验收三项（一键展开完整态 / 持仓资金实时刷新 / 刷新节奏不触发 CTP 限频）全部达成，进入收尾合并。
