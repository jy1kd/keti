# 人工验证讨论 · 报单弹窗重构 P1（task-order-popup-p1）

> 开发窗口：角色B
> 验证分支：`feature/order-popup-p1-depth`
> 验证日期：2026-08-06
> 状态：验证项 1 一轮失败（3 项），已修复待复验；验证项 2-10 待复验后逐一记录

---

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

### 待复验

以上 3 项修复后请重新验证；通过后继续验证项 2-10。

---

## 验证项 2：DepthRow 三列语义 — ⏳ 待复验
## 验证项 3：QuickTradeBar — ⏳ 待复验
## 验证项 4：TradeParams 参数区 — ⏳ 待复验
## 验证项 5：点价确认闭环 — ⏳ 待复验
## 验证项 6：连续两单（🔴-1） — ⏳ 待复验
## 验证项 7：OrderPopup 布局 — ⏳ 待复验
## 验证项 8：改价框 tick 保护（🟡-1） — ⏳ 待复验
## 验证项 9：价格精度统一（🟡-2） — ⏳ 待复验
## 验证项 10：平盘涨跌显示（🔵-4） — ⏳ 待复验
