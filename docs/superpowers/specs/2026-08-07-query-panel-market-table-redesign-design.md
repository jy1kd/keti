# 查询面板精简 + 行情表格增强 — 设计文档

日期：2026-08-07
分支：`fix/vtable_enc`

## 背景

当前查询面板（QueryPanel）有 7 个子 Tab：报单 / 成交 / 持仓 / 资金 / 止损单 / 合约 / K线。

- 「合约」Tab 展示选中合约的 8 个静态字段（ContractQuery，每次按 instrumentID 调 `getContracts`）。
- 「K线」Tab 展示选中合约的 K 线图（与右键「打开K线」弹窗功能重复）。

需求：
1. 从查询面板移除「合约」「K线」两个 Tab。
2. 合约面板的静态字段，有一部分已在行情表格展示，有一部分没有；将缺失字段补进行情表格。
3. 行情表格改为固定列宽 + 底部原生横向滚动条，用户可向右滑动查看全部列；每列仍可手动调整宽度，但设有按内容确定的初始大小。

## 范围

- 前端 `frontend/src`（无后端改动，新增字段数据已存在于 `ContractInfo`）。
- 涉及模块：`modules/query/`、`modules/market/MarketTable.tsx`、`modules/market/styles.css`、`modules/query/store.ts`。

## 1. 查询面板：移除「合约」「K线」Tab

### QueryPanel.tsx

- `TABS` 数组删除 `{ key: 'contracts', label: '合约' }` 与 `{ key: 'kline', label: 'K线' }`，剩 5 个：报单 / 成交 / 持仓 / 资金 / 止损单。
- `renderContent` 删除 `case 'contracts'` 与 `case 'kline'`。
- 删除不再使用的 imports 与绑定：
  - `import { ContractQuery } from './ContractQuery'`
  - `import { KLineChart } from '../market/KLineChart'`
  - `import { PERIOD_MS } from '@/hooks/useMarketWs'`
  - `import { getKlineData } from '@/services/api'`
  - `useMarketStore` 的 `selectedInstrument` / `klineData` / `setKlineData` / `period` / `setPeriod` 绑定（经核对，`selectedInstrument` 在 QueryPanel 仅被 K线 effect / ContractQuery / K线渲染使用，全部删除后无其他用途）
  - 整个 `import { useMarketStore } from '../market/store'`（删除后不再使用）
  - 用于拉取 K 线历史数据的 `useEffect`（`getKlineData(selectedInstrument, period, 200)` 那段）
- 顶部 `panel-controls`（暂停/刷新）原先 `activeTab !== 'kline'` 才显示；移除 Tab 后条件恒真，直接去掉条件，所有 Tab 均显示控件。

### query/store.ts

- `QueryTab` 类型由 `'orders' | 'trades' | 'positions' | 'account' | 'stop_orders' | 'contracts' | 'kline'` 收窄为 `'orders' | 'trades' | 'positions' | 'account' | 'stop_orders'`。

### 删除文件

- `frontend/src/modules/query/ContractQuery.tsx`
- `frontend/src/modules/query/ContractQuery.test.tsx`

二者仅被 QueryPanel 引用，无其他使用者。

### 保留（K 线功能不删）

- `KLineChart` 组件本身（`modules/market/KLineChart.tsx`）。
- `pages/KLinePage.tsx` 及右键「打开K线」弹窗 Tab（`openKlineTab` / `openKlineTabs`）。
- `useMarketWs` 的 K 线 gate（`selectedInstrument ∪ lockedContracts`）与 store 的 `klineData` / `currentPeriod` —— 仍服务于 K 线弹窗功能。

## 2. 行情表格：补齐缺失字段

ContractQuery 的 8 个字段中，5 个已在行情表格展示：

| ContractQuery 字段 | 行情表格列 | 结论 |
|---|---|---|
| 合约代码 instrumentID | 合约 | 已展示 |
| 交易所 exchangeID | 交易所 | 已展示 |
| 合约名称 instrumentName | — | **需求确认不加列** |
| 品种 productID | 合约品种 | 已展示 |
| 到期日 expireDate | 到期日 | 已展示 |
| 是否可交易 isTrading | 状态（交易中/已停牌/已到期） | 已展示，不冗余加列 |
| 合约乘数 volumeMultiple | — | **新增列** |
| 最小变动价位 priceTick | — | **新增列** |

新增 2 列，数据直接读取 `contracts[i]`（`ContractInfo` 已含 `volumeMultiple` / `priceTick`），无需新增 API 调用：

| 新列 | field | 数据来源 |
|---|---|---|
| 合约乘数 | volumeMultiple | `contracts[i].volumeMultiple` |
| 最小变动价位 | priceTick | `contracts[i].priceTick` |

`buildRecord` 中从 `contract` 读取这两个字段；无快照时与其他静态列一致回退 `--`（当前 `volume` / `openInterest` 等已有 PLACEHOLDER 回退逻辑，静态字段沿用）。

## 3. 列宽与横向滚动

- `MarketTable` 配置 `widthMode: 'adaptive'` → `'standard'`（固定列宽）。
- 15 列各设固定初始宽度（按内容决定），合计 ≈1175px：

| 列 | 宽度 | 依据 |
|---|---|---|
| 合约 | 70 | IF2608（8 字符等宽，12px） |
| 合约品种 | 80 | 沪深300（3 汉字） |
| 交易所 | 60 | SHFE |
| 合约乘数 | 70 | 300 / 1000 |
| 最小变动价位 | 90 | 0.0002（期权小数位长） |
| 到期日 | 85 | 20260820（8 位数字） |
| 状态 | 60 | 交易中 |
| 最新价 | 90 | 4585.60 |
| 涨跌 | 80 | +123.45 |
| 涨跌% | 80 | +2.34% |
| 买一 | 90 | 4585.20 |
| 卖一 | 90 | 4585.80 |
| 成交量 | 90 | 1,234,567 |
| 持仓量 | 90 | 88,888 |
| ⭐ | 50 | 单字符 |

- 总宽超过容器宽度时，VTable 底部自动出现原生横向滚动条（`scrollStyle.visible: 'always'` 已配置，常显），用户可向右拖动查看。
- 列仍可拖动表头边框手动调整：vtable `columnResizeMode` 默认 `all`，无需改配置。固定宽度下拖拽改的是该列显式宽度（区别于 adaptive 模式下的重分配）。
- 手动调整的宽度不持久化：MarketTable 在「行情 ↔ T型期权」切换时会卸载重建，宽度重置为默认初始值。符合「固定的初始大小」语义。
- 宽屏（总宽 < 容器）下列靠左排布、右侧留空 —— 方案 A（纯固定列宽）的预期行为。

## 4. 测试

- **MarketTable.test.tsx**
  - 新增：columns 含「合约乘数」「最小变动价位」；buildRecord 从 contract 正确填充（有/无快照两态）。
  - 既有用例核对：`状态列为到期日右侧` 用例在新列序下仍成立（到期日 → 状态 的紧邻关系不变）；局部更新/行索引用例不受列变化影响。
- **QueryPanel.test.tsx**
  - `renders all 6 tab buttons` 改为 5 个 Tab 断言；删除「合约」Tab 断言；无 K线 Tab 断言（原测试未覆盖，可补一条「无 合约/K线 Tab」）。
- **query/store.test.ts**：更新 tab 枚举断言。
- **删除** `ContractQuery.test.tsx`。
- 前端全量测试 + `npm run build` 通过。

## 不做（Out of scope）

- 不删除 K 线功能整体（弹窗 Tab 保留）。
- 不添加「合约名称」「是否可交易」列。
- 不改动 useMarketWs 的 K 线 gate 逻辑。
- 不做列宽持久化（localStorage）。
- 不做宽屏自动撑满（方案 B）。
