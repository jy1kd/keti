# 查询面板拆分（报单查询 + 持仓查询）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有查询面板拆成三个独立可开窗口——报单查询（状态筛选：全部/未成交/已成交）、持仓查询（合约输入框模糊匹配）、查询窗口（保留成交/资金/止损单），入口放左上角 Electron 原生菜单「功能」子菜单。

**Architecture:** 新增两个标签页类型 `query-orders`/`query-positions`，各自独立窗口组件（`OrdersQuery`/`PositionsQuery`）复用现有 `OrderFlow`/`Position` 表格（给它们加可选 `orders`/`positions` prop 以支持外部传入筛选后数据）。`OrderFlow`/`Position` 的撤单、平仓、新单高亮逻辑零改动。数据仍在同一 `useQueryStore`，各窗口独立 10s 轮询自己的数据集（遵守 CTP ~1 次/秒限频）。`QueryPanel` 缩减为 成交/资金/止损单 三个 tab，`refreshAll` 同步瘦身。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5 + Zustand + vitest + @testing-library/react + Electron（主进程菜单）。

## Global Constraints

- 前端筛选，**后端零改动**（`/api/query/orders`、`/api/query/positions` 全量返回）。
- CTP `orderStatus` 编码：`'0'` 全部成交、`'1'` 部分成交、`'2'` 未成交(排队)、`'3'` 未成交、`'5'` 已撤单。
- 报单状态筛选语义（已批准）：**未成交 = status ∈ {2,3}**；**已成交 = status ∈ {0,1}（部分成交算已成交）**；**已撤单(5) 仅「全部」显示**。
- 各窗口独立 10s 轮询自己数据集（orders / positions / trades+account+stopOrders 三者不相交），遵守 CTP ~1 次/秒查询限频。
- UI 文案固定：`全部报单` / `未成交报单` / `已成交报单` / `报单查询` / `持仓查询` / `暂无报单数据` / `暂无持仓数据` / `无匹配报单` / `无匹配持仓`。
- 组件默认文案（`emptyText` 缺省值）：OrderFlow=`暂无报单数据`、Position=`暂无持仓数据`。
- 测试命令（均在 `frontend/` 下）：单文件 `npx vitest run <path>`，全量 `npm test`。
- 已知限制：新窗口入口仅在 Electron 原生菜单；纯浏览器模式（无原生菜单）暂不可达，不在本次范围。

---

### Task 1: OrderFlow 支持外部传入 orders 列表

给 `OrderFlow` 加可选 `orders`/`emptyText` prop：缺省读 store（现有调用方/测试零改动），传入时渲染传入列表。这是报单查询窗口能按状态筛选数据的前提。

**Files:**
- Modify: `frontend/src/modules/query/store.ts:24`（导出 `OrderEntry` 类型）
- Modify: `frontend/src/modules/query/OrderFlow.tsx`
- Test: `frontend/src/modules/query/OrderFlow.test.tsx`

**Interfaces:**
- Consumes: `useQueryStore`（已有 `orders: OrderEntry[]`）
- Produces: `export type OrderEntry`（store.ts，`RawOrder` 的同名导出）；`OrderFlow` 新增可选 props `{ orders?: OrderEntry[]; emptyText?: string }`。Task 2 的 `OrdersQuery` 依赖 `OrderEntry` 类型与 `orders` prop。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/modules/query/OrderFlow.test.tsx` 的 `describe('OrderFlow')` 内追加两个用例（复用文件顶部已有的 `mockOrders` 与 API mock）：

```tsx
it('renders provided orders prop instead of store orders', () => {
  useQueryStore.setState({ orders: mockOrders })
  const filtered = mockOrders.filter((o) => o.orderRef === '1001')
  render(<OrderFlow orders={filtered} />)
  expect(screen.getByText('1001')).toBeInTheDocument()
  expect(screen.queryByText('1002')).not.toBeInTheDocument()
  expect(screen.queryByText('1003')).not.toBeInTheDocument()
})

it('renders custom empty text when orders prop is empty', () => {
  useQueryStore.setState({ orders: mockOrders })
  render(<OrderFlow orders={[]} emptyText="无匹配报单" />)
  expect(screen.getByText('无匹配报单')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/query/OrderFlow.test.tsx`
Expected: 新增两个用例 FAIL（TS 报 `orders`/`emptyText` 属性不存在，且渲染用 store 全量数据导致断言不通过）。

- [ ] **Step 3: 实现**

`frontend/src/modules/query/store.ts:24` — 把 `type OrderEntry = RawOrder` 改为导出：

```ts
export type OrderEntry = RawOrder
```

`frontend/src/modules/query/OrderFlow.tsx` — 组件改为接收可选 props：

```tsx
import { useQueryStore, type OrderEntry } from './store'

interface OrderFlowProps {
  /** 可选：外部传入报单列表；缺省读 store */
  orders?: OrderEntry[]
  /** 可选：空态文案；缺省「暂无报单数据」 */
  emptyText?: string
}

export function OrderFlow({ orders: propOrders, emptyText = '暂无报单数据' }: OrderFlowProps) {
  const storeOrders = useQueryStore((s) => s.orders)
  const orders = propOrders ?? storeOrders
  const newOrderRefs = useQueryStore((s) => s.newOrderRefs)
  const clearNewOrderRef = useQueryStore((s) => s.clearNewOrderRef)
  const handleCancelOrder = useQueryStore((s) => s.handleCancelOrder)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)

  // ...（后续 2s 高亮计时器、onCancel、onCancelAll 逻辑原样保留）

  if (orders.length === 0) {
    return (
      <div className="order-flow">
        <div className="flow-toolbar">
          <button className="btn-cancel-all" disabled>撤销全部</button>
        </div>
        <div className="flow-empty">{emptyText}</div>
      </div>
    )
  }
  // ...（表格渲染原样保留，仅把 `orders.map` 前的 store 读取改为上方 `orders` 变量）
}
```

注意：函数签名从 `export function OrderFlow()` 改为 `export function OrderFlow({ orders: propOrders, emptyText = '暂无报单数据' }: OrderFlowProps)`；函数体内原 `const orders = useQueryStore((s) => s.orders)` 改为 `const storeOrders = ...` + `const orders = propOrders ?? storeOrders`。其余渲染逻辑、`newOrderRefs` 高亮、撤单按钮一律不动。

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/query/OrderFlow.test.tsx`
Expected: 全部 PASS（含原有用例——未传 prop 时行为不变）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/query/store.ts frontend/src/modules/query/OrderFlow.tsx frontend/src/modules/query/OrderFlow.test.tsx
git commit -m "feat(query): OrderFlow 支持外部传入 orders 列表"
```

---

### Task 2: 报单查询窗口 OrdersQuery（状态筛选 + 自刷新 + C 键）

独立窗口组件：顶部三档状态筛选（全部/未成交/已成交），下方复用 `OrderFlow` 渲染筛选后数据；10s 自刷新 `fetchOrders`；`C` 键触发撤销全部（原 QueryPanel 中 orders tab 的快捷键平移到此）。

**Files:**
- Create: `frontend/src/modules/query/OrdersQuery.tsx`
- Create: `frontend/src/modules/query/OrdersQuery.test.tsx`
- Modify: `frontend/src/modules/query/styles.css`（追加 `.query-filter-btn` 样式）

**Interfaces:**
- Consumes: `useQueryStore`（`orders`、`fetchOrders`、`handleCancelAll`）、`OrderEntry` 类型、`OrderFlow` 的 `orders`/`emptyText` prop
- Produces: `export function OrdersQuery()`（无 props）。Task 6 的 TabContent 渲染它；Task 7 的 `openOrdersQueryFloating` 打开它。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/modules/query/OrdersQuery.test.tsx`（注意：窗口挂载即触发 `fetchOrders` 异步 setState，数据用 mock 返回 + `findByText` 等待，勿在渲染前预置 store 数据）：

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OrdersQuery } from './OrdersQuery'
import { useQueryStore } from './store'

vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn(),
  refreshTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  refreshPositions: vi.fn().mockResolvedValue({ positions: [], count: 0 }),
  refreshAccount: vi.fn().mockResolvedValue(null),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn().mockResolvedValue({ success: true }),
  cancelAllOrders: vi.fn().mockResolvedValue({ success: true, attempted: 3, succeeded: 3, failedRefs: [] }),
  cancelStopOrder: vi.fn().mockResolvedValue({ success: true }),
}))

import { refreshOrders } from '../../services/api'
const mockRefreshOrders = vi.mocked(refreshOrders)

// status: 1003='5' 已撤单, 1002='1' 部分成交(已成交), 1001='2' 未成交(排队)
const mockOrders = [
  { orderRef: '1003', instrumentID: 'IF2609', direction: '1', combOffsetFlag: '0', limitPrice: 4900, volumeTotalOriginal: 2, volumeTraded: 0, orderStatus: '5', statusMsg: '已撤单', insertTime: '09:32:00' },
  { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '1', limitPrice: 4810, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '1', statusMsg: '部分成交', insertTime: '09:31:00' },
  { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '2', statusMsg: '未成交(排队)', insertTime: '09:30:00' },
]

describe('OrdersQuery', () => {
  beforeEach(() => {
    useQueryStore.setState({ orders: [], newOrderRefs: new Set(), isPaused: false })
  })

  it('renders three filter buttons', () => {
    render(<OrdersQuery />)
    expect(screen.getByText('全部报单')).toBeInTheDocument()
    expect(screen.getByText('未成交报单')).toBeInTheDocument()
    expect(screen.getByText('已成交报单')).toBeInTheDocument()
  })

  it('defaults to 全部报单 and shows all rows', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    expect(await screen.findByText('1001')).toBeInTheDocument()
    expect(screen.getByText('1002')).toBeInTheDocument()
    expect(screen.getByText('1003')).toBeInTheDocument()
  })

  it('未成交报单 shows only unfilled (status 2/3), excludes 部分成交 and 已撤单', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    await screen.findByText('1001')
    fireEvent.click(screen.getByText('未成交报单'))
    expect(screen.getByText('1001')).toBeInTheDocument()
    expect(screen.queryByText('1002')).not.toBeInTheDocument()
    expect(screen.queryByText('1003')).not.toBeInTheDocument()
  })

  it('已成交报单 shows filled (status 0/1), includes partial fill', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 3 })
    render(<OrdersQuery />)
    await screen.findByText('1001')
    fireEvent.click(screen.getByText('已成交报单'))
    expect(screen.getByText('1002')).toBeInTheDocument()
    expect(screen.queryByText('1001')).not.toBeInTheDocument()
    expect(screen.queryByText('1003')).not.toBeInTheDocument()
  })

  it('shows 无匹配报单 when filter excludes all rows', async () => {
    mockRefreshOrders.mockResolvedValue({ orders: [mockOrders[0]], count: 1 }) // 仅已撤单
    render(<OrdersQuery />)
    await screen.findByText('1003')
    fireEvent.click(screen.getByText('未成交报单'))
    expect(screen.getByText('无匹配报单')).toBeInTheDocument()
  })

  it('C key triggers handleCancelAll', async () => {
    const handleCancelAll = vi.fn().mockResolvedValue(true)
    useQueryStore.setState({ handleCancelAll })
    render(<OrdersQuery />)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'c' })
    })
    expect(handleCancelAll).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/query/OrdersQuery.test.tsx`
Expected: FAIL——`./OrdersQuery` 模块不存在。

- [ ] **Step 3: 实现**

创建 `frontend/src/modules/query/OrdersQuery.tsx`：

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useQueryStore, type OrderEntry } from './store'
import { OrderFlow } from './OrderFlow'

type OrderFilter = 'all' | 'unfilled' | 'filled'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: '全部报单' },
  { key: 'unfilled', label: '未成交报单' },
  { key: 'filled', label: '已成交报单' },
]

/** 未成交：status ∈ {2 未成交排队, 3 未成交}，无成交量且未撤 */
function isUnfilled(order: OrderEntry): boolean {
  return order.orderStatus === '2' || order.orderStatus === '3'
}

/** 已成交：status ∈ {0 全部成交, 1 部分成交}，有成交量 */
function isFilled(order: OrderEntry): boolean {
  return order.orderStatus === '0' || order.orderStatus === '1'
}

export function OrdersQuery() {
  const orders = useQueryStore((s) => s.orders)
  const fetchOrders = useQueryStore((s) => s.fetchOrders)
  const handleCancelAll = useQueryStore((s) => s.handleCancelAll)
  const [filter, setFilter] = useState<OrderFilter>('all')

  // 10s 自刷新：完成后调度下一次，避免重入（对齐 QueryPanel 节奏）
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchOrders()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchOrders])

  // C 快捷键撤销全部：输入框/文本域聚焦时不触发（沿用 QueryPanel 语义）
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        handleCancelAll()
      }
    },
    [handleCancelAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const filtered = orders.filter((o) =>
    filter === 'all' ? true : filter === 'unfilled' ? isUnfilled(o) : isFilled(o)
  )

  return (
    <div className="orders-query">
      <div className="flow-toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`query-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <OrderFlow orders={filtered} emptyText={filter === 'all' ? undefined : '无匹配报单'} />
    </div>
  )
}
```

`frontend/src/modules/query/styles.css` 末尾追加：

```css
/* ── OrdersQuery 状态筛选按钮 ─────────────────────── */

.query-filter-btn {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.query-filter-btn:hover {
  color: var(--text-primary);
}

.query-filter-btn.active {
  color: var(--accent);
  border-color: var(--accent);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/query/OrdersQuery.test.tsx`
Expected: 全部 PASS。若出现 React act 告警（mount 时 `fetchOrders` 异步 setState），将相关用例改为 `await act(async () => { render(<OrdersQuery />) })` 后重跑。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/query/OrdersQuery.tsx frontend/src/modules/query/OrdersQuery.test.tsx frontend/src/modules/query/styles.css
git commit -m "feat(query): 新增报单查询窗口（状态筛选/自刷新/C键撤全部）"
```

---

### Task 3: Position 支持外部传入 positions 列表

与 Task 1 对称：给 `Position` 加可选 `positions`/`emptyText` prop，缺省读 store。持仓查询窗口按合约筛选数据的前提。

**Files:**
- Modify: `frontend/src/modules/query/store.ts:46`（导出 `PositionEntry` 类型）
- Modify: `frontend/src/modules/query/Position.tsx`
- Test: `frontend/src/modules/query/Position.test.tsx`

**Interfaces:**
- Consumes: `useQueryStore`（已有 `positions: PositionEntry[]`）
- Produces: `export type PositionEntry`（store.ts）；`Position` 新增可选 props `{ positions?: PositionEntry[]; emptyText?: string }`。Task 4 的 `PositionsQuery` 依赖 `PositionEntry` 类型与 `positions` prop。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/modules/query/Position.test.tsx` 的 `describe('Position')` 内追加：

```tsx
it('renders provided positions prop instead of store positions', () => {
  useQueryStore.setState({
    positions: [
      { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
      { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
    ],
  })
  render(<Position positions={[{ instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' }]} />)
  expect(screen.getByText('IF2608')).toBeInTheDocument()
  expect(screen.queryByText('IF2609')).not.toBeInTheDocument()
})

it('renders custom empty text when positions prop is empty', () => {
  useQueryStore.setState({
    positions: [
      { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
    ],
  })
  render(<Position positions={[]} emptyText="无匹配持仓" />)
  expect(screen.getByText('无匹配持仓')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/query/Position.test.tsx`
Expected: 新增两个用例 FAIL（TS 报 `positions`/`emptyText` 属性不存在）。

- [ ] **Step 3: 实现**

`frontend/src/modules/query/store.ts:46` — `type PositionEntry = RawPosition` 改为导出：

```ts
export type PositionEntry = RawPosition
```

`frontend/src/modules/query/Position.tsx`：

```tsx
import { useCallback } from 'react'
import { useQueryStore, type PositionEntry } from './store'
import { useOrderStore } from '../order/store'
import { useMarketStore } from '../market/store'
import { useTabStore } from '@/stores/tabs'

const DIRECTION_MAP: Record<string, string> = { '2': '多', '3': '空' }

interface PositionProps {
  /** 可选：外部传入持仓列表；缺省读 store */
  positions?: PositionEntry[]
  /** 可选：空态文案；缺省「暂无持仓数据」 */
  emptyText?: string
}

export function Position({ positions: propPositions, emptyText = '暂无持仓数据' }: PositionProps) {
  const storePositions = useQueryStore((s) => s.positions)
  const positions = propPositions ?? storePositions
  const setSelectedInstrument = useOrderStore((s) => s.setSelectedInstrument)
  const setOrderForm = useOrderStore((s) => s.setOrderForm)

  // ...（onClose 平仓逻辑原样保留）

  if (positions.length === 0) {
    return (
      <div className="position-table-wrap">
        <div className="flow-empty">{emptyText}</div>
      </div>
    )
  }
  // ...（表格渲染原样保留）
}
```

注意：签名从 `export function Position()` 改为接收 `PositionProps`；原 `const positions = useQueryStore((s) => s.positions)` 改为 `storePositions` + `propPositions ?? storePositions`。平仓 `onClose`、表格、方向映射一律不动。

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/query/Position.test.tsx`
Expected: 全部 PASS（含原有用例）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/query/store.ts frontend/src/modules/query/Position.tsx frontend/src/modules/query/Position.test.tsx
git commit -m "feat(query): Position 支持外部传入 positions 列表"
```

---

### Task 4: 持仓查询窗口 PositionsQuery（合约输入框模糊匹配 + 自刷新）

独立窗口组件：顶部合约搜索输入框（`instrumentID` 子串匹配、大小写不敏感、空输入显示全部），下方复用 `Position` 渲染筛选后数据；10s 自刷新 `fetchPositions`。平仓按钮由 `Position` 原样提供。

**Files:**
- Create: `frontend/src/modules/query/PositionsQuery.tsx`
- Create: `frontend/src/modules/query/PositionsQuery.test.tsx`
- Modify: `frontend/src/modules/query/styles.css`（追加 `.position-search` 样式）

**Interfaces:**
- Consumes: `useQueryStore`（`positions`、`fetchPositions`）、`Position` 的 `positions`/`emptyText` prop
- Produces: `export function PositionsQuery()`（无 props）。Task 6 的 TabContent 渲染它；Task 7 的 `openPositionsQueryFloating` 打开它。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/modules/query/PositionsQuery.test.tsx`（窗口挂载即触发 `fetchPositions`，数据用 mock 返回 + `findByText` 等待，勿在渲染前预置 store 数据）：

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PositionsQuery } from './PositionsQuery'
import { useQueryStore } from './store'
import { useTabStore } from '@/stores/tabs'

vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn().mockResolvedValue({ orders: [], count: 0 }),
  refreshTrades: vi.fn().mockResolvedValue({ trades: [], count: 0 }),
  refreshPositions: vi.fn(),
  refreshAccount: vi.fn().mockResolvedValue(null),
  getStopOrders: vi.fn().mockResolvedValue({ stopOrders: [], count: 0 }),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  cancelStopOrder: vi.fn(),
}))

import { refreshPositions } from '../../services/api'
const mockRefreshPositions = vi.mocked(refreshPositions)

const mockPositions = [
  { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
  { instrumentID: 'IF2609', posiDirection: '3', position: 1, positionCost: 4900, positionProfit: -50, openCost: 4900, useMargin: 49000, todayPosition: 0, ydPosition: 1, tradingDay: '20260727' },
  { instrumentID: 'RB2610', posiDirection: '2', position: 3, positionCost: 3600, positionProfit: 200, openCost: 3600, useMargin: 36000, todayPosition: 2, ydPosition: 1, tradingDay: '20260727' },
]

describe('PositionsQuery', () => {
  beforeEach(() => {
    useQueryStore.setState({ positions: [] })
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('renders search input', () => {
    render(<PositionsQuery />)
    expect(screen.getByPlaceholderText('筛选合约，如 IF')).toBeInTheDocument()
  })

  it('shows all positions when search is empty', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    expect(await screen.findByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('IF2609')).toBeInTheDocument()
    expect(screen.getByText('RB2610')).toBeInTheDocument()
  })

  it('filters by contract code substring', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'IF' } })
    expect(screen.getByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('IF2609')).toBeInTheDocument()
    expect(screen.queryByText('RB2610')).not.toBeInTheDocument()
  })

  it('filters case-insensitively', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'if' } })
    expect(screen.getByText('IF2608')).toBeInTheDocument()
    expect(screen.queryByText('RB2610')).not.toBeInTheDocument()
  })

  it('shows 无匹配持仓 when no contract matches', async () => {
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 3 })
    render(<PositionsQuery />)
    await screen.findByText('IF2608')
    fireEvent.change(screen.getByPlaceholderText('筛选合约，如 IF'), { target: { value: 'ZZZ' } })
    expect(screen.getByText('无匹配持仓')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/query/PositionsQuery.test.tsx`
Expected: FAIL——`./PositionsQuery` 模块不存在。

- [ ] **Step 3: 实现**

创建 `frontend/src/modules/query/PositionsQuery.tsx`：

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useQueryStore } from './store'
import { Position } from './Position'

export function PositionsQuery() {
  const positions = useQueryStore((s) => s.positions)
  const fetchPositions = useQueryStore((s) => s.fetchPositions)
  const [search, setSearch] = useState('')

  // 10s 自刷新：完成后调度下一次，避免重入
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchPositions()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchPositions])

  // 合约模糊匹配：instrumentID 子串、大小写不敏感、空输入显示全部
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return positions
    return positions.filter((p) => p.instrumentID.toLowerCase().includes(q))
  }, [positions, search])

  return (
    <div className="positions-query">
      <div className="flow-toolbar">
        <input
          type="text"
          className="position-search"
          placeholder="筛选合约，如 IF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Position positions={filtered} emptyText={search.trim() ? '无匹配持仓' : undefined} />
    </div>
  )
}
```

`frontend/src/modules/query/styles.css` 末尾追加：

```css
/* ── PositionsQuery 合约筛选输入框 ─────────────────── */

.position-search {
  flex: 0 0 200px;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.position-search:focus {
  outline: none;
  border-color: var(--accent);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/query/PositionsQuery.test.tsx`
Expected: 全部 PASS。若有 act 告警同 Task 2 Step 4 处理。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/query/PositionsQuery.tsx frontend/src/modules/query/PositionsQuery.test.tsx frontend/src/modules/query/styles.css
git commit -m "feat(query): 新增持仓查询窗口（合约模糊匹配/自刷新）"
```

---

### Task 5: QueryPanel 缩减 + refreshAll 瘦身 + store 默认 tab 变更

把 `QueryPanel` 的内部 tab 缩减为 成交/资金/止损单 三个（报单/持仓已独立出去），移除 `C` 键处理（已平移到 `OrdersQuery`），`store` 的 `refreshAll` 不再刷 orders/positions，`QueryTab` 类型与默认 `activeTab` 同步收缩到 `trades`。

**Files:**
- Modify: `frontend/src/modules/query/store.ts`（`QueryTab`、默认 `activeTab`、`refreshAll`）
- Modify: `frontend/src/modules/query/QueryPanel.tsx`（TABS、renderContent、移除 C 键）
- Test: `frontend/src/modules/query/store.test.ts`
- Test: `frontend/src/modules/query/QueryPanel.test.tsx`

**Interfaces:**
- Consumes: 前序任务产出的 `OrdersQuery`/`PositionsQuery` 已就位（本任务不直接引用它们）
- Produces: `QueryTab = 'trades' | 'account' | 'stop_orders'`；`refreshAll` 仅刷 trades/account/stopOrders；QueryPanel 仅三个 tab。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/query/store.test.ts` 修改：
- `beforeEach` 中 `activeTab: 'orders'` → `activeTab: 'trades'`。
- 用例 `defaults to orders tab` → 改名 `defaults to trades tab`，断言 `expect(useQueryStore.getState().activeTab).toBe('trades')`。
- 用例 `supports all remaining tab values` 的数组改为 `['trades', 'account', 'stop_orders'] as const`。
- 用例 `refreshAll calls all fetch methods` 改为只断言三个：

```ts
it('refreshAll calls remaining fetch methods (trades/account/stopOrders)', async () => {
  mockRefreshTrades.mockResolvedValue({ trades: [], count: 0 })
  mockRefreshAccount.mockResolvedValue(null as never)
  mockGetStopOrders.mockResolvedValue({ stopOrders: [], count: 0 })

  await useQueryStore.getState().refreshAll()

  expect(mockRefreshTrades).toHaveBeenCalled()
  expect(mockRefreshAccount).toHaveBeenCalled()
  expect(mockGetStopOrders).toHaveBeenCalled()
  expect(mockRefreshOrders).not.toHaveBeenCalled()
  expect(mockRefreshPositions).not.toHaveBeenCalled()
})
```

- 用例 `refreshAll skips when paused` 断言从 `mockRefreshOrders` 改为 `mockRefreshTrades`（`expect(mockRefreshTrades).not.toHaveBeenCalled()`）。
- 用例 `refreshAll skips when already refreshing` 同样改为断言 `mockRefreshTrades`。
- 用例 `refreshAll sets isRefreshing flag` 保留（可保留原 mock 设置，仅不再断言 orders/positions）。

`frontend/src/modules/query/QueryPanel.test.tsx` 修改：
- `beforeEach` 中 `activeTab: 'orders'` → `activeTab: 'trades'`。
- 用例 `renders all 5 tab buttons` → 改为 `renders 3 tab buttons`，只断言 成交/资金/止损单。
- 用例 `defaults to orders tab` → `defaults to trades tab`，断言 `screen.getByText('成交').toHaveClass('active')`。
- 用例 `switches tab on click`：点击目标改为 `资金`，断言 `资金` active、`成交` 非 active。
- 删除用例 `renders OrderFlow when orders tab active` 与 `renders Position when positions tab active`。
- 用例 `删除冗余「查询面板」标题` 中 `screen.getByText('报单')` 改为 `screen.getByText('成交')`（保留 `成交` 断言，去掉 `报单`）。
- 追加断言：`screen.queryByText('报单')).not.toBeInTheDocument()` 与 `screen.queryByText('持仓')).not.toBeInTheDocument()`。

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/modules/query/store.test.ts src/modules/query/QueryPanel.test.tsx`
Expected: 上述改动用例 FAIL（QueryTab 仍含 orders/positions、refreshAll 仍刷 5 项、QueryPanel 仍渲染 5 tab）。

- [ ] **Step 3: 实现**

`frontend/src/modules/query/store.ts`：

```ts
export type QueryTab = 'trades' | 'account' | 'stop_orders'
```

```ts
  activeTab: 'trades',
```

`refreshAll` 改为（删除 orders/positions 两段及其前的 `delay(1200)`）：

```ts
  refreshAll: async () => {
    if (get().isPaused) return
    if (get().isRefreshing) return
    set({ isLoading: true, isRefreshing: true })
    try {
      // 串行执行，CTP 单线程有查询频率限制（~1次/秒），并发会导致后续查询超时
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))

      // 单个查询的超时包装（10秒超时）
      const withTimeout = (promise: Promise<void>, name: string) =>
        Promise.race([promise, timeout(10000).then(() => { throw new Error(`${name} timeout`) })])

      await withTimeout(get().fetchTrades(), 'fetchTrades')
      await delay(1200)
      await withTimeout(get().fetchAccount(), 'fetchAccount')
      await delay(1200)
      await withTimeout(get().fetchStopOrders(), 'fetchStopOrders')
    } catch (err) {
      console.error('refreshAll error:', err)
    } finally {
      set({ isLoading: false, isRefreshing: false })
    }
  },
```

`frontend/src/modules/query/QueryPanel.tsx`：
- `TABS` 改为：

```tsx
const TABS = [
  { key: 'trades' as const, label: '成交' },
  { key: 'account' as const, label: '资金' },
  { key: 'stop_orders' as const, label: '止损单' },
]
```

- `renderContent` 删除 `case 'orders'` 与 `case 'positions'`。
- 删除整个 `onKeyDown` `useCallback` 及其 `useEffect` 键盘监听（约 18 行，含 `window.addEventListener('keydown', ...)`）。注意删除后 `useCallback` 不再需要，若 `import` 中 `useCallback` 无其他使用则一并从 import 移除（`QueryPanel` 中 `useEffect` 仍用，`useCallback` 需检查：删除后仅剩 `useEffect`，故 `import { useEffect } from 'react'`）。
- `activeTab` 初始仍从 store 读，无其它改动。

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/modules/query/store.test.ts src/modules/query/QueryPanel.test.tsx`
Expected: 全部 PASS。再跑 `cd frontend && npx vitest run src/modules/query/` 确认 query 模块整体全绿。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/query/store.ts frontend/src/modules/query/QueryPanel.tsx frontend/src/modules/query/store.test.ts frontend/src/modules/query/QueryPanel.test.tsx
git commit -m "refactor(query): 查询窗口缩减为成交/资金/止损单，refreshAll 瘦身"
```

---

### Task 6: 注册新标签类型 + TabContent 渲染

新增 `query-orders`/`query-positions` 两个 TabType，`TabContent` 渲染对应新窗口组件。

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Test: `frontend/src/stores/tabs.test.ts`
- Test: `frontend/src/components/TabContent/index.test.tsx`

**Interfaces:**
- Consumes: `OrdersQuery`（Task 2）、`PositionsQuery`（Task 4）
- Produces: `TabType` 含 `'query-orders' | 'query-positions'`；Task 7 的菜单类型与 `openFloatingTab` 使用这两个类型。

- [ ] **Step 1: 写失败测试**

`frontend/src/stores/tabs.test.ts` 用例 `应定义所有标签页类型` 的断言数组末尾追加两项：

```ts
expect(TAB_TYPES).toEqual([
  'market',
  'favorites',
  'order',
  'kline',
  'options',
  'ipc-monitor',
  'settings',
  'query',
  'infinite',
  'query-orders',
  'query-positions',
])
```

`frontend/src/components/TabContent/index.test.tsx`：
- 顶部追加两个 mock（与 QueryPanel mock 同模式）：

```tsx
vi.mock('@/modules/query/OrdersQuery', () => ({
  OrdersQuery: () => <div data-testid="orders-query">报单查询 Mock</div>,
}))

vi.mock('@/modules/query/PositionsQuery', () => ({
  PositionsQuery: () => <div data-testid="positions-query">持仓查询 Mock</div>,
}))
```

- `标签类型渲染` 的 `it.each` 追加两行：

```tsx
['query-orders', '报单查询'],
['query-positions', '持仓查询'],
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx`
Expected: FAIL——TAB_TYPES 不含新类型、TabContent 不渲染新组件。

- [ ] **Step 3: 实现**

`frontend/src/stores/tabs.ts`：

```ts
export type TabType =
  | 'market'
  | 'favorites'
  | 'order'
  | 'kline'
  | 'options'
  | 'ipc-monitor'
  | 'settings'
  | 'query'
  | 'infinite'
  | 'query-orders' // 报单查询（独立窗口）
  | 'query-positions' // 持仓查询（独立窗口）
```

```ts
export const TAB_TYPES: TabType[] = [
  'market',
  'favorites',
  'order',
  'kline',
  'options',
  'ipc-monitor',
  'settings',
  'query',
  'infinite',
  'query-orders',
  'query-positions',
]
```

`frontend/src/components/TabContent/index.tsx`：
- import 区追加：

```tsx
import { OrdersQuery } from '@/modules/query/OrdersQuery'
import { PositionsQuery } from '@/modules/query/PositionsQuery'
```

- `renderTabContent` switch 追加两个 case：

```tsx
    case 'query-orders':
      return <OrdersQuery />
    case 'query-positions':
      return <PositionsQuery />
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/stores/tabs.test.ts frontend/src/components/TabContent/index.test.tsx
git commit -m "feat(tabs): 注册报单查询/持仓查询标签类型并接入 TabContent"
```

---

### Task 7: Electron 原生菜单入口 + IPC 类型 + 打开函数 + App 接线

左上角原生菜单「功能」子菜单新增 报单查询窗口/持仓查询窗口 两项，复用 `open-floating` 动作；IPC 类型（preload + renderer 全局声明）扩展；`openFloatingTab` 新增两个打开函数；`App` 处理新浮动 tab。

**Files:**
- Modify: `frontend/electron/menuTemplate.ts`
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/services/electron.ts`（declare global `Window.electronAPI.onOpenFloatingTab` 类型）
- Modify: `frontend/src/utils/openFloatingTab.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`
- Test: `frontend/electron/__tests__/menuActions.test.ts`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `TabType` 含 `'query-orders' | 'query-positions'`（Task 6）
- Produces: `FloatingTab` 联合类型含两个新值；`openOrdersQueryFloating()` / `openPositionsQueryFloating()` 打开浮动窗；原生菜单两个新条目。

- [ ] **Step 1: 写失败测试**

`frontend/electron/__tests__/menuTemplate.test.ts` 用例 `功能子菜单包含报单/K线/查询/分隔符/退出(app-quit)` 的标签断言改为：

```ts
expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 查询窗口', '📋 报单查询窗口', '📋 持仓查询窗口', '退出']);
```

`frontend/electron/__tests__/menuActions.test.ts` 追加用例（`open-floating` 透传新 tab 值）：

```ts
it('open-floating: 透传 query-orders / query-positions', () => {
  resolveAction({ type: 'open-floating', tab: 'query-orders' }, ctx);
  expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query-orders');

  resolveAction({ type: 'open-floating', tab: 'query-positions' }, ctx);
  expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query-positions');
});
```

`frontend/src/App.test.tsx` 的 `顶部菜单 IPC` describe 内追加两个用例（复用 `setElectronAPI`）：

```tsx
it('onOpenFloatingTab query-orders 打开报单查询浮动窗', () => {
  const onOpenFloatingTab = vi.fn()
  setElectronAPI({ onOpenFloatingTab })
  render(<App />)
  const callback = onOpenFloatingTab.mock.calls[0][0]
  act(() => {
    callback('query-orders')
  })
  expect(useFloatingWindowStore.getState().windows['tab-query-orders']).toBeDefined()
  delete (window as any).electronAPI
})

it('onOpenFloatingTab query-positions 打开持仓查询浮动窗', () => {
  const onOpenFloatingTab = vi.fn()
  setElectronAPI({ onOpenFloatingTab })
  render(<App />)
  const callback = onOpenFloatingTab.mock.calls[0][0]
  act(() => {
    callback('query-positions')
  })
  expect(useFloatingWindowStore.getState().windows['tab-query-positions']).toBeDefined()
  delete (window as any).electronAPI
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts src/App.test.tsx`
Expected: 新断言 FAIL（菜单无新条目、FloatingTab 类型不含新值、App 不处理新 tab）。

- [ ] **Step 3: 实现**

`frontend/electron/menuTemplate.ts`：

```ts
export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor' | 'query-orders' | 'query-positions';
```

「功能」子菜单在 `func-query` 后追加两项：

```ts
{ id: 'func-query', label: '📋 查询窗口', action: { type: 'open-floating', tab: 'query' } },
{ id: 'func-query-orders', label: '📋 报单查询窗口', action: { type: 'open-floating', tab: 'query-orders' } },
{ id: 'func-query-positions', label: '📋 持仓查询窗口', action: { type: 'open-floating', tab: 'query-positions' } },
```

`frontend/electron/preload.ts`：两处 `onOpenFloatingTab` 回调类型（`ElectronAPI` 接口定义 + `exposeInMainWorld` 实现处）的联合类型各追加 `| 'query-orders' | 'query-positions'`：

```ts
onOpenFloatingTab: (callback: (tab: 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor' | 'query-orders' | 'query-positions') => void) => () => void;
```

（实现处的 handler 与 `ipcRenderer.on('menu:open-floating', handler)` 行内联类型同步追加。）

`frontend/src/services/electron.ts` 的 `declare global` 中 `onOpenFloatingTab` 类型同样追加：

```ts
onOpenFloatingTab: (callback: (tab: 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor' | 'query-orders' | 'query-positions') => void) => () => void;
```

`frontend/src/utils/openFloatingTab.ts` 末尾追加：

```ts
/** 打开报单查询浮动窗 */
export function openOrdersQueryFloating(): boolean {
  return openFloatingTab({ type: 'query-orders', title: '📋 报单查询' })
}

/** 打开持仓查询浮动窗 */
export function openPositionsQueryFloating(): boolean {
  return openFloatingTab({ type: 'query-positions', title: '📋 持仓查询' })
}
```

`frontend/src/App.tsx`：
- import 追加 `openOrdersQueryFloating`、`openPositionsQueryFloating`。
- `onOpenFloatingTab` switch 追加两个 case：

```tsx
        case 'query-orders':
          openOrdersQueryFloating()
          break
        case 'query-positions':
          openPositionsQueryFloating()
          break
```

- [ ] **Step 4: 运行确认通过**

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts src/App.test.tsx`
Expected: 全部 PASS。

- [ ] **Step 5: 全量回归 + 提交**

Run: `cd frontend && npm test`
Expected: 全量用例 PASS（469+）。TypeScript 检查：`cd frontend && npx tsc --noEmit`（若项目配置了 tsconfig，无类型错误）。

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/preload.ts frontend/src/services/electron.ts frontend/src/utils/openFloatingTab.ts frontend/src/App.tsx frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuActions.test.ts frontend/src/App.test.tsx
git commit -m "feat(electron): 原生菜单新增报单查询/持仓查询入口"
```

---

## 完成标准

- [ ] `OrderFlow` / `Position` 现有测试全绿（复用组件行为未变）
- [ ] `OrdersQuery` 状态筛选三档边界正确（含部分成交归属已成交、已撤单仅全部显示）
- [ ] `PositionsQuery` 合约输入框模糊匹配正确（空→全部、子串、大小写）
- [ ] `QueryPanel` 只显示 成交/资金/止损单，`refreshAll` 只刷三项
- [ ] 原生菜单「功能」含 报单查询窗口/持仓查询窗口，打开即浮动窗口
- [ ] `frontend` 全量 `npm test` 通过
- [ ] Electron 端菜单点击后渲染进程能打开对应浮动窗（人工验证：原生菜单 → 功能 → 报单查询窗口/持仓查询窗口）
