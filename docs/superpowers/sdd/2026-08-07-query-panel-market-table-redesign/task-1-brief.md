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

