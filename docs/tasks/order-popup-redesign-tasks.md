# 报单弹窗重构 · 开发任务拆分

> 设计依据：[docs/specs/order-popup-redesign.md](../specs/order-popup-redesign.md)
> 拆分为 P1→P4 四阶段，每阶段遵循 TDD 双窗口流程（红→绿→重构→提交）；`OrderForm.tsx` 与 `DepthQuote.tsx` 全程保留不动，避免回归。

## 阶段总览

| 阶段 | 主题 | 核心产出 | 依赖 | 状态 |
|---|---|---|---|---|
| P1 | 核心报单闭环 | 三列十档 `MarketDepth`（含内嵌改价/买卖按钮）+ 压缩参数区 `TradeParams` + 点价确认报单 | 无 | ✅ 已完成（2026-08-06 人工验证通过） |
| P2 | 完整态与账户栏 | `AccountBar`（持仓/持盈）+ `QuoteStatsBar` + `FooterBar` + 精简/完整态切换 | P1 | ✅ 已完成（2026-08-06 人工验证通过） |
| P3 | 增强 | 合约步进、快捷手数、盘口挂单量与撤单、乐观渲染/回滚、撤最新/撤全部/平净仓 | P1（部分依赖 P2 的持仓数据） | 待开始 |
| P4 | 参数扩展（二期） | GTC/平昨/自动开平、红绿反转、Smart Order→止损单、热键浮层 | P1-P3 | 待开始 |

---

## P1 核心报单闭环

**目标**：弹窗内 `MarketDepth` 三列十档 + `TradeParams` 压缩参数区，点价弹确认→报单。沿用现有 开/平/平今 与 gfd/fok/fak，不动后端。

### 任务清单

1. **`MarketDepth.tsx` 骨架 + 数据接入**
   - 组件树：`DepthHeader` / `DepthSummaryRow` / `DepthLadder`（5×`DepthRow(ask)` + `LastPriceDivider` + 5×`DepthRow(bid)`） / 内嵌 `QuickTradeBar`
   - 数据来自 `MarketSnapshot` 五档 + 汇总行（委买/委卖总量、最新价、涨跌）；复用 `DepthQuote` 的 tick 合成兜底逻辑（无真实挂单价以买一/卖一 ± n×tick）
   - 文件：`frontend/src/modules/order/MarketDepth.tsx`（新）
2. **`DepthRow` 三列语义**
   - 买入列（红系 + 量能条）/ 价格列 / 卖出列（绿系 + 量能条）；`--` 占位弱化为次级灰；卖盘区买入列留红渐变空底、买盘区卖出列留绿渐变空底
   - 交互：买入列点击→挂买单、卖出列点击→挂卖单、**价格列点击→只填改价框（不直接下单）**
   - 量能条：背景填充宽度 = 该档量 / 十档最大量
   - 文件：`MarketDepth.tsx` 内 `DepthRow`
3. **`QuickTradeBar`（内嵌，两态均显示）**
   - 改价步进框：默认对手价/最新价，按 tickSize 步进，涨跌停/最小变动价位校验
   - `买入N手`/`卖出N手` 按钮：文字随手数联动，点击=以改价框价格+当前手数限价报单
4. **`TradeParams.tsx` 压缩参数区（左列 200px）**
   - 开平 / 投保 / 有效期 下拉（映射现有 `combOffsetFlag`/`combHedgeFlag`/`timeCondition`）+ 手数步进（校验复用 `validateVolumeWithLimit`：期货 500 / 市价 60 / 期权 100）
   - 文件：`frontend/src/modules/order/TradeParams.tsx`（新）
5. **点价确认闭环**
   - 点买入/卖出列 → 组装 `OrderIntent`（方向/价格/手数/开平/有效期）→ 弹确认框（复用 `ConfirmDialog`，展示方向/价格/手数/开平）→ 确认后 `submitOrder`
   - **每次必弹确认，不提供免确认模式**
6. **`OrderPopup` 布局重排**
   - 默认宽 540px，body 改为 `TradeParams(200px) | MarketDepth(flex)`；标题栏保留拖拽/放大为标签页/关闭
   - `OrderPopup.css` 全量重写，保留 `.order-popup__*` 类名（供 `OrderPage` 浮动模式复用）
7. **TDD 测试**
   - `MarketDepth.test.tsx`：三列渲染、tick 合成、点价回调、确认框触发、价格列不直接下单
   - `TradeParams.test.tsx`：下拉映射、手数上限校验
   - `OrderPopup.test.tsx`：布局、Esc 关闭、拖拽、既有用例回归

**验收**：点档位弹确认 → 确认后报单成功（含连续多单，成功后保留合约与手数记忆）；参数正确；现有 108 后端 + 前端 934 单测全绿（2026-08-06 审查修复 + 人工验证 3 项修复后复验）。

---

## P2 完整态与账户栏

**目标**：账户/持仓/持盈栏、完整态展开 ⑥ 行情统计栏、⑦ 底部工具条、两态切换持久化。

### 任务清单

1. **`AccountBar.tsx`**
   - 打开时触发 `fetchPositions` + `fetchAccount`，每 10s 自刷新（串行，遵守 CTP ~1 次/秒查询限制），不依赖 QueryPanel
   - 账户下拉（`AccountInfo.accountID`，超长省略）、`持仓 多|空(净)`（按 `instrumentID` 过滤 `PositionRecord`）、`持盈`（`positionProfit`，盈红亏绿）
   - 锁仓/解锁开关（复用 `api.lockPosition`）
   - 文件：`frontend/src/modules/order/AccountBar.tsx`（新）
2. **`QuoteStatsBar.tsx`（⑥，仅完整态）**
   - `今开/昨结/最高/最低/成交量/持仓量` KV，涨跌着色；复用 `OrderQuotePanel` 取值逻辑
   - 文件：`frontend/src/modules/order/QuoteStatsBar.tsx`（新）
3. **`FooterBar.tsx`（⑦）**
   - 居中 `∧/∨` 切换精简/完整态；右下 `+`（预留）
   - 文件：`frontend/src/modules/order/FooterBar.tsx`（新）
4. **两态切换与持久化**
   - `popupStore` 增加 `expanded`（精简/完整态）+ zustand `persist` 本地持久化；标题栏 `—` 按钮等价收起
   - 文件：`frontend/src/modules/order/popupStore.ts`
5. **TDD 测试**
   - `AccountBar.test.tsx`：拉取数据、持仓/持盈计算与着色
   - `popupStore.test.ts`：expanded 切换与持久化
   - `OrderPopup.test.tsx`：完整态展开渲染、AccountBar 挂载

**验收**：一键展开完整态，持仓/资金实时刷新；刷新节奏不触发 CTP 限频。

---

## P3 增强

**目标**：合约步进、快捷手数、盘口「我方挂单量」与点击撤单、乐观渲染/回滚、量能可视化完善、撤最新/撤全部/平净仓。

### 任务清单

1. **合约步进切换（`ContractStepper`）**
   - 解析合约代码切相邻月份/品种，选中同步 `setOrderForm({ instrumentID })`（联动行情订阅与标题）
   - 位于 `TradeParams` 顶部
2. **快捷手数预设（`QtyPreset`）**
   - `1 20 50 100` 分段按钮，点击即填入手数；右键自定义预设（可选子任务）
3. **盘口「我方挂单量」显示与点击撤单**
   - `refreshOrders` 按 合约+限价+方向 聚合未成交单，匹配档位显示挂单量
   - 点击含挂单量的档位 → 撤该档挂单；长按/右键 → 菜单（撤该档/改价/反手）【可选子任务】
4. **乐观渲染与失败回滚**
   - 确认报单后档位立即显示半透明 pending 态 → 收到委托回报转实态 / 失败回滚 + 顶部红条提示原因
5. **`TradeParams` 操作按钮**
   - `撤最新`：`refreshOrders` 取最新一笔 + `cancelOrder`
   - `撤全部`：二次确认 + `cancelAllOrders`
   - `平净仓`：确认 + `reversePosition`（复用 OrderPanel 现有逻辑）
6. **TDD 测试**
   - `ContractStepper.test.tsx`：月份/品种切换
   - 挂单聚合与撤单测试、pending 回滚测试、`TradeParams` 操作按钮测试
7. **账户下拉资金明细（P2 审查 🔵-2 延后项）**
   - `AccountBar` 账户号展开下拉，列出可用资金 / 持仓可用（设计 §4.2 备注）；P2 仅实现超长省略 + hover 全席位号

**验收**：盘口挂单可撤、报单失败回滚正确、步进切月正确；大额/撤全部/平净仓均强制确认。

---

## P4 参数扩展（二期）

**目标**：补齐参考方案中的参数能力，涉及映射与后端。

### 任务清单

1. **GTC 有效期**
   - `orderMapping.ts` 的 `TIME_CONDITION_TO_CTP` + `validators` 扩展（需核对当前 `'3'` 默认值语义），后端透传
2. **平昨**
   - `OFFSET_TO_CTP` 增加 `close_yesterday: '2'`，后端透传（CTP 原生字段）
3. **自动（平今优先）**
   - 后端按交易所规则在 平今/平仓 间选择（上期所/其他所差异）；前端下拉加「自动」
4. **红绿反转配置项**
   - `userPrefs` 增加开关，作用于买卖列/按钮/涨跌着色
5. **Smart Order → 止损单入口**
   - `TradeParams` 折叠模块接入现有 `StopOrderForm`，预留 TWAP/冰山扩展点
6. **热键说明浮层**
   - 标题栏 `?` 展示 `F1` 买 / `F2` 卖 / `Esc` 撤最新 / `↑↓` 调价
7. **TDD 测试**
   - GTC/平昨映射单测、自动开平后端单测、红绿反转渲染测试

**验收**：GTC/平昨/自动开平 全链路可用；红绿反转生效；止损单入口可用。

---

## 横切注意点

- **依赖纪律**：P2/P3 都依赖 P1；P3 的「平净仓」「持仓」复用 P2 的 `AccountBar` 数据或 `QueryStore`。
- **保留不动的文件**：`OrderForm.tsx`（标签页用）、`DepthQuote.tsx`（`MarketPanel` 侧栏用）、`OrderQuotePanel.tsx`（`OrderPage` 用）。
- **每次提交**：按现有 commit 规范（`docs/specs` 同步更新），提交信息标注 PR 号或阶段。
- **回退安全**：`OrderPopup.css` 保留 `.order-popup__*` 类名，`OrderPage` 浮动模式视觉不回退。
