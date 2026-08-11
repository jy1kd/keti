# 报单/K线无合约空态界面 + 手数步进跟随快捷 — 设计

日期：2026-08-11
状态：已确认（用户逐节批准：§1 空态界面 / §2 手数步进 / §3 测试与边界）

## 背景

1. **无合约空态**：未在行情表格选择合约时，通过 `+` 菜单打开报单/K线标签，页面只显示「请在行情表格中选择合约后打开报单标签/K线标签」占位文案，无任何可交互内容。期望：打开后即呈现与「已选合约」一致的完整界面，合约数据用 `--` 占位，合约搜索栏提示「请选择合约」，可在标签内直接搜索选择合约。
2. **手数步进**：参数区手数步进器 `+/-` 固定步长 1；快捷手数栏 `1/20/50/100` 点击只填手数。期望：点击快捷 `20` 后，手数设为 20 且此后 `+/-` 按 20 步进，直到点击其他快捷或手动输入（手动输入不改步进）；快捷按钮持续高亮作为当前步进基准。

## 决策记录（用户选择）

- 空态覆盖**停靠标签 + 浮动窗**两种形态。
- 手数步进：**跟随最后点击的快捷**（`volumeStep` 粘性），高亮跟随步进基准而非手数值。
- 手动输入手数**不改变**步进。
- 方案：空态直接复用现有组件（去掉 `instrumentID` 空态守卫），步进基准存 order store。

## §1 无合约空态界面

### 1.1 ContractSearch — placeholder prop

`frontend/src/components/ContractSearch/index.tsx`：

- 新增 `placeholder?: string` prop，默认 `'搜索合约...'`。
- `<input placeholder={placeholder} />`。

### 1.2 OrderPage — 去掉空态守卫，恒渲染完整界面

`frontend/src/pages/OrderPage.tsx`：

- **停靠模式**：删除 `{!instrumentID && …「请在行情表格中选择合约后打开报单标签」}` 块，恒渲染标题栏 + `OrderTradeBody`（`instrumentID` 允许 undefined）。
- **浮动模式**：删除 `if (!instrumentID) { return … }` 提前返回，恒渲染 `AccountBar + OrderTradeBody + QuoteStatsBar + FooterBar`，`instrumentID` 传 `instrumentID ?? ''`。
- 标题栏 subtitle 仍 `{instrumentID && …}` 条件显示（空态不显示合约代码）。

### 1.3 OrderTradeBody — 类型放宽

`frontend/src/modules/order/OrderTradeBody.tsx`：

- `instrumentID: string` → `string | undefined`。
- 内部已按 `instrumentID ? … : null` 取快照/合约，空态自然回落。

### 1.4 MarketDepth — 保持现有空渲染

`frontend/src/modules/order/MarketDepth.tsx`：

- 无快照时已 `return <div className="market-depth market-depth--empty">--</div>`，**保持不变**（右侧盘口整列 `--`，无买卖按钮）。

### 1.5 TradeParams — 空态适配

`frontend/src/modules/order/TradeParams.tsx`：

- 合约搜索框：`placeholder={activeInstrument ? undefined : '请选择合约'}`（有合约时用默认「搜索合约...」）。
- **撤最新/撤全部/平净仓**按钮在无合约（`!activeInstrument`）时 `disabled`，避免「撤全部」误撤其他合约挂单、平净仓对空合约报错。

### 1.6 KLinePage — 去掉空态守卫，恒渲染 K线

`frontend/src/pages/KLinePage.tsx`：

- 删除 `{!instrumentID && …「请在行情表格中选择合约后打开K线标签」}` 块，恒渲染 `.kline-page__content`。
- `KLineChart`：`instrument={instrumentID ?? ''}`、`latestPrice` 空态 `--`、`klineData={[]}`（空网格）。
- 搜索框 `ContractSearch`：`placeholder={instrumentID ? undefined : '请选择合约'}`，`initialQuery={instrumentID ?? ''}`。
- 选合约后经现有 `handleSwitch` 更新标签 props/标题（`key=instrumentID` 重挂载搜索框回显）。

### 1.7 占位符统一为 `--`

- `QuoteStatsBar` 的 `PLACEHOLDER = '—'` → `'--'`。
- `KLinePage` 最新价无快照默认 `'—'` → `'--'`。
- `MarketDepth` / `AccountBar` 已是 `--`，不变。

## §2 手数步进跟随快捷

### 2.1 order store — volumeStep 字段

`frontend/src/modules/order/store.ts`：

- `OrderStore` 新增 `volumeStep: number`（默认 `1`）+ `setVolumeStep: (step: number) => void`。
- 独立字段，**不进** `OrderRequestForm`（避免污染 CTP 报单映射）。
- `submitOrder` 成功写回 / `resetOrderForm` **不改** `volumeStep` → 报单后手数记忆保持（手数不重置）、步进保持。

### 2.2 TradeParams — 步进使用 volumeStep

- 读 `volumeStep` / `setVolumeStep`。
- `+`：`Math.min(volumeLimit, volume + volumeStep)`；`volume >= volumeLimit` 禁用（现有逻辑）。
- `−`：`Math.max(1, volume - volumeStep)`。
- 输入框 `step={volumeStep}`（原生微调箭头同步）。
- 手动输入 onChange 只改手数、不改步进。
- 快捷栏 `QtyPreset` 点击 `p`：`setOrderForm({ volumeTotalOriginal: Math.min(volumeLimit, p) })` + `setVolumeStep(p)`（step 用原始预设值，手数用钳制值，如市价 limit 60 点 100 → 手数 60、步进 100）。

### 2.3 QtyPreset — 高亮跟随 step

`frontend/src/modules/order/QtyPreset.tsx`：

- props `{ value, limit, onSelect }` → `{ step, onSelect }`（钳制上移 TradeParams）。
- 高亮 `value === p` → `step === p`：点 20 后持续高亮 20（手数 + 到 40 仍高亮），直到点其他快捷。
- 每个按钮 `onClick={() => onSelect(p)}`。

**行为示例**：点 `20` → 手数 20、20 高亮 → `+` → 40 → `+` → 60 → `−` → 40。点 `1` → 手数 1、1 高亮 → `+` → 2。

## §3 测试与边界

### 3.1 测试更新/新增

- **ContractSearch**：`placeholder` prop 生效。
- **OrderPage.test**：原「无合约显示选择提示」改为断言空态——标题栏 + 参数区（`tp-volume`）+ 盘口 `--` + 搜索框 placeholder「请选择合约」；浮动空态同理。
- **KLinePage.test**：原「无合约显示提示文案」改为断言 `KLineChart` 渲染 + `--` 最新价 + placeholder「请选择合约」。
- **QtyPreset.test**：高亮跟随 `step`；`onSelect` 收原始预设值；原「超限钳制」测试移除（逻辑移入 TradeParams）。
- **TradeParams.test**：新增步进测试——点 `20` 后 `+` → 40、`−` → 20；手动输入后步进保持；报单后手数记忆保持、步进保持。

### 3.2 边界

- 空态盘口 `--` 区不可点（无买卖按钮）。
- 空态选合约 → `handleSwitch` 就地填充，标签标题更新为「📝 报单-IF2608」/「📈 K线-IF2608」，无空态残留。
- **止损单 `StopOrderForm` 不受影响**（无快捷栏，步进仍为 1；范围仅限 `TradeParams`）。
- 步进随上限钳制：市价 limit 60、步进 20 → 40 → `+` → 60（到顶禁用）。

## 涉及文件

- `frontend/src/components/ContractSearch/index.tsx`
- `frontend/src/pages/OrderPage.tsx`
- `frontend/src/pages/KLinePage.tsx`
- `frontend/src/modules/order/OrderTradeBody.tsx`
- `frontend/src/modules/order/TradeParams.tsx`
- `frontend/src/modules/order/QtyPreset.tsx`
- `frontend/src/modules/order/store.ts`
- `frontend/src/modules/order/QuoteStatsBar.tsx`
- 测试：`ContractSearch`、`OrderPage.test`、`KLinePage.test`、`QtyPreset.test`、`TradeParams.test`
