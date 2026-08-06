# 角色A 开发记录

> 双窗口协作快照。每 PR 单独章节记录：测试用例列表、实现进度、commit 对应内容、问题与解决方案。

---

## PR：报单弹窗重构 P1（分支 `feature/order-popup-p1-depth`）

> 设计依据：`docs/specs/order-popup-redesign.md`；任务拆分：`docs/tasks/order-popup-redesign-tasks.md`。
> P1 核心报单闭环：`MarketDepth`（三列十档 + 内嵌 QuickTradeBar）+ `TradeParams` + 点价确认报单。

### 任务清单进度

- [x] **P1-1 `MarketDepth` 骨架 + 数据接入**
- [x] **P1-2 `DepthRow` 三列语义**
- [ ] P1-3 `QuickTradeBar`（内嵌改价+买卖按钮）
- [ ] P1-4 `TradeParams` 压缩参数区
- [ ] P1-5 点价确认闭环
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
