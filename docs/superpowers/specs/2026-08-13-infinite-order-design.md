# 无限下单（Infinite Order）功能设计方案

> 面向 SimNow 模拟交易终端（浏览器 Web 应用）新增的无限下单面板设计。
> 参考 `无限下单功能设计方案.md`（无限易界面分析），适配本项目 React + TypeScript + Vite + FastAPI + ctp-python 技术栈，并严格收敛到 PRD 现有范围（仅手动报单，不做自动化、不做风控系统）。

---

## 一、定位与范围

### 1.1 功能定位

无限下单是面向**单一合约**的高频点价面板，价格阶梯从**跌停到涨停**，任意价位可点击报单 / 撤单。它是**新增的独立标签页**，与现有五档报单窗口并存，互不影响。

### 1.2 范围边界（防漂移）

| 项 | 决策 |
|---|---|
| 五档报单窗口（`MarketDepth` / `OrderForm` / `OrderQuotePanel`） | **不动，保持原样** |
| 后端 | **零改动**。`insert` / `cancel` / `cancel_all` / `reverse` / `lock` / 查询接口全部已存在 |
| 自动化 | **不做**（网格循环、Smart Order、短线精灵一律排除） |
| 风控 | **不做系统级风控**；仅保留现有前后端数量上限 / 保护价合规校验 |
| 行情数据 | 仅用现有 `MarketSnapshot` 五档深度 + 涨跌停价 + 最新价；**无全深度盘口数据** |
| 持仓列 | 阶梯内**不设按价持仓列**（CTP 持仓是合约级聚合，非按价）；持仓放顶部账户栏 |

### 1.3 核心增量

1. **全新完整阶梯组件**：跌停 → 涨停，窗口化渲染。
2. **组装独立页面**：顶部账户栏 + 左侧参数区 + 中央阶梯 + 右侧查询功能区。

其余全部复用既有能力。

---

## 二、页面布局

```
┌───────────────────────────────────────────────────────────────────┐
│ 顶部：合约搜索 | AccountBar(账户号 持仓 持盈 资金) | 涨跌停价        │
├──────────────┬────────────────────────────────┬───────────────────┤
│              │  列头: 可撤 | 买入量 | 价格 | 卖出量                │
│  左侧参数区   │  ┌──────────────────────────┐  │  右侧功能区        │
│  TradeParams │  │   完整价格阶梯 (跌停→涨停)  │  │  持仓 | 委托 | 成交│
│  (复用)      │  │   窗口化渲染 ~50行可见      │  │  (复用查询组件)    │
│  开平/投保/   │  │   最新价行高亮居中         │  │                   │
│  有效期/手数/ │  │   买卖量柱 + 我方挂单徽标  │  │                   │
│  快捷手数     │  │   滚动跟随最新价           │  │                   │
│  撤最新/撤全部 │  └──────────────────────────┘  │                   │
│  平净仓       │  底部：快捷买卖条 (复用 QuickTradeBar 逻辑)          │
└──────────────┴───────────────────────────────────────────────────┘
```

- 顶部 `AccountBar`（复用）+ `ContractSearch`（复用）——**不改内部实现**。
- 左侧 `TradeParams`（复用）——交互与五档窗口同源，但**状态隔离**（见第六节）。
- 右侧 Tab：持仓 / 委托 / 成交，复用 `Position.tsx` / `OrderFlow.tsx` / `TradeFlow.tsx`。

---

## 三、完整价格阶梯（核心新组件 `InfiniteLadder`）

### 3.1 数据来源

- 价格轴：`MarketSnapshot.upperLimitPrice` / `lowerLimitPrice` / `priceTick`。
- 挂单量：`bidPrice1-5` / `askPrice1-5` 填充对应档位量（其余价位为空）。
- 可撤量：`aggregateMyOrders`（复用 `myOrders.ts` 纯函数）按限价聚合我方活动挂单。

### 3.2 四列定义

| 列 | 内容 | 交互 |
|---|---|---|
| 可撤 | 我方该价挂单剩余量（买/卖分色） | 点击 → 撤该价对应方向挂单 |
| 买入量 | 买盘挂单量 + 量柱（仅五档附近有值，其余空） | 点击 → 以该价买（按当前开平参数） |
| 价格 | 等宽右对齐 | 点击 → 填底部快捷改价框 |
| 卖出量 | 卖盘挂单量 + 量柱 | 点击 → 以该价卖 |

### 3.3 行状态

- 最新价行：蓝色高亮。
- 买一 / 卖一行：加粗边框。
- 涨跌停行：红色 / 绿色边框。
- 有我方挂单行：叠加黄色徽标。

### 3.4 渲染 / 性能

跌停 → 涨停可达 300 ~ 1000+ 行（如黄金 tick 0.02、涨停 ±5% ≈ 1000 行），必须：

- **窗口化**：仅渲染可视区 ~50 行 + 上下缓冲，不渲染全量。
- **跟随最新价**：最新价行保持居中自动滚动；用户手动滚动时暂停跟随，3 秒无操作恢复跟随。
- **复用渲染思路**：沿用现有 `DepthRow` 的量柱 / tick 对齐 / 我方徽标，但抽为**新组件**，不触碰 `MarketDepth` 十档实现。

---

## 四、下单交互与确认机制

### 4.1 点价语义

| 操作 | 行为 |
|---|---|
| 点击买入量列 | 以该价位 + 当前开平参数 + 当前手数 → 买单 |
| 点击卖出量列 | 以该价位 → 卖单 |
| 点击可撤列（有我方挂单） | 撤该价位对应方向挂单（复用 `handleCancelOrder`） |
| 点击价格列 | 仅填底部快捷改价框，不直接下单 |

### 4.2 开平处理

由左侧 `TradeParams` 的「开 / 平 / 平今」控制，点买 / 卖列按当前开平参数报单（与现有五档窗口一致，不引入左键 = 开 / 右键 = 平的额外约定）。

### 4.3 确认机制

- **首版（Phase 1）**：点价**必弹确认框**（复用 `ConfirmDialog`），与现有五档窗口「每次必弹确认，不提供免确认模式」一致，零新风险。
- **Phase 2 可选**：设置里加「免确认一键下单」开关（默认关），匹配无限易速度卖点，但引入误触风险，需新增设置配置面。

### 4.4 热键

复用 `useHotKeys` + `userPrefs.hotKeys`：`↑/↓` 价格档移动、`←/→` 手数增减、`B`/`S` 买 / 卖、`C` 撤最新、`Esc` 取消 / 关闭弹窗。

### 4.5 下单反馈

乐观渲染：点价确认瞬间档位出现半透明 pending → 回报到转实态，失败回滚 + 顶部红条（与五档窗口同套逻辑）。

---

## 五、状态管理（隔离是关键）

### 5.1 问题

五档窗口和无限下单页可能同时打开，若共用 `useOrderStore.orderForm` 会互相覆盖开平 / 手数 / 方向。

### 5.2 方案

无限下单页**不读写 `useOrderStore`**，新建独立轻量 store `useInfiniteOrderStore`：

```
useInfiniteOrderStore:
  instrumentID / direction / combOffsetFlag / combHedgeFlag /
  timeCondition / volumeTotalOriginal / volumeStep
  submitOrder()   // 本地构建 OrderRequestForm → convertOrderRequest → api submitOrder
```

### 5.3 复用的（只读 / 全局，无冲突）

- `useMarketStore`（行情快照）
- `useQueryStore`（orders / positions / account + fetch / handleCancelOrder / handleCancelAll）
- `useContractsStore`、`myOrders.aggregateMyOrders`（纯函数）、`useHotKeys`、`useUserPrefsStore.hotKeys`
- `validators` / `orderMapping` / `priceCalc`

### 5.4 不动的

- `useOrderStore`（五档窗口专属）
- `MarketDepth` / `OrderForm` / `OrderQuotePanel` 等五档窗口组件

---

## 六、数据流

- **行情流**：无限下单页打开 → 注册合约锁定（走 `useTabContractLocks`，同 `KLinePage`）→ `useMarketWs` 推送快照 → `InfiniteLadder` 用 `upperLimitPrice` / `lowerLimitPrice` / `priceTick` 重算完整价格轴 + 五档量 + 量柱。
- **报单流**：点价 → 确认 → `useInfiniteOrderStore.submitOrder()` → `POST /api/order/insert` → 乐观 pending → `order_return` WS → `query.upsertOrder` → 定期 `fetchOrders` → `aggregateMyOrders` → 可撤列 / 我方徽标刷新。
- **撤单流**：点可撤列 → `query.handleCancelOrder` → `POST /api/order/cancel` → 乐观标记 canceled → `fetchOrders` 刷新。
- **持仓 / 账户流**：顶部 `AccountBar` + 右侧 `Position` / `TradeFlow` 复用各自现有自刷新逻辑，不改动。

---

## 七、错误处理与边界

| 场景 | 处理 |
|---|---|
| 无行情快照（未订阅 / 未连接） | 阶梯空态 + 顶部提示「未订阅行情」，禁止报单 |
| 涨跌停价无效（CTP 返回 DBL_MAX） | 无法算完整轴，回退五档（沿用现有 tick 合成兜底逻辑） |
| 浮点 tick 精度（0.2 / 0.05） | 价格轴用 `Math.round(price / tick)` 整数档位计算，避免浮点累积误差 |
| 极端品种轴长（黄金 tick 0.02 涨停 ±5% ≈ 1000 行） | 窗口化渲染兜底，不渲染全量 |
| 报单失败 | 乐观 pending 回滚 + 顶部红条（复用五档窗口同套逻辑） |
| 可撤列点击时订单已成交 / 已撤（回报乱序） | `cancelOrder` 失败 toast + `fetchOrders` 刷新校正 |
| 数量上限 / 市价保护价 | 复用 `validateVolumeWithLimit` + 后端 Pydantic 权威校验兜底 |
| 合约切换 | 清空阶梯、重置滚动、`useTabContractLocks` 自动迁移订阅 |
| 断线重连 | 复用 `useMarketWs` / `useConnectionPoll` 现有机制，数据自动恢复 |
| 我方挂单刷新节奏 | 10s 自刷新（对齐 `MarketDepth`），遵守 CTP ~1 次/秒查询限频 |
| 热键与输入框冲突 | 阶梯区焦点时生效（对齐 `useHotKeys` 现有语义） |

---

## 八、测试策略

- **单元测试**：价格轴计算（tick 对齐、涨跌停边界、浮点精度、轴长上限）；新 store `useInfiniteOrderStore`（submitOrder 校验分支、参数隔离性）。
- **组件测试**：`InfiniteLadder`（窗口行数、最新价高亮、量柱、我方徽标、涨跌停行边框）；交互闭环（点买/卖列→确认→报单、点可撤列→撤单、乐观 pending 成功转实态 / 失败回滚）。
- **集成测试**：与五档窗口并存不冲突（两窗口改各自参数互不影响）；合约切换、断线重连后的阶梯恢复。
- **回归**：五档报单窗口 `MarketDepth` / `TradeParams` 现有测试全绿（证明未破坏现有功能）。

---

## 九、迭代路线图

### Phase 1（首版）
- [ ] 独立标签页类型注册 + 路由 + `useTabContractLocks` 接入
- [ ] `useInfiniteOrderStore`（隔离参数 + submitOrder）
- [ ] `InfiniteLadder`（完整价格轴 + 窗口化 + 量柱 + 我方徽标 + 最新价跟随）
- [ ] 页面组装（AccountBar + TradeParams + 阶梯 + 右侧查询功能区）
- [ ] 点价报单 / 可撤列撤单 / 乐观渲染 / 热键
- [ ] 上述测试全绿 + 五档窗口回归

### Phase 2（可选）
- [ ] 免确认一键下单开关（设置配置面 + 默认关）
- [ ] 拖拽改价、右键菜单
- [ ] 键盘价格档微调优化

---

## 十、风险与注意

1. **CTP 仅五档深度**：完整阶梯中买卖量柱只在五档附近有值，其余为空——这是数据限制，非缺陷，需在 UI 上诚实呈现（空档量柱留白，不误导）。
2. **轴长极端值**：tick 极细品种轴长可达上千行，窗口化是硬约束，不可省略。
3. **状态隔离**：`useOrderStore` 与 `useInfiniteOrderStore` 必须严格隔离，避免同开两窗口时参数串扰。
4. **SimNow 环境差异**：测试时注意模拟环境五档仅第 1 档常有真实量（2-5 档 CTP 返回 DBL_MAX），量柱在真实数据下可能仅显示买一/卖一。
5. **查询限频**：我方挂单 / 持仓 / 账户刷新必须遵守 CTP ~1 次/秒限频（沿用 10s 串行自刷新节奏）。

---

*文档版本：v1.0 | 生成日期：2026-08-13*
