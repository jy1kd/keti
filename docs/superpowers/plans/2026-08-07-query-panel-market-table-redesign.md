# 查询面板精简 + 行情表格增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从查询面板移除「合约」「K线」Tab，并在行情表格中补齐 合约乘数 / 最小变动价位 两列、改为固定列宽 + 原生横向滚动。

**Architecture:** 纯前端改动。查询面板删两个 Tab（QueryPanel.tsx + QueryTab 类型收窄 + 删除 ContractQuery 组件及其死 CSS）；行情表格在已有 `contracts`/`snapshots` props 基础上扩展 `columns` 与 `buildRecord`，`widthMode` 从 `adaptive` 改为 `standard` 使固定列宽溢出时出现原生横向滚动条。零后端/API 改动（新增字段已存在于 `ContractInfo`）。

**Tech Stack:** React 18 + TypeScript 5 + Vite, @visactor/vtable ^1.26.4, vitest。

## Global Constraints

- 分支：`feature/table-refactor`（基线 `main` @ 51c86b8）。
- 不引入任何新 API 调用；新增列数据全部来自 `ContractInfo`（`volumeMultiple` / `priceTick`）。
- 删除 ContractQuery 后 `getContracts`（services/api.ts）保留，不在本次范围。
- K 线功能整体保留：`KLineChart`、KLinePage 弹窗、useMarketWs 的 K 线 gate、store 的 `klineData` 均不动。
- 列宽为固定初始值，不持久化（切 T型期权 再切回会重置）。
- 前端命令：`cd frontend && npx vitest run <file>`（定向）、`npx tsc --noEmit`、`npm test`、`npm run build`。
- 提交信息遵循仓库既有中文 + conventional-prefix 风格。

---

## 文件结构

| 文件 | 责任 | 变更 |
|---|---|---|
| `frontend/src/modules/query/QueryPanel.tsx` | 查询面板容器 + Tab 渲染 | 删「合约」「K线」Tab 及相关代码 |
| `frontend/src/modules/query/store.ts` | 查询 store，`QueryTab` 类型 | 收窄类型 |
| `frontend/src/modules/query/store.test.ts` | store 单测 | 更新 tab 枚举 |
| `frontend/src/modules/query/QueryPanel.test.tsx` | QueryPanel 单测 | 更新/新增 tab 断言 |
| `frontend/src/modules/query/ContractQuery.tsx` | 合约详情组件 | **删除** |
| `frontend/src/modules/query/ContractQuery.test.tsx` | 合约详情单测 | **删除** |
| `frontend/src/modules/query/styles.css` | 查询面板样式 | 删死 CSS |
| `frontend/src/modules/query/popupStore.ts` | 查询弹窗状态 | 更新失效注释 |
| `frontend/src/modules/market/MarketTable.tsx` | 行情表格 | 加 2 列 + 固定列宽 |
| `frontend/src/modules/market/MarketTable.test.tsx` | 行情表格单测 | 新增/更新断言 |

---

### Task 1: 查询面板移除「合约」「K线」Tab

**Files:**
- Modify: `frontend/src/modules/query/QueryPanel.tsx`
- Modify: `frontend/src/modules/query/store.ts:58`
- Modify: `frontend/src/modules/query/store.test.ts:56-62`
- Modify: `frontend/src/modules/query/QueryPanel.test.tsx`
- Modify: `frontend/src/modules/query/styles.css`
- Modify: `frontend/src/modules/query/popupStore.ts:5-10,20`
- Delete: `frontend/src/modules/query/ContractQuery.tsx`
- Delete: `frontend/src/modules/query/ContractQuery.test.tsx`
- Test: `frontend/src/modules/query/QueryPanel.test.tsx`, `frontend/src/modules/query/store.test.ts`

**Interfaces:**
- Produces: `QueryTab = 'orders' | 'trades' | 'positions' | 'account' | 'stop_orders'`（store.ts 导出）；QueryPanel 渲染 5 个 Tab，不再有 合约/K线。

- [ ] **Step 1: 写失败测试 — QueryPanel 不再渲染 合约/K线 Tab**

在 `QueryPanel.test.tsx` 的 `describe('QueryPanel')` 块末尾追加：

```tsx
it('不再显示 合约/K线 Tab', () => {
  render(<QueryPanel />)
  expect(screen.queryByText('合约')).not.toBeInTheDocument()
  expect(screen.queryByText('K线')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 运行验证失败**

Run: `cd frontend && npx vitest run src/modules/query/QueryPanel.test.tsx -t "不再显示"`
Expected: FAIL（旧代码仍渲染 合约/K线 Tab，`queryByText('合约')` 命中）

- [ ] **Step 3: 实现 — 删除 QueryPanel 中「合约」「K线」相关代码**

`QueryPanel.tsx`：

1. 删除 imports（第 8-13 行这些行）：`ContractQuery`、`KLineChart`、`useMarketStore`、`PERIOD_MS`、`getKlineData`、`ErrorBoundary`。imports 块最终为：

```tsx
import { useEffect, useCallback } from 'react'
import { useQueryStore } from './store'
import { OrderFlow } from './OrderFlow'
import { TradeFlow } from './TradeFlow'
import { Position } from './Position'
import { AccountQuery } from './AccountQuery'
import { StopOrderList } from './StopOrderList'
import './styles.css'
```

2. `TABS` 数组（第 16-24 行）删两行：

```tsx
const TABS = [
  { key: 'orders' as const, label: '报单' },
  { key: 'trades' as const, label: '成交' },
  { key: 'positions' as const, label: '持仓' },
  { key: 'account' as const, label: '资金' },
  { key: 'stop_orders' as const, label: '止损单' },
]
```

3. 删除 store 绑定（原第 34-38 行的 `selectedInstrument` / `klineData` / `setKlineData` / `period` / `setPeriod`）。

4. 删除「获取K线数据」`useEffect`（原第 61-77 行整段，即 `getKlineData(selectedInstrument, period, 200)` 那段）。

5. `renderContent` 的 switch 中删除 `case 'contracts'` 与 `case 'kline'`（含 kline 里的 `<ErrorBoundary>`），只保留 5 个 case + `default`。

6. 顶栏 `panel-controls` 的 `{activeTab !== 'kline' && (...)}` 条件去掉，直接恒渲染控件（删 `{activeTab !== 'kline' && (` 与闭合 `)}`，保留内层 `<div className="panel-controls">...</div>`）。

`store.ts:58` 收窄：

```ts
export type QueryTab = 'orders' | 'trades' | 'positions' | 'account' | 'stop_orders'
```

`styles.css`：
- 第 93-105 行组合选择器中删除 `.contract-query`（保留 `.order-flow,.trade-flow,.position-table-wrap,.account-query,.stop-order-list,.quote-query`）。
- 删除 `.contract-grid` / `.contract-item` / `.contract-label` / `.contract-value`（第 107-135 行）。
- 删除 `/* ── K线样式 ── */` 整段 `.kline-query` / `.kline-placeholder`（第 288-305 行）。

`popupStore.ts` 更新失效注释（第 5-10 行 open 的 JSDoc、第 20 行块注释）——去掉对「合约/K线子页」的引用，例如 open 的注释改为「传入合约时同步设置全局选中合约（在行情表格中高亮）」：

```ts
  /**
   * 打开查询弹窗；传入合约时同步设置全局选中合约（在行情表格中高亮）。
   */
```

- [ ] **Step 4: 修复受影响的既有测试**

`QueryPanel.test.tsx`：
- 测试 `renders all 6 tab buttons` 改标题为 `renders all 5 tab buttons`，删除其中的 `expect(screen.getByText('合约')).toBeInTheDocument()` 一行。
- 第 36-42 行测试 `删除冗余「查询面板」标题，工具栏直接承载 7 个子 Tab` 注释中 `7 个子 Tab` 改为 `5 个子 Tab`（断言本身只查 报单/成交，无需改）。

`store.test.ts:56-62`：

```ts
  it('supports all remaining tab values', () => {
    const tabs = ['orders', 'trades', 'positions', 'account', 'stop_orders'] as const
    for (const tab of tabs) {
      useQueryStore.getState().setActiveTab(tab)
      expect(useQueryStore.getState().activeTab).toBe(tab)
    }
  })
```

- [ ] **Step 5: 删除 ContractQuery 文件**

```bash
cd frontend && git rm src/modules/query/ContractQuery.tsx src/modules/query/ContractQuery.test.tsx
```

- [ ] **Step 6: 运行测试 + 类型检查验证通过**

Run: `cd frontend && npx vitest run src/modules/query/ && npx tsc --noEmit`
Expected: 全部 PASS，tsc exit 0（无 ContractQuery 引用残留）

- [ ] **Step 7: 提交**

```bash
git add -A src/modules/query/
git commit -m "refactor(query): 移除查询面板「合约」「K线」Tab，删除 ContractQuery"
```

---

### Task 2: 行情表格新增 合约乘数/最小变动价位 列 + 固定列宽

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:63-77,82-123,190`
- Test: `frontend/src/modules/market/MarketTable.test.tsx`

**Interfaces:**
- Consumes: `MarketTable` props 不变（`contracts: ContractInfo[]` 已含 `volumeMultiple` / `priceTick`）。
- Produces: 15 列固定宽度表格，`widthMode: 'standard'`；`buildRecord` 输出含 `volumeMultiple` / `priceTick`（number）。

- [ ] **Step 1: 写失败测试**

在 `MarketTable.test.tsx` 的 `describe('MarketTable')` 块内（状态列 tests 之后）追加：

```tsx
  it('columns 包含合约乘数与最小变动价位，且采用固定列宽 standard', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.widthMode).toBe('standard')
    const titles = options.columns.map((c: { title: string }) => c.title)
    expect(titles).toContain('合约乘数')
    expect(titles).toContain('最小变动价位')
    for (const col of options.columns) {
      expect(typeof col.width).toBe('number')
      expect(col.width as number).toBeGreaterThan(0)
    }
  })

  it('buildRecord 从 contract 填充合约乘数与最小变动价位（有快照）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0] // au2508
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
  })

  it('无快照时合约乘数/最小变动价位仍从 contract 显示（静态列）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={new Map()} />)
    const options = (ListTable as any).mock.calls[0][1]
    const record = options.records[0]
    expect(record.volumeMultiple).toBe(1000)
    expect(record.priceTick).toBe(0.02)
    expect(record.lastPrice).toBe('--')
  })
```

（`mockContracts` 第一条 `au2508` 的 `volumeMultiple: 1000, priceTick: 0.02` 已在文件第 9 行定义，无需改 fixture。）

- [ ] **Step 2: 运行验证失败**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx -t "合约乘数"`
Expected: FAIL（columns 无这两列、`widthMode` 为 `'adaptive'`、record 无这两个字段）

- [ ] **Step 3: 实现 — columns + buildRecord + widthMode**

`MarketTable.tsx`：

1. 替换 `columns`（第 63-77 行）为固定列宽 15 列，新增 `volumeMultiple` / `priceTick` 列，插入 到期日 之前：

```ts
const columns = [
  { field: 'instrumentID', title: '合约', width: 70 },
  { field: 'productName', title: '合约品种', width: 80 },
  { field: 'exchangeID', title: '交易所', width: 60 },
  { field: 'volumeMultiple', title: '合约乘数', width: 70 },
  { field: 'priceTick', title: '最小变动价位', width: 90 },
  { field: 'expireDate', title: '到期日', width: 85 },
  { field: 'status', title: '状态', width: 60, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 90, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 80, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 80, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 90, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 90, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 90 },
  { field: 'openInterest', title: '持仓量', width: 90 },
  { field: 'favorite', title: '⭐', width: 50 },
]
```

2. `buildRecord` 两个分支各加两行（静态列，与 `expireDate` 同源 `contract`）：

- 无快照分支（第 85-101 行 return 对象）内加：
```ts
      volumeMultiple: contract.volumeMultiple,
      priceTick: contract.priceTick,
```
- 有快照分支（第 108-122 行 return 对象）内加同样的两行。

3. 第 190 行 `widthMode: 'adaptive',` → `widthMode: 'standard',`。

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`
Expected: 全部 PASS（含既有 `状态列为到期日右侧的列` —— 新列序 到期日→状态 紧邻关系不变；局部更新/行索引用例不受影响）

- [ ] **Step 5: 全量测试 + 构建**

Run: `cd frontend && npm test && npm run build`
Expected: 全绿，build 成功

- [ ] **Step 6: 提交**

```bash
git add src/modules/market/MarketTable.tsx src/modules/market/MarketTable.test.tsx
git commit -m "feat(market): 行情表格新增合约乘数/最小变动价位列，固定列宽 + 原生横向滚动"
```

---

## 自检记录（writing-plans Self-Review）

- **Spec 覆盖**：§1 查询面板删 Tab → Task 1；§2 补 2 列 → Task 2；§3 固定列宽 + 横向滚动 → Task 2（`widthMode:'standard'` + 每列显式 width）；§4 测试 → 两个 Task 各含 TDD 步骤。无缺项。
- **占位符扫描**：所有 code 步骤含具体内容。
- **类型一致性**：`volumeMultiple` / `priceTick` 在 columns、buildRecord、测试中一致；`QueryTab` 收窄在 store.ts 与两个测试文件中一致。
