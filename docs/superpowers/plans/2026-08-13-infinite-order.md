# 无限下单（Infinite Order）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个独立的「无限下单」标签页，提供从跌停到涨停的完整价格阶梯，任意价位点击即可报单/撤单，与现有五档报单窗口并存互不影响。

**Architecture:** 纯前端增量，零后端改动。新建 `modules/infinite/` 模块（价格轴纯函数 + 独立 store + 参数区 + 窗口化阶梯组件），新建 `pages/InfiniteOrderPage.tsx` 组装页面，注册为新的 tab 类型 `infinite`。复用共享的纯逻辑（`myOrders.aggregateMyOrders`、`useQueryStore`、`QuickTradeBar`、`AccountBar`、`QtyPreset`、`ConfirmDialog`、校验器），**不触碰** `useOrderStore` 与五档窗口组件，实现状态隔离。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5、Zustand、Vitest + @testing-library/react。

## Global Constraints

- 零后端改动：复用 `POST /api/order/insert`、`/cancel`、`/cancel_all`、`/reverse`，`/api/query/*`。
- **状态隔离（硬约束）**：无限下单页**绝不**读写 `useOrderStore`；新建 `useInfiniteOrderStore` 承载自己的下单参数。
- **不触碰五档窗口**：`MarketDepth` / `OrderForm` / `OrderQuotePanel` / `TradeParams` / `OrderPage` 保持原样，不改内部实现。
- 仅限价报单：阶梯点价 = 限价单（`orderPriceType: 'limit'`），不做市价/套利/止损。
- 数量上限合规：复用 `validateVolumeWithLimit`（限价期货 ≤500、期权 ≤100），后端 Pydantic 权威兜底。
- 路径别名 `@/` → `frontend/src/`；测试命令 `cd frontend && npx vitest run <file>`。
- 命名/文案沿用现有中文交易终端风格（红=买/多，绿=卖/空）。

## File Structure

**新建：**
- `frontend/src/modules/infinite/ladderUtils.ts` — 价格轴 + 五档映射 + tick 格式化的纯函数
- `frontend/src/modules/infinite/store.ts` — `useInfiniteOrderStore`（隔离参数 + submitOrder）
- `frontend/src/modules/infinite/InfiniteTradeParams.tsx` — 左侧参数区（绑定新 store）
- `frontend/src/modules/infinite/InfiniteLadder.tsx` — 完整价格阶梯（窗口化渲染）
- `frontend/src/modules/infinite/InfiniteLadder.css` / `InfiniteTradeParams.css`
- `frontend/src/pages/InfiniteOrderPage.tsx` + `InfiniteOrderPage.css` — 页面组装

**修改：**
- `frontend/src/stores/tabs.ts` — TabType 加 `'infinite'`
- `frontend/src/components/TabContent/index.tsx` — 加 `case 'infinite'`
- `frontend/src/hooks/useTabContractLocks.ts` — `LOCKABLE_TAB_TYPES` 加 `'infinite'`
- `frontend/src/components/TabBar/index.tsx` — `ADD_TAB_ITEMS` 加无限下单项
- `frontend/src/utils/openFloatingTab.ts` + `frontend/src/components/BottomBar/index.tsx` — 底部入口按钮

---

## Task 1: 注册 infinite 标签类型 + 空页面占位

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/hooks/useTabContractLocks.ts`
- Modify: `frontend/src/components/TabBar/index.tsx`
- Create: `frontend/src/pages/InfiniteOrderPage.tsx`

**Interfaces:**
- Produces: tab 类型 `'infinite'` 可通过 `useTabStore.openTab({ type: 'infinite', title, props: { instrumentID? } })` 打开；`InfiniteOrderPage` 接收 `{ instrumentID?: string; floating?: boolean; tabId?: string }`（本任务为占位，Task 5 填充完整实现）。

- [ ] **Step 1: 加 TabType 与 TAB_TYPES**

在 `frontend/src/stores/tabs.ts` 的 `TabType` 联合类型末尾加 `| 'infinite'`，并在 `TAB_TYPES` 数组加 `'infinite'`：

```ts
export type TabType =
  | 'market'
  | 'favorites'
  | 'order'
  | 'kline'
  | 'options'
  | 'ipc-monitor'
  | 'settings'
  | 'query' // 查询（全局账户查询）
  | 'infinite'

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
]
```

- [ ] **Step 2: 创建占位页 `frontend/src/pages/InfiniteOrderPage.tsx`**

```tsx
import './InfiniteOrderPage.css'

interface InfiniteOrderPageProps {
  instrumentID?: string
  floating?: boolean
  tabId?: string
}

/** 无限下单页 — 占位，Task 5 填充完整实现 */
export function InfiniteOrderPage({ instrumentID }: InfiniteOrderPageProps) {
  return (
    <div className="infinite-order-page" data-testid="infinite-order-page">
      <div className="infinite-order-page__title">♾️ 无限下单{instrumentID ? `-${instrumentID}` : ''}</div>
    </div>
  )
}
```

- [ ] **Step 3: 在 TabContent 注册渲染分支**

`frontend/src/components/TabContent/index.tsx`：import 顶部加 `import { InfiniteOrderPage } from '@/pages/InfiniteOrderPage'`；在 `renderTabContent` 的 switch 中 `case 'kline':` 之后加：

```tsx
    case 'infinite':
      return (
        <InfiniteOrderPage
          instrumentID={getInstrumentID(tab.props)}
          floating={floating}
          tabId={tab.id}
        />
      )
```

- [ ] **Step 4: 合约锁定订阅类型**

`frontend/src/hooks/useTabContractLocks.ts` 第 8 行改为：

```ts
const LOCKABLE_TAB_TYPES = new Set(['kline', 'order', 'infinite'])
```

- [ ] **Step 5: TabBar `+` 选择栏加入口**

`frontend/src/components/TabBar/index.tsx` 第 19-24 行 `ADD_TAB_ITEMS` 加一项：

```ts
const ADD_TAB_ITEMS = [
  { type: 'order' as const, icon: '📝', label: '报单', title: '📝 报单' },
  { type: 'kline' as const, icon: '📈', label: 'K线', title: '📈 K线' },
  { type: 'infinite' as const, icon: '♾️', label: '无限下单', title: '♾️ 无限下单' },
  { type: 'query' as const, icon: '📋', label: '查询', title: '📋 查询' },
  { type: 'settings' as const, icon: '⚙', label: '设置', title: '⚙ 设置' },
]
```

- [ ] **Step 6: 运行测试验证无回归**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx src/components/TabBar/index.test.tsx src/hooks/useTabContractLocks.test.ts`
Expected: PASS（新增类型不破坏现有用例）

- [ ] **Step 7: Commit**

```bash
git add src/stores/tabs.ts src/components/TabContent/index.tsx src/hooks/useTabContractLocks.ts src/components/TabBar/index.tsx src/pages/InfiniteOrderPage.tsx
git commit -m "feat(infinite): register infinite tab type with placeholder page"
```

---

## Task 2: 价格轴纯函数 `ladderUtils.ts`

**Files:**
- Create: `frontend/src/modules/infinite/ladderUtils.ts`
- Test: `frontend/src/modules/infinite/ladderUtils.test.ts`

**Interfaces:**
- Consumes: `MarketSnapshot`（`@/services/types`）。
- Produces: `isValidPrice`, `tickDecimals`, `formatTickPrice`, `roundToTick`, `buildPriceAxis`, `buildDepthMaps`（后续 Task 4 依赖）。

- [ ] **Step 1: 写失败测试 `frontend/src/modules/infinite/ladderUtils.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildPriceAxis, buildDepthMaps, isValidPrice, roundToTick } from './ladderUtils'
import type { MarketSnapshot } from '@/services/types'

function snap(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000, ...overrides,
  } as MarketSnapshot
}

describe('buildPriceAxis', () => {
  it('从跌停到涨停按 tick 生成升序价格轴', () => {
    expect(buildPriceAxis(4690, 4700, 0.2)).toEqual([
      4690, 4690.2, 4690.4, 4690.6, 4690.8,
      4691, 4691.2, 4691.4, 4691.6, 4691.8,
      4692, 4692.2, 4692.4, 4692.6, 4692.8,
      4693, 4693.2, 4693.4, 4693.6, 4693.8,
      4694, 4694.2, 4694.4, 4694.6, 4694.8,
      4695, 4695.2, 4695.4, 4695.6, 4695.8,
      4696, 4696.2, 4696.4, 4696.6, 4696.8,
      4697, 4697.2, 4697.4, 4697.6, 4697.8,
      4698, 4698.2, 4698.4, 4698.6, 4698.8,
      4699, 4699.2, 4699.4, 4699.6, 4699.8, 4700,
    ])
  })

  it('涨跌停价无效时返回空数组', () => {
    expect(buildPriceAxis(0, 4700, 0.2)).toEqual([])
    expect(buildPriceAxis(1.7976931348623157e308, 4700, 0.2)).toEqual([])
  })

  it('tick 无效时返回空数组', () => {
    expect(buildPriceAxis(4690, 4700, 0)).toEqual([])
  })

  it('tick 0.02 精度不产生浮点累积误差', () => {
    const axis = buildPriceAxis(500, 501, 0.02)
    expect(axis).toHaveLength(51)
    expect(axis[50]).toBe(501)
    expect(axis.every((p) => Math.abs(p * 50 - Math.round(p * 50)) < 1e-9)).toBe(true)
  })
})

describe('buildDepthMaps', () => {
  it('只提取有效价的五档买卖量', () => {
    const { bidVol, askVol } = buildDepthMaps(snap())
    expect(bidVol.get(4694)).toBe(10)
    expect(askVol.get(4696)).toBe(15)
    expect(bidVol.size).toBe(1)
    expect(askVol.size).toBe(1)
  })
})

describe('isValidPrice', () => {
  it('过滤 0、负数、DBL_MAX、NaN', () => {
    expect(isValidPrice(100)).toBe(true)
    expect(isValidPrice(0)).toBe(false)
    expect(isValidPrice(-1)).toBe(false)
    expect(isValidPrice(1.7976931348623157e308)).toBe(false)
    expect(isValidPrice(NaN)).toBe(false)
  })
})

describe('roundToTick', () => {
  it('按 tick 对齐并去除浮点噪声', () => {
    expect(roundToTick(4696.000000000001, 0.2)).toBe(4696)
    expect(roundToTick(4696.6, 0.2)).toBe(4696.6)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/infinite/ladderUtils.test.ts`
Expected: FAIL（`Cannot find module './ladderUtils'`）

- [ ] **Step 3: 实现 `frontend/src/modules/infinite/ladderUtils.ts`**

```ts
import type { MarketSnapshot } from '@/services/types'

export const CTP_INVALID_PRICE = 1.7976931348623157e308

export function isValidPrice(p: number): boolean {
  return Number.isFinite(p) && p > 0 && p < CTP_INVALID_PRICE
}

export function tickDecimals(tick: number): number {
  const str = String(tick)
  return str.includes('.') ? str.split('.')[1].length : 0
}

export function formatTickPrice(n: number, tick: number): string {
  return n.toFixed(tickDecimals(tick))
}

export function roundToTick(v: number, tick: number): number {
  const decimals = tickDecimals(tick)
  return Number((Math.round(v / tick) * tick).toFixed(decimals))
}

/** 从跌停到涨停生成升序、tick 对齐的完整价格轴；无效输入返回空数组。 */
export function buildPriceAxis(lowerLimit: number, upperLimit: number, tick: number): number[] {
  if (tick <= 0) return []
  if (!isValidPrice(lowerLimit) || !isValidPrice(upperLimit)) return []
  const lower = Math.round(lowerLimit / tick) * tick
  const upper = Math.round(upperLimit / tick) * tick
  if (upper <= lower) return []
  const steps = Math.round((upper - lower) / tick)
  const decimals = tickDecimals(tick)
  const out: number[] = new Array(steps + 1)
  for (let i = 0; i <= steps; i++) {
    out[i] = Number((lower + i * tick).toFixed(decimals))
  }
  return out
}

/** 提取快照五档买/卖量到 price→volume 映射（仅有效价）。 */
export function buildDepthMaps(snapshot: MarketSnapshot): {
  bidVol: Map<number, number>
  askVol: Map<number, number>
} {
  const bidVol = new Map<number, number>()
  const askVol = new Map<number, number>()
  const levels: Array<[number, number, number, number]> = [
    [snapshot.bidPrice1, snapshot.bidVolume1, snapshot.askPrice1, snapshot.askVolume1],
    [snapshot.bidPrice2, snapshot.bidVolume2, snapshot.askPrice2, snapshot.askVolume2],
    [snapshot.bidPrice3, snapshot.bidVolume3, snapshot.askPrice3, snapshot.askVolume3],
    [snapshot.bidPrice4, snapshot.bidVolume4, snapshot.askPrice4, snapshot.askVolume4],
    [snapshot.bidPrice5, snapshot.bidVolume5, snapshot.askPrice5, snapshot.askVolume5],
  ]
  for (const [bp, bv, ap, av] of levels) {
    if (isValidPrice(bp) && bv > 0) bidVol.set(bp, bv)
    if (isValidPrice(ap) && av > 0) askVol.set(ap, av)
  }
  return { bidVol, askVol }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/infinite/ladderUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/infinite/ladderUtils.ts src/modules/infinite/ladderUtils.test.ts
git commit -m "feat(infinite): add price axis and depth-map pure helpers"
```

---

## Task 3: 隔离 store `useInfiniteOrderStore`

**Files:**
- Create: `frontend/src/modules/infinite/store.ts`
- Test: `frontend/src/modules/infinite/store.test.ts`

**Interfaces:**
- Consumes: `submitOrder`（`@/services/api`）、`useContractsStore`、`validateVolumeWithLimit`（`@/utils/validators`）、`OrderRequestForm`（`@/utils/orderMapping`）。
- Produces: `useInfiniteOrderStore`；`InfiniteOrderIntent` 类型；`setInstrument`, `setField`, `submitOrder`（Task 4/5 依赖）。

- [ ] **Step 1: 写失败测试 `frontend/src/modules/infinite/store.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInfiniteOrderStore } from './store'
import { useOrderStore } from '../order/store'

vi.mock('@/services/api', () => ({
  submitOrder: vi.fn(),
}))
vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { submitOrder as apiSubmitOrder } from '@/services/api'

const intent = (overrides?: Partial<{ direction: 'buy' | 'sell'; price: number; volume: number; combOffsetFlag: 'open' | 'close' | 'close_today'; timeCondition: 'gfd' | 'fok' | 'fak' }>) => ({
  direction: 'buy' as const,
  price: 4696,
  volume: 1,
  combOffsetFlag: 'open' as const,
  timeCondition: 'gfd' as const,
  ...overrides,
})

describe('useInfiniteOrderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: '', exchangeID: 'CFFEX', lastSubmitError: null })
  })

  it('未选合约时 submitOrder 返回 false', async () => {
    const ok = await useInfiniteOrderStore.getState().submitOrder(intent())
    expect(ok).toBe(false)
    expect(apiSubmitOrder).not.toHaveBeenCalled()
  })

  it('有效参数调用 api submitOrder 并返回 true', async () => {
    vi.mocked(apiSubmitOrder).mockResolvedValue({ success: true, orderRef: 'R1' } as never)
    useInfiniteOrderStore.setState({ instrumentID: 'IF2608' })
    const ok = await useInfiniteOrderStore.getState().submitOrder(intent())
    expect(ok).toBe(true)
    expect(apiSubmitOrder).toHaveBeenCalledWith(expect.objectContaining({
      instrumentID: 'IF2608',
      direction: 'buy',
      limitPrice: 4696,
      volumeTotalOriginal: 1,
      orderPriceType: 'limit',
    }))
  })

  it('不读写 useOrderStore，实现状态隔离', () => {
    const before = useOrderStore.getState().orderForm
    useInfiniteOrderStore.getState().setInstrument('IF2608')
    useInfiniteOrderStore.getState().setField({ volumeTotalOriginal: 7 })
    expect(useOrderStore.getState().orderForm).toEqual(before)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/infinite/store.test.ts`
Expected: FAIL（`Cannot find module './store'`）

- [ ] **Step 3: 实现 `frontend/src/modules/infinite/store.ts`**

```ts
import { create } from 'zustand'
import { submitOrder as apiSubmitOrder } from '@/services/api'
import { toast } from '@/components/Toast'
import { useContractsStore } from '@/stores/contracts'
import { validateVolumeWithLimit } from '@/utils/validators'
import type { OrderRequestForm } from '@/utils/orderMapping'

export interface InfiniteOrderIntent {
  direction: 'buy' | 'sell'
  price: number
  volume: number
  combOffsetFlag: 'open' | 'close' | 'close_today'
  timeCondition: 'gfd' | 'fok' | 'fak'
}

interface InfiniteOrderState {
  instrumentID: string
  exchangeID: string
  combOffsetFlag: 'open' | 'close' | 'close_today'
  combHedgeFlag: 'speculation' | 'arbitrage' | 'hedge'
  timeCondition: 'gfd' | 'fok' | 'fak'
  volumeTotalOriginal: number
  volumeStep: number
  lastSubmitError: string | null
  setInstrument: (instrumentID: string, exchangeID?: string) => void
  setField: (patch: Partial<Pick<InfiniteOrderState,
    'combOffsetFlag' | 'combHedgeFlag' | 'timeCondition' | 'volumeTotalOriginal' | 'volumeStep'>>) => void
  submitOrder: (intent: InfiniteOrderIntent) => Promise<boolean>
}

export const useInfiniteOrderStore = create<InfiniteOrderState>((set, get) => ({
  instrumentID: '',
  exchangeID: 'CFFEX',
  combOffsetFlag: 'open',
  combHedgeFlag: 'speculation',
  timeCondition: 'gfd',
  volumeTotalOriginal: 1,
  volumeStep: 1,
  lastSubmitError: null,

  setInstrument: (instrumentID, exchangeID) => {
    let exch = exchangeID ?? 'CFFEX'
    if (!exchangeID) {
      const contract = useContractsStore.getState().contracts.find((c) => c.instrumentID === instrumentID)
      if (contract?.exchangeID) exch = contract.exchangeID
    }
    set({ instrumentID, exchangeID: exch })
  },

  setField: (patch) => set(patch),

  submitOrder: async (intent) => {
    const fail = (msg: string): false => {
      set({ lastSubmitError: msg })
      toast.error(`报单失败：${msg}`)
      return false
    }
    set({ lastSubmitError: null })

    const { instrumentID, exchangeID, combHedgeFlag } = get()
    if (!instrumentID) return fail('请选择合约')
    if (!Number.isFinite(intent.price) || intent.price <= 0) return fail('请输入有效价格')

    const contracts = useContractsStore.getState().contracts
    const productClass = contracts.find((c) => c.instrumentID === instrumentID)?.productClass ?? '1'
    const volErr = validateVolumeWithLimit(intent.volume, 'limit', productClass)
    if (volErr) return fail(volErr)

    const form: OrderRequestForm = {
      instrumentID,
      exchangeID,
      direction: intent.direction,
      combOffsetFlag: intent.combOffsetFlag,
      combHedgeFlag,
      orderPriceType: 'limit',
      timeCondition: intent.timeCondition,
      limitPrice: intent.price,
      volumeTotalOriginal: intent.volume,
      productClass,
    }

    try {
      const result = await apiSubmitOrder(form)
      if (result.success) {
        toast.success(`报单成功 ${result.orderRef}`)
        return true
      }
      return fail(result.message || result.error || '未知错误')
    } catch (e) {
      return fail(e instanceof Error ? e.message : '未知错误')
    }
  },
}))
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/infinite/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/infinite/store.ts src/modules/infinite/store.test.ts
git commit -m "feat(infinite): add isolated order store"
```

---

## Task 4: 窗口化阶梯组件 `InfiniteLadder`

**Files:**
- Create: `frontend/src/modules/infinite/InfiniteLadder.tsx`
- Create: `frontend/src/modules/infinite/InfiniteLadder.css`
- Test: `frontend/src/modules/infinite/InfiniteLadder.test.tsx`

**Interfaces:**
- Consumes: `buildPriceAxis`/`buildDepthMaps`/`roundToTick`/`formatTickPrice`/`isValidPrice`（Task 2）、`useInfiniteOrderStore`（Task 3）、`aggregateMyOrders`（`@/modules/order/myOrders`）、`useQueryStore`、`ConfirmDialog`。
- Produces: `InfiniteLadder({ snapshot, priceTick, instrumentID })`（Task 5 依赖）。

- [ ] **Step 1: 写失败测试 `frontend/src/modules/infinite/InfiniteLadder.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfiniteLadder } from './InfiniteLadder'
import type { MarketSnapshot } from '@/services/types'

vi.mock('@/services/api')
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useInfiniteOrderStore } from './store'
import { useQueryStore } from '../query/store'

function snap(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000, ...overrides,
  } as MarketSnapshot
}

describe('InfiniteLadder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: 'IF2608', volumeTotalOriginal: 1 })
    useQueryStore.setState({ orders: [] })
  })

  it('渲染四列表头 可撤/买入量/价格/卖出量', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    expect(screen.getByText('可撤')).toBeInTheDocument()
    expect(screen.getByText('买入量')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('卖出量')).toBeInTheDocument()
  })

  it('窗口化：仅渲染可视区行，而非全轴', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    // 轴长 51 行，可视区+overscan 应远小于 51
    const rows = screen.getAllByTestId(/^ladder-row-/)
    expect(rows.length).toBeLessThan(51)
  })

  it('点击买入量列弹出确认框', () => {
    render(<InfiniteLadder snapshot={snap()} priceTick={0.2} instrumentID="IF2608" />)
    const bidCell = screen.getAllByTestId(/^bid-cell-/)[0]
    fireEvent.click(bidCell)
    expect(screen.getByText('确认报单')).toBeInTheDocument()
  })

  it('涨跌停价无效时显示空态', () => {
    render(<InfiniteLadder snapshot={snap({ upperLimitPrice: 0 })} priceTick={0.2} instrumentID="IF2608" />)
    expect(screen.getByText(/未订阅行情或涨跌停价无效/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/infinite/InfiniteLadder.test.tsx`
Expected: FAIL（`Cannot find module './InfiniteLadder'`）

- [ ] **Step 3: 实现 `frontend/src/modules/infinite/InfiniteLadder.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MarketSnapshot } from '@/services/types'
import { useQueryStore } from '@/modules/query/store'
import { aggregateMyOrders } from '@/modules/order/myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useInfiniteOrderStore, type InfiniteOrderIntent } from './store'
import { buildPriceAxis, buildDepthMaps, isValidPrice, roundToTick, formatTickPrice } from './ladderUtils'
import './InfiniteLadder.css'

const ROW_HEIGHT = 24
const OVERSCAN = 10
const OFFSET_LABEL: Record<string, string> = { open: '开', close: '平', close_today: '平今' }

interface InfiniteLadderProps {
  snapshot: MarketSnapshot | null
  priceTick: number
  instrumentID: string
}

export function InfiniteLadder({ snapshot, priceTick, instrumentID }: InfiniteLadderProps) {
  const volume = useInfiniteOrderStore((s) => s.volumeTotalOriginal)
  const combOffsetFlag = useInfiniteOrderStore((s) => s.combOffsetFlag)
  const timeCondition = useInfiniteOrderStore((s) => s.timeCondition)
  const submitOrder = useInfiniteOrderStore((s) => s.submitOrder)
  const orders = useQueryStore((s) => s.orders)
  const handleCancelOrder = useQueryStore((s) => s.handleCancelOrder)

  const [intent, setIntent] = useState<InfiniteOrderIntent | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const axis = useMemo(
    () => buildPriceAxis(snapshot?.lowerLimitPrice ?? 0, snapshot?.upperLimitPrice ?? 0, priceTick),
    [snapshot, priceTick],
  )
  const depth = useMemo(
    () => (snapshot ? buildDepthMaps(snapshot) : { bidVol: new Map<number, number>(), askVol: new Map<number, number>() }),
    [snapshot],
  )
  const myOrders = useMemo(() => aggregateMyOrders(orders, instrumentID), [orders, instrumentID])

  const lastPrice = snapshot && isValidPrice(snapshot.lastPrice) ? roundToTick(snapshot.lastPrice, priceTick) : null
  const lastIndex = lastPrice !== null ? axis.indexOf(lastPrice) : -1

  const maxVol = useMemo(() => {
    let m = 0
    depth.bidVol.forEach((v) => { if (v > m) m = v })
    depth.askVol.forEach((v) => { if (v > m) m = v })
    return m
  }, [depth])

  // ── 窗口化 ──
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const followRef = useRef(true)
  const programmaticRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setViewportH(el.clientHeight || 600)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const centerOn = (index: number) => {
    const el = viewportRef.current
    if (!el || index < 0) return
    programmaticRef.current = true
    el.scrollTop = Math.max(0, index * ROW_HEIGHT - el.clientHeight / 2 + ROW_HEIGHT / 2)
  }

  useEffect(() => {
    if (lastIndex >= 0 && followRef.current) centerOn(lastIndex)
  }, [lastIndex, viewportH])

  useEffect(() => {
    followRef.current = true
    if (lastIndex >= 0) centerOn(lastIndex)
  }, [instrumentID])

  const onScroll = () => {
    const el = viewportRef.current
    if (!el) return
    if (programmaticRef.current) {
      programmaticRef.current = false
      return
    }
    followRef.current = false
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => { followRef.current = true }, 3000)
    setScrollTop(el.scrollTop)
  }

  useEffect(() => () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }, [])

  const totalH = axis.length * ROW_HEIGHT
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(axis.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN)

  const openIntent = (direction: 'buy' | 'sell', price: number) => {
    setIntent({ direction, price, volume, combOffsetFlag, timeCondition })
  }

  const cancelMyOrders = async (refs: string[]) => {
    for (const ref of refs) await handleCancelOrder(ref)
    useQueryStore.getState().fetchOrders()
  }

  const handleConfirm = async () => {
    if (!intent) return
    setIntent(null)
    const ok = await submitOrder(intent)
    if (ok) {
      useQueryStore.getState().fetchOrders()
    } else {
      setBanner(useInfiniteOrderStore.getState().lastSubmitError ?? '报单失败')
      setTimeout(() => setBanner(null), 4000)
    }
  }

  if (!snapshot || axis.length === 0) {
    return <div className="infinite-ladder infinite-ladder--empty">未订阅行情或涨跌停价无效</div>
  }

  return (
    <div className="infinite-ladder">
      {banner && <div className="infinite-ladder__banner" role="alert">{banner}</div>}
      <div className="infinite-ladder__head">
        <span>可撤</span><span>买入量</span><span>价格</span><span>卖出量</span>
      </div>
      <div className="infinite-ladder__viewport" ref={viewportRef} onScroll={onScroll}>
        <div className="infinite-ladder__spacer" style={{ height: totalH }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {axis.slice(start, end).map((price, i) => {
              const idx = start + i
              const level = myOrders.byPrice.get(price)
              const bidVol = depth.bidVol.get(price) ?? 0
              const askVol = depth.askVol.get(price) ?? 0
              const isLast = idx === lastIndex
              return (
                <div
                  key={price}
                  data-testid={`ladder-row-${idx}`}
                  className={`infinite-row${isLast ? ' infinite-row--last' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="infinite-row__cancel">
                    {level && level.buyVolume > 0 && (
                      <button
                        type="button"
                        className="infinite-row__my infinite-row__my--buy"
                        onClick={() => cancelMyOrders(level.buyRefs)}
                      >
                        {level.buyVolume}
                      </button>
                    )}
                    {level && level.sellVolume > 0 && (
                      <button
                        type="button"
                        className="infinite-row__my infinite-row__my--sell"
                        onClick={() => cancelMyOrders(level.sellRefs)}
                      >
                        {level.sellVolume}
                      </button>
                    )}
                  </span>
                  <span
                    data-testid={`bid-cell-${idx}`}
                    className="infinite-row__bid"
                    style={{ '--vol-pct': `${maxVol > 0 ? Math.round((bidVol / maxVol) * 100) : 0}%` } as React.CSSProperties}
                    onClick={() => openIntent('buy', price)}
                  >
                    {bidVol > 0 ? bidVol : ''}
                  </span>
                  <span className="infinite-row__price">{formatTickPrice(price, priceTick)}</span>
                  <span
                    data-testid={`ask-cell-${idx}`}
                    className="infinite-row__ask"
                    style={{ '--vol-pct': `${maxVol > 0 ? Math.round((askVol / maxVol) * 100) : 0}%` } as React.CSSProperties}
                    onClick={() => openIntent('sell', price)}
                  >
                    {askVol > 0 ? askVol : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {intent && (
        <ConfirmDialog
          title="确认报单"
          details={[
            { label: '方向', value: intent.direction === 'buy' ? '买入' : '卖出' },
            { label: '价格', value: formatTickPrice(intent.price, priceTick) },
            { label: '手数', value: String(intent.volume) },
            { label: '开平', value: OFFSET_LABEL[intent.combOffsetFlag] ?? intent.combOffsetFlag },
          ]}
          onConfirm={handleConfirm}
          onCancel={() => setIntent(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: 创建 `frontend/src/modules/infinite/InfiniteLadder.css`**

```css
.infinite-ladder { display: flex; flex-direction: column; height: 100%; background: #1a1d23; }
.infinite-ladder--empty { align-items: center; justify-content: center; color: #9ca3af; }
.infinite-ladder__banner { background: #7f1d1d; color: #fca5a5; padding: 4px 12px; font-size: 12px; }
.infinite-ladder__head,
.infinite-row { display: grid; grid-template-columns: 60px 80px 1fr 80px; align-items: center; }
.infinite-ladder__head { color: #9ca3af; font-size: 12px; padding: 0 8px; height: 24px; border-bottom: 1px solid #3a3f4b; }
.infinite-ladder__viewport { flex: 1; overflow-y: auto; }
.infinite-ladder__spacer { position: relative; }
.infinite-row { font-size: 12px; font-variant-numeric: tabular-nums; border-bottom: 1px solid #242830; }
.infinite-row--last { background: #2d5a8a; }
.infinite-row__cancel { display: flex; gap: 4px; padding-left: 4px; }
.infinite-row__my { border: none; border-radius: 3px; padding: 0 4px; font-size: 11px; cursor: pointer; color: #fff; }
.infinite-row__my--buy { background: #b91c1c; }
.infinite-row__my--sell { background: #15803d; }
.infinite-row__bid,
.infinite-row__ask { text-align: right; padding: 0 6px; cursor: pointer; position: relative; }
.infinite-row__bid { color: #ef4444; background: linear-gradient(to left, rgba(239,68,68,.35) var(--vol-pct), transparent var(--vol-pct)); }
.infinite-row__ask { color: #22c55e; background: linear-gradient(to right, rgba(34,197,94,.35) var(--vol-pct), transparent var(--vol-pct)); }
.infinite-row__price { text-align: center; color: #e4e6eb; cursor: pointer; font-family: Consolas, monospace; }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/infinite/InfiniteLadder.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/infinite/InfiniteLadder.tsx src/modules/infinite/InfiniteLadder.css src/modules/infinite/InfiniteLadder.test.tsx
git commit -m "feat(infinite): add windowed full-range ladder component"
```

---

## Task 5: 页面组装 + 参数区

**Files:**
- Create: `frontend/src/modules/infinite/InfiniteTradeParams.tsx` + `InfiniteTradeParams.css`
- Modify: `frontend/src/pages/InfiniteOrderPage.tsx`（替换 Task 1 占位）
- Create: `frontend/src/pages/InfiniteOrderPage.css`
- Test: `frontend/src/pages/InfiniteOrderPage.test.tsx`

**Interfaces:**
- Consumes: `InfiniteLadder`（Task 4）、`useInfiniteOrderStore`（Task 3）、`AccountBar`/`QuickTradeBar`/`QtyPreset`（现有模块）、`ContractSearch`/`ConfirmDialog`、`useQueryStore`、`useContractsStore`、`useHotKeys`、`useUserPrefsStore`、`useTabStore`。
- Produces: 完整 `InfiniteOrderPage`，替换占位，`TabContent` 已接入（Task 1）。

- [ ] **Step 1: 实现参数区 `frontend/src/modules/infinite/InfiniteTradeParams.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useInfiniteOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useQueryStore } from '@/modules/query/store'
import { validateVolumeWithLimit, getVolumeLimit } from '@/utils/validators'
import { reversePosition } from '@/services/api'
import { ACTIVE_ORDER_STATUSES } from '@/modules/order/myOrders'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { ContractSearch } from '@/components/ContractSearch'
import { QtyPreset } from '@/modules/order/QtyPreset'
import type { InfiniteOrderState } from './store'
import './InfiniteTradeParams.css'

interface InfiniteTradeParamsProps {
  instrumentID?: string
  onSwitch?: (instrumentID: string) => void
}

export function InfiniteTradeParams({ instrumentID, onSwitch }: InfiniteTradeParamsProps) {
  const order = useInfiniteOrderStore((s) => s)
  const contracts = useContractsStore((s) => s.contracts)

  const activeInstrument = instrumentID ?? ''
  const productClass = useMemo(() => {
    const c = contracts.find((x) => x.instrumentID === activeInstrument)
    return c?.productClass ?? '1'
  }, [contracts, activeInstrument])

  const volumeLimit = getVolumeLimit('limit', productClass)
  const volumeError = validateVolumeWithLimit(order.volumeTotalOriginal, 'limit', productClass)

  const [confirmOp, setConfirmOp] = useState<'cancelAll' | 'flatNet' | null>(null)
  const [opPending, setOpPending] = useState(false)

  const handleContractSelect = (code: string) => {
    order.setInstrument(code)
    onSwitch?.(code)
  }

  const handleCancelLatest = async () => {
    await useQueryStore.getState().fetchOrders()
    const mine = useQueryStore.getState().orders
      .filter((o) => o.instrumentID === activeInstrument && ACTIVE_ORDER_STATUSES.includes(o.orderStatus))
      .sort((a, b) => (b.insertTime ?? '').localeCompare(a.insertTime ?? ''))
    const latest = mine[0]
    if (!latest) { toast.error('暂无该合约可撤报单'); return }
    await useQueryStore.getState().handleCancelOrder(latest.orderRef)
  }

  const handleCancelAll = async () => {
    if (opPending) return
    setOpPending(true)
    try { await useQueryStore.getState().handleCancelAll(); setConfirmOp(null) }
    finally { setOpPending(false) }
  }

  const handleFlatNet = async () => {
    if (opPending) return
    setOpPending(true)
    try {
      const res = await reversePosition({ instrumentID: activeInstrument, executionMode: 'serial' })
      if (res.success) { toast.success('平净仓已提交'); useQueryStore.getState().fetchPositions() }
      else toast.error(`平净仓失败：${res.message || '未知错误'}`)
      setConfirmOp(null)
    } catch (e) {
      toast.error(`平净仓失败：${e instanceof Error ? e.message : '未知错误'}`)
      setConfirmOp(null)
    } finally { setOpPending(false) }
  }

  const setField = useInfiniteOrderStore((s) => s.setField)

  return (
    <div className="infinite-trade-params">
      <div className="itp-row">
        <span className="itp-row__label">合约</span>
        <ContractSearch key={activeInstrument} contracts={contracts} initialQuery={activeInstrument} onSelect={handleContractSelect} placeholder={activeInstrument ? undefined : '请选择合约'} />
      </div>
      <div className="itp-row">
        <span className="itp-row__label">开平</span>
        <select className="itp-row__select" aria-label="开平" value={order.combOffsetFlag}
          onChange={(e) => setField({ combOffsetFlag: e.target.value as InfiniteOrderState['combOffsetFlag'] })}>
          <option value="open">开</option><option value="close">平</option><option value="close_today">平今</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">投保</span>
        <select className="itp-row__select" aria-label="投保" value={order.combHedgeFlag}
          onChange={(e) => setField({ combHedgeFlag: e.target.value as InfiniteOrderState['combHedgeFlag'] })}>
          <option value="speculation">投机</option><option value="arbitrage">套利优惠</option><option value="hedge">套保</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">有效期</span>
        <select className="itp-row__select" aria-label="有效期" value={order.timeCondition}
          onChange={(e) => setField({ timeCondition: e.target.value as InfiniteOrderState['timeCondition'] })}>
          <option value="gfd">GFD</option><option value="fok">FOK</option><option value="fak">FAK</option>
        </select>
      </div>
      <div className="itp-row">
        <span className="itp-row__label">手数</span>
        <div className="itp-stepper">
          <button type="button" className="itp-stepper__btn" aria-label="减手数"
            onClick={() => setField({ volumeTotalOriginal: Math.max(1, order.volumeTotalOriginal - order.volumeStep) })}>−</button>
          <input type="number" className="itp-stepper__input" value={order.volumeTotalOriginal} min={1} step={order.volumeStep}
            onChange={(e) => setField({ volumeTotalOriginal: Math.max(1, Number(e.target.value)) })} />
          <button type="button" className="itp-stepper__btn" aria-label="加手数"
            disabled={order.volumeTotalOriginal >= volumeLimit}
            onClick={() => setField({ volumeTotalOriginal: Math.min(volumeLimit, order.volumeTotalOriginal + order.volumeStep) })}>+</button>
        </div>
      </div>
      <div className={`itp-hint${volumeError ? ' itp-hint--error' : ''}`}>
        <span>最大 {volumeLimit} 手</span>
        {volumeError && <span className="itp-hint__error">{volumeError}</span>}
      </div>
      <div className="itp-row">
        <span className="itp-row__label">快捷</span>
        <QtyPreset step={order.volumeStep} onSelect={(v) => setField({ volumeStep: v })} />
      </div>
      <div className="itp-row itp-row--ops">
        <button type="button" className="itp-op-btn" onClick={handleCancelLatest} disabled={opPending || !activeInstrument}>撤最新</button>
        <button type="button" className="itp-op-btn" onClick={() => setConfirmOp('cancelAll')} disabled={opPending || !activeInstrument}>撤全部</button>
      </div>
      <button type="button" className="itp-op-btn itp-op-btn--primary" onClick={() => setConfirmOp('flatNet')} disabled={opPending || !activeInstrument}>平净仓</button>

      {confirmOp === 'cancelAll' && (
        <ConfirmDialog title="确认撤全部" details={[{ label: '范围', value: '所有未成交报单' }]}
          warning="将撤销所有未成交报单（全部合约），请确认。" onConfirm={handleCancelAll} onCancel={() => setConfirmOp(null)} />
      )}
      {confirmOp === 'flatNet' && (
        <ConfirmDialog title="确认平净仓" details={[{ label: '合约', value: activeInstrument }]}
          warning="将平掉当前合约全部净持仓并反向开仓（市价串行），会真实下单，请确认。" onConfirm={handleFlatNet} onCancel={() => setConfirmOp(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建参数区 CSS `InfiniteTradeParams.css`**

```css
.infinite-trade-params { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #242830; }
.itp-row { display: flex; align-items: center; gap: 8px; }
.itp-row__label { width: 44px; color: #9ca3af; font-size: 12px; flex-shrink: 0; }
.itp-row__select { flex: 1; background: #2d3139; color: #e4e6eb; border: 1px solid #3a3f4b; border-radius: 4px; height: 28px; }
.itp-stepper { display: flex; flex: 1; }
.itp-stepper__btn { width: 28px; background: #2d3139; color: #e4e6eb; border: 1px solid #3a3f4b; }
.itp-stepper__input { flex: 1; text-align: center; background: #2d3139; color: #e4e6eb; border: 1px solid #3a3f4b; }
.itp-hint { font-size: 11px; color: #6b7280; }
.itp-hint--error { color: #ef4444; }
.itp-row--ops { display: flex; gap: 8px; }
.itp-op-btn { flex: 1; height: 28px; background: #2d3139; color: #e4e6eb; border: 1px solid #3a3f4b; border-radius: 4px; cursor: pointer; }
.itp-op-btn--primary { width: 100%; margin-top: 4px; background: #2563eb; color: #fff; }
```

- [ ] **Step 3: 替换占位页 `frontend/src/pages/InfiniteOrderPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { AccountBar } from '@/modules/order/AccountBar'
import { InfiniteTradeParams } from '@/modules/infinite/InfiniteTradeParams'
import { InfiniteLadder } from '@/modules/infinite/InfiniteLadder'
import { useInfiniteOrderStore } from '@/modules/infinite/store'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useQueryStore } from '@/modules/query/store'
import { useTabStore } from '@/stores/tabs'
import { OrderFlow } from '@/modules/query/OrderFlow'
import { TradeFlow } from '@/modules/query/TradeFlow'
import { Position } from '@/modules/query/Position'
import './InfiniteOrderPage.css'

interface InfiniteOrderPageProps {
  instrumentID?: string
  floating?: boolean
  tabId?: string
}

type RightTab = 'positions' | 'orders' | 'trades'

export function InfiniteOrderPage({ instrumentID, floating = false, tabId }: InfiniteOrderPageProps) {
  const setInstrument = useInfiniteOrderStore((s) => s.setInstrument)
  const contracts = useContractsStore((s) => s.contracts)
  const snapshots = useMarketStore((s) => s.snapshots)
  const updateTab = useTabStore((s) => s.updateTab)
  const [rightTab, setRightTab] = useState<RightTab>('positions')

  useEffect(() => {
    if (instrumentID) setInstrument(instrumentID)
  }, [instrumentID, setInstrument])

  useEffect(() => {
    if (contracts.length === 0) useContractsStore.getState().loadAllInstruments()
  }, [contracts.length])

  // 报单流水 10s 自刷新（供阶梯「可撤」列 + 委托 tab），对齐 MarketDepth 节奏
  useEffect(() => {
    if (!instrumentID) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      if (useQueryStore.getState().isPaused) { timer = setTimeout(load, 10_000); return }
      await useQueryStore.getState().fetchOrders()
      if (disposed) return
      timer = setTimeout(load, 10_000)
    }
    load()
    return () => { disposed = true; clearTimeout(timer) }
  }, [instrumentID])

  const contract = contracts.find((c) => c.instrumentID === instrumentID)
  const priceTick = contract?.priceTick ?? 0.2
  const snapshot = instrumentID ? snapshots.get(instrumentID) : undefined

  const handleSwitch = (code: string) => {
    if (tabId && code !== instrumentID) {
      updateTab(tabId, { props: { instrumentID: code }, title: `♾️ 无限下单-${code}` })
    }
  }

  return (
    <div className="infinite-order-page" data-testid="infinite-order-page">
      <div className="infinite-order-page__top">
        <AccountBar instrumentID={instrumentID ?? ''} />
        {snapshot && (
          <span className="infinite-order-page__limits">
            涨停 {snapshot.upperLimitPrice} / 跌停 {snapshot.lowerLimitPrice}
          </span>
        )}
      </div>
      <div className="infinite-order-page__body">
        <InfiniteTradeParams instrumentID={instrumentID} onSwitch={handleSwitch} />
        <InfiniteLadder snapshot={snapshot ?? null} priceTick={priceTick} instrumentID={instrumentID ?? ''} />
        <div className="infinite-order-page__right">
          <div className="infinite-order-page__right-tabs">
            <button type="button" className={rightTab === 'positions' ? 'active' : ''} onClick={() => setRightTab('positions')}>持仓</button>
            <button type="button" className={rightTab === 'orders' ? 'active' : ''} onClick={() => setRightTab('orders')}>委托</button>
            <button type="button" className={rightTab === 'trades' ? 'active' : ''} onClick={() => setRightTab('trades')}>成交</button>
          </div>
          {rightTab === 'positions' && <Position />}
          {rightTab === 'orders' && <OrderFlow />}
          {rightTab === 'trades' && <TradeFlow />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 创建页面 CSS `frontend/src/pages/InfiniteOrderPage.css`**

```css
.infinite-order-page { display: flex; flex-direction: column; height: 100%; background: #1a1d23; }
.infinite-order-page__top { display: flex; align-items: center; gap: 16px; padding: 6px 12px; background: #242830; border-bottom: 1px solid #3a3f4b; }
.infinite-order-page__limits { font-size: 12px; color: #9ca3af; }
.infinite-order-page__body { flex: 1; display: grid; grid-template-columns: 220px 1fr 260px; min-height: 0; }
.infinite-order-page__right { display: flex; flex-direction: column; border-left: 1px solid #3a3f4b; min-height: 0; overflow: auto; }
.infinite-order-page__right-tabs { display: flex; gap: 4px; padding: 8px; }
.infinite-order-page__right-tabs button { flex: 1; height: 26px; background: #2d3139; color: #9ca3af; border: 1px solid #3a3f4b; border-radius: 4px; cursor: pointer; }
.infinite-order-page__right-tabs button.active { background: #2563eb; color: #fff; }
```

- [ ] **Step 5: 写页面集成测试 `frontend/src/pages/InfiniteOrderPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfiniteOrderPage } from './InfiniteOrderPage'

vi.mock('@/services/api')
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useInfiniteOrderStore } from '@/modules/infinite/store'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot } from '@/services/types'

function makeSnapshot(): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000,
  } as MarketSnapshot
}

describe('InfiniteOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: '', exchangeID: 'CFFEX' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
  })

  it('渲染账户栏、参数区、阶梯、右侧功能 tab', () => {
    render(<InfiniteOrderPage instrumentID="IF2608" />)
    expect(screen.getByTestId('infinite-order-page')).toBeInTheDocument()
    expect(screen.getByTestId('account-bar')).toBeInTheDocument()
    expect(screen.getByText('可撤')).toBeInTheDocument()
    expect(screen.getByText('持仓')).toBeInTheDocument()
    expect(screen.getByText('委托')).toBeInTheDocument()
    expect(screen.getByText('成交')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/InfiniteOrderPage.test.tsx`
Expected: PASS

- [ ] **Step 7: 全量前端测试回归**

Run: `cd frontend && npm test`
Expected: PASS（469+ 用例全绿，五档窗口用例未被破坏）

- [ ] **Step 8: Commit**

```bash
git add src/modules/infinite/InfiniteTradeParams.tsx src/modules/infinite/InfiniteTradeParams.css src/pages/InfiniteOrderPage.tsx src/pages/InfiniteOrderPage.css src/pages/InfiniteOrderPage.test.tsx
git commit -m "feat(infinite): assemble infinite order page with params and query panels"
```

---

## Task 6: 底部入口按钮 + 浮动窗

**Files:**
- Modify: `frontend/src/utils/openFloatingTab.ts`
- Modify: `frontend/src/components/BottomBar/index.tsx`

**Interfaces:**
- Consumes: `openFloatingTab`（现有）。
- Produces: `openInfiniteFloating()`（BottomBar 调用）。

- [ ] **Step 1: 加浮动窗入口 `openFloatingTab.ts`**

在文件末尾（`openIpcMonitorFloating` 之后）加：

```ts
/** 打开无限下单浮动窗：有选中合约则直接定位到该合约 */
export function openInfiniteFloating(): boolean {
  const inst = useMarketStore.getState().selectedInstrument
  return openFloatingTab({
    type: 'infinite',
    title: inst ? `♾️ 无限下单-${inst}` : '♾️ 无限下单',
    props: inst ? { instrumentID: inst } : {},
  })
}
```

- [ ] **Step 2: BottomBar 加按钮**

`frontend/src/components/BottomBar/index.tsx`：import 列表加 `openInfiniteFloating`；在 `openKline` 回调后加 `const openInfinite = useCallback(() => { openInfiniteFloating() }, [])`；在「K线」按钮后加一个按钮：

```tsx
        <button type="button" className="bottom-bar__tool" aria-label="无限下单" title="无限下单" onClick={openInfinite}>
          <span className="bottom-bar__tool-icon">♾️</span>
          <span className="bottom-bar__tool-label">无限下单</span>
        </button>
```

- [ ] **Step 3: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/components/BottomBar/index.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/openFloatingTab.ts src/components/BottomBar/index.tsx
git commit -m "feat(infinite): add bottom-bar entry for infinite order"
```

---

## Self-Review 结论

- **Spec 覆盖**：定位/范围（零后端、隔离、不碰五档）→ Task 1/3/5；完整阶梯 → Task 2/4；四列 + 点价/撤单 + 确认 → Task 4；参数隔离 → Task 3/5；数据流（行情/报单/撤单/持仓）→ Task 4/5；错误处理边界 → Task 2（涨跌停无效/浮点）+ Task 4（空态/banner）+ Task 5（刷新节奏）；测试 → 各 Task 自带测试 + Task 5 Step 7 全量回归。
- **与设计文档差异（已在计划内收敛）**：热键 `↑↓←→` 档位/手数微调、乐观 pending 半透明徽标、右侧面板按当前合约过滤，列为 Phase 2，未纳入本计划任务；首版点价走「必弹确认」，无免确认开关。
- **类型一致性**：`InfiniteOrderIntent` 在 Task 3 定义，Task 4 消费字段名一致（direction/price/volume/combOffsetFlag/timeCondition）；`buildPriceAxis`/`buildDepthMaps` 签名 Task 2 定义，Task 4 消费一致。
