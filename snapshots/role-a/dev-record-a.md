# 角色A 开发记录

> 双窗口协作快照。每 PR 单独章节记录：测试用例列表、实现进度、commit 对应内容、问题与解决方案。

---

## PR：报单弹窗重构 P1（分支 `feature/order-popup-p1-depth`）

> 设计依据：`docs/specs/order-popup-redesign.md`；任务拆分：`docs/tasks/order-popup-redesign-tasks.md`。
> P1 核心报单闭环：`MarketDepth`（三列十档 + 内嵌 QuickTradeBar）+ `TradeParams` + 点价确认报单。

### 任务清单进度

- [x] **P1-1 `MarketDepth` 骨架 + 数据接入**
- [x] **P1-2 `DepthRow` 三列语义**
- [x] **P1-3 `QuickTradeBar`（内嵌改价+买卖按钮）**
- [x] **P1-4 `TradeParams` 压缩参数区**
- [x] **P1-5 点价确认闭环**
- [ ] P1-6 `OrderPopup` 布局重排
- [ ] P1-7 TDD 测试（含全量回归）

### P1-1 实现记录

**测试用例（`MarketDepth.test.tsx`，8 个，全绿）**

1. 渲染三列表头 买入/价格/卖出
2. 渲染 5 卖档 + 5 买档（data-testid `ask-1..5` / `bid-1..5`）
3. 渲染档位价格与数量：卖档卖出列显示卖量、买档买入列显示买量
4. 渲染汇总行：委买总量 / 最新价+涨跌 / 委卖总量（150 / 175 / 4695 / +5.0）
5. 卖盘在上、买盘在下：自上而下 `ask-5 → ask-1 → bid-1 → bid-5`
6. tick 合成兜底：无真实挂单价以最新价为基准 ± n×priceTick
7. tick 合成兜底：以真实买一/卖一为基准向外推档位
8. 空快照显示空态 `--`

**新增文件**

- `frontend/src/modules/order/MarketDepth.tsx` — 组件骨架：`DepthHeader` / `DepthSummaryRow` / `DepthLadder`（5×ask 反转渲染 + `LastPriceDivider` + 5×bid）/ `DepthRow`；`resolveDepth` 复用 DepthQuote 的 tick 合成兜底逻辑
- `frontend/src/modules/order/MarketDepth.css` — 三列 grid 布局，行高 34px，量能条/点击语义留给 P1-2/P3
- `frontend/src/modules/order/MarketDepth.test.tsx` — 红→绿完成

**Commit**

- `feat(task-order-popup-p1): MarketDepth 骨架 + 数据接入（三列十档渲染 + tick 合成兜底）`

**问题与解决方案**

- 无。tick 合成逻辑直接对齐 `DepthQuote.tsx` 现有实现（不修改该文件，保留给 MarketPanel 侧栏）。

### P1-2 实现记录

**测试用例（`MarketDepth.test.tsx` 追加 8 个，全绿，累计 16）**

- `DepthRow` 三列语义（直接测组件）：
  1. 买入列点击 → `onBuyClick(本档价)`，不触发卖单（列语义硬绑定）
  2. 卖出列点击 → `onSellClick(本档价)`，不触发买单
  3. 价格列点击 → `onPriceClick(本档价)`，不触发买/卖（只填改价框，不直接下单）
  4. 完全无效档（无价无兜底）点击不触发任何回调
- 量能条与占位（经 MarketDepth）：
  5. 买档买入列量能条宽度 = 该档量/十档最大量（`--vol-pct`）
  6. 卖档卖出列量能条宽度 = 该档量/十档最大量
  7. 有效档对侧空列量能条为 0%
  8. 无量占位 `--` 弱化为次级灰（`depth-row__muted`）

**改动**

- `MarketDepth.tsx`：导出 `ResolvedLevel`/`DepthRow`；`DepthRow` 增加 `maxVol` + `onBuyClick`/`onSellClick`/`onPriceClick`（可选，任务#5 由 MarketDepth 接线）；点击按 真实价/合成兜底价 可点，完全无效档不可点；量能条 `--vol-pct` 内联样式
- `MarketDepth.css`：量能条背景填充、卖档买入列红渐变空底、买档卖出列绿渐变空底、`--` muted 灰

**Commit**

- `feat(task-order-popup-p1): DepthRow 三列语义（买/卖/价点击语义 + 量能条 + -- 占位灰）`

**问题与解决方案**

- 量能条基准取「十档最大量」（含买/卖全部有效档）；无效档（合成兜底价）仅价格可点、量显示 `--`。

### P1-3 实现记录

**测试用例（`MarketDepth.test.tsx` 追加 9 个，全绿，累计 25）**

1. 默认显示对手价（卖一价），按 tick 精度格式化（`4696.0`）
2. ▲ 步进 +tick、▼ 步进 -tick
3. 输入超涨停价 → 提交后夹紧到涨停价
4. 输入低于跌停价 → 提交后夹紧到跌停价
5. 输入非 tick 整数倍 → 提交后对齐到 tick
6. 买入/卖出按钮文字随手数联动（`买入2手`/`卖出2手`）
7. 点买入 → `onBuy(改价框价格)`；点卖出 → `onSell(改价框价格)`
8. 手数 < 1 时买卖按钮禁用
9. 快照为空时输入框与按钮禁用

**改动**

- `MarketDepth.tsx`：导出 `QuickTradeBar`。价格步进框默认对手价（卖一）/最新价，▲▼ 按 tick 步进，blur/Enter 提交做「tick 对齐 + 涨跌停夹紧」；`买入N手`/`卖出N手` 文字随手数联动，手数 < 1 / 快照空时禁用
- `MarketDepth.css`：`.qtb` 三列 grid（买|价|卖）、步进按钮、输入框样式

**Commit**

- `feat(task-order-popup-p1): QuickTradeBar 改价步进 + 买卖按钮（tick 对齐 + 涨跌停夹紧）`

**问题与解决方案**

- TS 报 `e.target` 类型（EventTarget 无 value）：onBlur/onKeyDown 改用 `e.currentTarget.value`。
- 步进通过「re-parse 已格式化字符串」避免浮点累积误差。

### P1-4 实现记录

**测试用例（`TradeParams.test.tsx`，10 个，全绿）**

1. 渲染 开平/投保/有效期 三个下拉与手数步进
2. 开平下拉当前值 = combOffsetFlag，选项映射正确（open/close/close_today）
3. 选择开平 → `setOrderForm({ combOffsetFlag })`
4. 选择投保 → `setOrderForm({ combHedgeFlag })`
5. 选择有效期 → `setOrderForm({ timeCondition })`
6. 手数 +/- 步进（最小 1）
7. 期货限价单上限 500 手提示
8. 市价单上限 60 手提示
9. 期权限价单上限 100 手提示
10. 手数超限 → 错误提示（`数量不能超过500手` + `tp-hint--error`）

**改动**

- `TradeParams.tsx`（新）：紧凑参数区；开平/投保/有效期下拉 + 手数步进；`validateVolumeWithLimit` 兜底校验；`instrumentID` 可选覆盖（默认取 orderForm）
- `TradeParams.css`（新）：紧凑行布局、下拉、步进控件、错误提示样式

**Commit**

- `feat(task-order-popup-p1): TradeParams 压缩参数区（下拉 ×3 + 手数步进 + 数量上限校验）`

**问题与解决方案**

- 无。数量上限直接复用 `validateVolumeWithLimit` 与 OrderForm 同一套规则，保证前后一致。

### P1-5 实现记录

**测试用例（`MarketDepth.test.tsx` 追加 10 个，全绿，累计 33）**

1. 改价框默认显示对手价（卖一）
2. 点买档买入列 → 弹确认框，展示 方向/价格/手数/开平
3. 点卖档卖出列 → 确认框方向为卖出，价格为本档卖价
4. 确认 → 提交报单（方向 buy + 本档价 + 当前手数）
5. 取消 → 不提交，确认框关闭
6. 价格列点击 → 不弹确认框（不直接下单），改价框同步该价
7. QuickTradeBar 买入 → 弹确认框（改价框价格 + 当前手数）
8-10. （QuickTradeBar 受控改造回归）显示当前值、快照空禁用、onChangePrice 上报

**改动**

- `MarketDepth.tsx`：`MarketDepth` 接入 `useOrderStore`（orderForm/setOrderForm/submitOrder）；点买/卖列与快捷买卖按钮 → 锁定 `OrderIntent`（方向/价格/手数/开平/有效期）→ 必弹 `ConfirmDialog` → 确认后同步 orderForm 并 `submitOrder`；价格列点击 → `setQuickPrice`（只填改价框，不直接下单）；渲染 `QuickTradeBar`（受控 value/onChangePrice）
- `MarketDepth.tsx`：`QuickTradeBar` 由非受控改为受控（`value` + `onChangePrice`），涨跌停夹紧/tick 对齐后经回调上报
- `ConfirmDialog/index.tsx`：对话框加 `data-testid="confirm-dialog"`（纯增量，供测试定位）

**Commit**

- `feat(task-order-popup-p1): 点价确认闭环（必弹确认框 + submitOrder + 价格列只填改价框）`

**问题与解决方案**

- tsc：`OrderIntent` 的 `combOffsetFlag`/`timeCondition` 用 `OrderRequestForm` 联合类型，避免 string 不兼容。
- act 警告：确认提交是 async（await submitOrder 后 setIntent(null)），测试用 `await act(async () => {})` 刷新微任务。
