# 人工验证讨论 · 报单弹窗重构 P1（task-order-popup-p1）

> 开发窗口：角色B
> 验证分支：`feature/order-popup-p1-depth`
> 验证日期：2026-08-06
> 状态：✅ 全部通过（2026-08-06 复验）。验证项 1 一轮失败（3 项）修复后复验通过；验证项 2-10 同步验证通过。

---

## 验证项 1：盘口骨架 + 数据接入 — ✅ 复验通过

一轮反馈 3 项全部修复（commit `9b7ea7e`），复验通过：

1. 委买/委卖 固定为 1 → SimNow 真实薄盘数据（仅第 1 档有量），聚合口径稳健化后复验确认汇总与盘口一致
2. 买卖栏被裁剪 → `.qtb` `flex: 0 0 auto` 修复，复验通过（无需放大弹窗即可完整显示）
3. 手数框溢出画面 → 步进器 flex 收缩 + `overflow-x` 兜底修复，复验通过（左栏参数区完整在弹窗内）

## 验证项 1：盘口骨架 + 数据接入 — ❌ 一轮失败（3 项）→ 已修复，待复验

### 用户反馈 3 项问题

> 「1.深度行情委买和委卖固定为1。2.深度行情下方买卖功能大小不合适，必须放大弹窗才能显示完整。3.深度行情左方手数一栏展示框太长，展示不完全，已经超出画面。」

### 问题 1：委买/委卖固定为 1 — ✅ 数据准确，聚合口径已稳健化

**结论**：非计算错误，是 SimNow 测试环境的真实数据形态。

**证据链**：
- PR-12 验证记录（`docs/dev-records/role-b/verify-discussion-pr12.md` #4）确认：SimNow 五档行情**只有第 1 档有有效价/量**，2-5 档 CTP 返回 `DBL_MAX`（后端 `field_mapping._sanitize_price` 会置 0 → 0 价 0 量）。
- 因此 `委买/委卖 = 买一量/卖一量`（各 1 手），汇总正确反映盘口。

**代码改动（口径稳健化）**：`MarketDepth.tsx` 汇总从「仅统计有效价档位量」（`l.valid`）改为「统计所有档位量之和」（`l.volume > 0`），与行内展示口径一致；`DepthRow.volText`/量能条 `pct`/`maxVol` 同步统一。真实 CTP 数据下结果不变（无效价档位量必为 0），但语义更严谨：只要有量的档位（无论价是否有效）都计入委买/委卖。

**新增测试 2 条**（`MarketDepth.test.tsx` 35→37）：
- 「SimNow 真实薄盘：仅第 1 档有量时 委买/委卖 = 第 1 档量」— 固化该数据形态下汇总正确
- 「委买/委卖汇总计入所有档位量（含合成价档带量），与行内同步」— 固化新口径

### 问题 2：深度行情下方买卖栏被裁剪，必须放大弹窗才完整 — ✅ 已修复

**根因**：`.qtb`（QuickTradeBar）在 `.market-depth` flex 列布局中无 `flex: 0 0 auto`（默认可压缩），且 `.depth-row` 行有 `min-height: auto` 下限。弹窗高度受限（`max-height: calc(100vh-24px)` / 用户缩小窗口）时，十档行先顶住压缩、买卖栏被 flex 负空间挤压 → 按钮被 `overflow: hidden` 裁掉。

**修复**（`MarketDepth.css`）：
- `.qtb` 加 `flex: 0 0 auto` — 买卖栏固定高度，永不压缩裁剪
- `.depth-row` 加 `min-height: 0` — 高度受限时十档行优先压缩让位给买卖栏
- `.qtb` 轨道改 `minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)` + `.qtb__btn` 加 `min-width:0/nowrap/ellipsis` — 防「买入500手」文字撑宽栏位横向溢出

### 问题 3：深度行情左方手数一栏展示框太长/超出画面 — ✅ 已修复

**根因**：`TradeParams` 手数行在 200px 左栏中横向溢出：
- `.tp-row`/`.tp-stepper` 未设 `min-width: 0`，flex 子项不随容器收缩
- `.tp-stepper__input` 未覆盖全局 `input{padding:5px 10px}`，number 输入框固有宽度把参数列撑出弹窗 → `overflow-x` 默认 visible → 刺出画面

**修复**（`TradeParams.css` + `OrderPopup.css`）：
- `.tp-row`/`.tp-stepper` 加 `min-width: 0`；`.tp-stepper__input` 加 `width:0; min-width:0; max-width:100%` + `padding:0 4px`（覆盖全局 padding），宽度完全由 flex 决定
- `.tp-row__select` 加 `max-width:100%`
- `.order-popup__params` 加 `overflow-x: hidden` 兜底 — 内容超宽时栏内裁剪，不再刺出弹窗/画面

### 回归结果

- 前端全量 **934 passed / 85 files**（修复前 932，+2）
  - `MarketDepth.test.tsx` 37（+2）
- `tsc --noEmit` 通过（exit 0）
- CSS 布局类修复以用户复验为准（jsdom 不计算布局，无自动断言）

## 验证项 2：DepthRow 三列语义 — ✅ 通过

三列（买入|价格|卖出）渲染、列语义硬绑定（买入列点击→买单、卖出列→卖单、价格列→只填改价框不直接下单）、完全无效档不可点击、`--` 占位弱化、量能条宽度 = 该档量/十档最大量——均由 `MarketDepth.test.tsx`（DepthRow 三列语义 / 量能条 describe 块）覆盖并实测通过。

## 验证项 3：QuickTradeBar — ✅ 通过

改价框默认对手价/最新价、▲▼ tick 步进、涨跌停夹紧、非 tick 整数倍对齐、买入/卖出按钮文字随手数联动、点按钮以改价框价格报单——`MarketDepth.test.tsx`（QuickTradeBar describe 块）全覆盖，实测通过。

## 验证项 4：TradeParams 参数区 — ✅ 通过

开平/投保/有效期三下拉映射（combOffsetFlag/combHedgeFlag/timeCondition）、手数 ± 步进最小 1、期货 500/市价 60/期权 100 上限提示与超限报错、达上限禁用 `+`（🟡-4）——`TradeParams.test.tsx` 11 例覆盖，实测通过。

## 验证项 5：点价确认闭环 — ✅ 通过

点买/卖列→必弹确认框（方向/价格/手数/开平）→确认后 `submitOrder`；价格列点击只填改价框不直接下单；取消不报单。`MarketDepth.test.tsx`「点价确认闭环」用例 + `OrderPopup.test.tsx` 覆盖，实测通过。

## 验证项 6：连续两单（🔴-1） — ✅ 通过

连续两单真实 `submitOrder` 集成用例：第一单成功后保留 合约/开平/投保/有效期/手数，仅清空价格；第二单入参正确（`instrumentID='IF2608'`、`limitPrice` 取当帧）——实测通过。

## 验证项 7：OrderPopup 布局 — ✅ 通过

540px 双栏（参数区 200-220px | 三列十档盘口）、标题栏拖拽/放大为标签页/× 关闭、Esc 关闭、自由缩放 8 方向手柄、空快照空态——`OrderPopup.test.tsx` 17 例 + 人工复验通过。

## 验证项 8：改价框 tick 保护（🟡-1） — ✅ 通过

初始对手价 → 点价格列改价 → 同合约 tick 更新不覆写改价框 → 切换合约重新跟随默认价——用例覆盖，实测通过。

## 验证项 9：价格精度统一（🟡-2） — ✅ 通过

真实档/合成档/最新价统一 `formatTickPrice` 按 tickSize 还原（0.2 → 1 位小数），测试断言已同步——实测通过。

## 验证项 10：平盘涨跌显示（🔵-4） — ✅ 通过

涨跌为 0 显示 `0.0`（不再 `+0.0`），涨红/跌绿/平灰带箭头——`MarketDepth.test.tsx` 覆盖，实测通过。

---

## 总结

全部 10 项人工验证通过。前端全量 **934 passed / 85 files**，`tsc --noEmit` 通过，后端 108 单测未涉及（P1 无后端改动）。P1 验收达成，进入收尾合并。
