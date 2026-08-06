# 角色A 开发记录

> 双窗口协作快照。每 PR 单独章节记录：测试用例列表、实现进度、commit 对应内容、问题与解决方案。

---

## PR：报单弹窗重构 P1（分支 `feature/order-popup-p1-depth`）

> 设计依据：`docs/specs/order-popup-redesign.md`；任务拆分：`docs/tasks/order-popup-redesign-tasks.md`。
> P1 核心报单闭环：`MarketDepth`（三列十档 + 内嵌 QuickTradeBar）+ `TradeParams` + 点价确认报单。

### 任务清单进度

- [x] **P1-1 `MarketDepth` 骨架 + 数据接入**
- [ ] P1-2 `DepthRow` 三列语义
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
