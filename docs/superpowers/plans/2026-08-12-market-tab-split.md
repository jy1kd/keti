# 行情表拆分期货/期权双标签 + 排序/多选筛选/搜索栏重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将行情主页拆为「期货」「期权」两个固定标签页，各表只展示对应合约；两表统一排序；新增交易所+品种多选筛选；期权页按标底分组并标出标底行；搜索栏重构为「功能靠左、搜索贴右」。

**Architecture:** 标签层把固定标签判断从 `type==='market'` 泛化为 `closable===false`（期货+期权双固定标签）。行情表从 `MarketTable` 抽成 spec 驱动的通用 `QuoteTable`，期货/期权各配一份 spec（列定义 + `buildRecord` + 可选 `rowStyle`），选中/右键/收藏/订阅/局部刷新机制复用。排序/分组/过滤抽为纯函数作为数据管道第一步。共享行情基础设施（`useMarketWs` + `useSubscriptionManager` + 合约加载）上移到 `App.tsx`，两面板共用单一 `visibleInstrumentIDs`。

**Tech Stack:** React 18 + TypeScript + Vite；@visactor/vtable 1.26；Zustand；vitest + @testing-library/react；jsdom。

**Spec:** `docs/superpowers/specs/2026-08-12-market-tab-split-design.md`

## Global Constraints

- 分支 `feature/md-refactor`（当前工作分支）。
- 前端 `frontend/src`；后端 `server/` 无改动（分组数据已随 `/api/market/instruments` 返回 `underlyingInstrID`/`optionsType`/`strikePrice`）。
- 期货 = `productClass === '1'`；期权 = `productClass === '2' || productClass === '6'`。
- 排序是数据管道第一步：排序/分组 → 全部/自选 → 筛选(交易所/品种) → 仅交易中 → 搜索 → 进表。过滤只剔除行、不重排。
- 期货排序：交易所固定顺序 SHFE→DCE→CZCE→CFFEX→INE→GFEX → `productID` 字典序 → 合约月份数字自然升序（`FG609<FG610<FG701`）。
- 期权分组排序：标底 `underlyingInstrID` 自然升序；组内 到期日 → 类型(C 前 P 后) → 行权价升序。
- 筛选：交易所/品种各自多选，空集=不限；命中 = `exchange ∈ exchanges(或空)` 且 `product ∈ products(或空)`；期货按 `exchangeID`/`productID`，期权按 `exchangeID`/标底品种。
- 两页筛选状态独立，持久化 localStorage，自选视图也应用筛选。
- 顶部菜单 label：`📊 全部行情`→`📊 期货`、`📉 T型期权`→`📉 期权`；`⭐ 自选行情`、`🪟 在新窗口打开` 保留。
- 全量前端测试（469）与 `npm run build` 必须通过；不引入新标签类型（复用 `market`/`options`）。
- 每次提交信息以中文描述 + 结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 测试命令：单文件 `cd frontend && npx vitest run <相对路径>`；全量 `cd frontend && npm test`。

---

### Task 1: 合约类型字段补全 + 排序/分组纯函数

**Files:**
- Modify: `frontend/src/services/types.ts`（`ContractInfo` 增补 3 个可选字段）
- Create: `frontend/src/modules/market/sort.ts`
- Test: `frontend/src/modules/market/sort.test.ts`

**Interfaces:**
- Consumes: `ContractInfo`（types.ts）。
- Produces: `naturalCompare(a,b)`, `sortFutures(contracts)`, `deriveUnderlyingProduct(underlyingInstrID)`, `groupOptionsByUnderlying(options, futures)`。Task 6/7 的期权 spec、筛选、分组都依赖这些。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/modules/market/sort.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { sortFutures, deriveUnderlyingProduct, groupOptionsByUnderlying, naturalCompare } from './sort'

const fut = (instrumentID: string, exchangeID: string, productID: string): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1' })

const opt = (instrumentID: string, exchangeID: string, productID: string, underlyingInstrID: string, optionsType: string, strikePrice: number, expireDate = '20260930'): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate, isTrading: 1, productClass: '2', underlyingInstrID, optionsType, strikePrice })

describe('naturalCompare', () => {
  it('数字段按数值比较而非字符串', () => {
    expect(['FG701', 'FG609', 'FG610'].sort(naturalCompare)).toEqual(['FG609', 'FG610', 'FG701'])
  })
})

describe('sortFutures', () => {
  it('按 交易所顺序 → 品种 → 月份数字 排序', () => {
    const input = [
      fut('FG610', 'CZCE', 'FG'),
      fut('cu2609', 'SHFE', 'cu'),
      fut('FG609', 'CZCE', 'FG'),
      fut('FG701', 'CZCE', 'FG'),
      fut('MA609', 'CZCE', 'MA'),
    ]
    const out = sortFutures(input).map((c) => c.instrumentID)
    // SHFE 在 CZCE 前
    expect(out[0]).toBe('cu2609')
    // CZCE 内：FG < MA；FG 内月份数字升序
    expect(out.slice(1)).toEqual(['FG609', 'FG610', 'FG701', 'MA609'])
  })

  it('不修改入参数组', () => {
    const input = [fut('FG610', 'CZCE', 'FG'), fut('FG609', 'CZCE', 'FG')]
    sortFutures(input)
    expect(input.map((c) => c.instrumentID)).toEqual(['FG610', 'FG609'])
  })
})

describe('deriveUnderlyingProduct', () => {
  it('去掉标的 ID 尾部数字得到品种', () => {
    expect(deriveUnderlyingProduct('FG609')).toBe('FG')
    expect(deriveUnderlyingProduct('p2609')).toBe('p')
  })
})

describe('groupOptionsByUnderlying', () => {
  it('按标底分组并组内排序：到期日 → 类型(C前P后) → 行权价升序', () => {
    const futures = [fut('FG609', 'CZCE', 'FG'), fut('FG610', 'CZCE', 'FG')]
    const options = [
      opt('FG609-C-1300', 'CZCE', 'FGC', 'FG609', '1', 1300),
      opt('FG609-C-1200', 'CZCE', 'FGC', 'FG609', '1', 1200),
      opt('FG609-P-1250', 'CZCE', 'FGP', 'FG609', '2', 1250),
      opt('FG610-C-1300', 'CZCE', 'FGC', 'FG610', '1', 1300),
    ]
    const groups = groupOptionsByUnderlying(options, futures)
    expect(groups.map((g) => g.underlyingID)).toEqual(['FG609', 'FG610'])
    expect(groups[0].underlying?.instrumentID).toBe('FG609')
    expect(groups[0].options.map((o) => o.instrumentID)).toEqual(['FG609-C-1200', 'FG609-C-1300', 'FG609-P-1250'])
    expect(groups[1].options.map((o) => o.instrumentID)).toEqual(['FG610-C-1300'])
  })

  it('标底不在期货列表时 underlying 为 undefined', () => {
    const groups = groupOptionsByUnderlying([opt('IO2609-C-4000', 'CFFEX', 'IO', 'IO2609', '1', 4000)], [])
    expect(groups[0].underlying).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/sort.test.ts`
Expected: FAIL（`Cannot find module './sort'`）

- [ ] **Step 3: 补全类型字段**

在 `frontend/src/services/types.ts` 的 `ContractInfo` 接口末尾（`productClass` 之后）加：

```ts
  /** 期权标的合约 ID（期权有值，如 "FG609"） */
  underlyingInstrID?: string
  /** 期权类型："1"=看涨(call), "2"=看跌(put) */
  optionsType?: string
  /** 行权价（期权有值） */
  strikePrice?: number
```

- [ ] **Step 4: 实现纯函数**

创建 `frontend/src/modules/market/sort.ts`：

```ts
import type { ContractInfo } from '@/services/types'

/** 交易所展示顺序 */
const EXCHANGE_ORDER = ['SHFE', 'DCE', 'CZCE', 'CFFEX', 'INE', 'GFEX']

function exchangeRank(exchangeID: string): number {
  const i = EXCHANGE_ORDER.indexOf(exchangeID)
  return i === -1 ? EXCHANGE_ORDER.length : i
}

/** 数字自然比较：FG609 < FG610 < FG701（按数字段数值比较，非字符串序） */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** 期货排序：交易所固定顺序 → 品种字典序 → 合约月份数字升序 */
export function sortFutures(contracts: ContractInfo[]): ContractInfo[] {
  return [...contracts].sort((a, b) => {
    const ex = exchangeRank(a.exchangeID) - exchangeRank(b.exchangeID)
    if (ex !== 0) return ex
    const prod = a.productID.localeCompare(b.productID)
    if (prod !== 0) return prod
    return naturalCompare(a.instrumentID, b.instrumentID)
  })
}

/** 从标底 ID 去尾数字得品种（FG609 → FG） */
export function deriveUnderlyingProduct(underlyingInstrID: string): string {
  return underlyingInstrID.replace(/\d+$/, '')
}

export interface OptionGroup {
  underlyingID: string
  /** 期货列表中匹配到的标的合约；找不到（如指数期权 IO/HO/MO）为 undefined */
  underlying: ContractInfo | undefined
  options: ContractInfo[]
}

/** 期权分组 + 组内排序：标底自然升序；组内 到期日 → 类型(C前P后) → 行权价升序 */
export function groupOptionsByUnderlying(
  options: ContractInfo[],
  futures: ContractInfo[],
): OptionGroup[] {
  const futMap = new Map(futures.map((f) => [f.instrumentID, f]))
  const groups = new Map<string, ContractInfo[]>()
  for (const o of options) {
    const u = o.underlyingInstrID ?? ''
    if (!groups.has(u)) groups.set(u, [])
    groups.get(u)!.push(o)
  }
  const result: OptionGroup[] = []
  for (const [u, opts] of groups) {
    opts.sort((a, b) => {
      const d = (a.expireDate || '').localeCompare(b.expireDate || '')
      if (d !== 0) return d
      const t = (a.optionsType || '').localeCompare(b.optionsType || '')
      if (t !== 0) return t
      return (a.strikePrice ?? 0) - (b.strikePrice ?? 0)
    })
    result.push({ underlyingID: u, underlying: futMap.get(u), options: opts })
  }
  result.sort((a, b) => naturalCompare(a.underlyingID, b.underlyingID))
  return result
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/sort.test.ts`
Expected: PASS（全部用例绿）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/services/types.ts frontend/src/modules/market/sort.ts frontend/src/modules/market/sort.test.ts
git commit -m "feat(market): 合约类型补全 underlyingInstrID/optionsType/strikePrice + 排序分组纯函数"
```

---

### Task 2: 标签栏双固定标签（期货 + 期权）

**Files:**
- Modify: `frontend/src/stores/tabs.ts:47-53`（`DEFAULT_TAB` → 双固定标签）
- Modify: `frontend/src/components/TabBar/index.tsx:87-94`（固定区判断泛化）
- Test: `frontend/src/stores/tabs.test.ts`、`frontend/src/components/TabBar/index.test.tsx`

**Interfaces:**
- Consumes: `Tab` 类型。
- Produces: 初始 `tabs` 含两个 `closable:false` 标签（`tab-market` 标题 `📊 期货`、`tab-options` 标题 `📈 期权`）；`TabBar` 用 `!t.closable` 判断固定标签。Task 6 的 `TabContent` 依据 `tab-options` 渲染期权面板。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/stores/tabs.test.ts` 追加：

```ts
import { useTabStore } from './tabs'

describe('双固定标签初始化', () => {
  beforeEach(() => useTabStore.setState({ tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }, { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false }], activeTabId: 'tab-market' }))

  it('初始含期货+期权两个不可关闭标签', () => {
    const { tabs } = useTabStore.getState()
    expect(tabs.map((t) => t.title)).toEqual(['📊 期货', '📈 期权'])
    expect(tabs.every((t) => !t.closable)).toBe(true)
  })

  it('closeTab 拒绝关闭固定标签', () => {
    useTabStore.getState().closeTab('tab-market')
    expect(useTabStore.getState().tabs.length).toBe(2)
  })
})
```

在 `frontend/src/components/TabBar/index.test.tsx` 追加（若已存在渲染断言，则更新）：渲染后断言固定区同时出现「📊 期货」「📈 期权」，且 `data-tab-id="tab-options"` 位于固定区（`tab-bar__market` 或等价 class）而非滚动区。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx`
Expected: FAIL（仍只有单标签，或期权标签进入滚动区）

- [ ] **Step 3: 改 tabs 存储**

把 `frontend/src/stores/tabs.ts:47-53` 的 `DEFAULT_TAB` 替换为：

```ts
const DEFAULT_TABS: Tab[] = [
  { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
  { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
]
```

并把 store 初始 `tabs: [DEFAULT_TAB]`、`activeTabId: DEFAULT_TAB.id` 改为 `tabs: DEFAULT_TABS`、`activeTabId: DEFAULT_TABS[0].id`；`closeTab` 内的 `DEFAULT_TAB.id` 兜底改 `DEFAULT_TABS[0].id`。

- [ ] **Step 4: 改 TabBar 固定区**

在 `frontend/src/components/TabBar/index.tsx`，把「行情标签固定左」的单一 `marketTab` 改为遍历所有不可关闭标签：

```ts
// 固定标签（期货/期权等 closable:false）：固定在左侧、可滚动区之外；不参与滚轮/溢出/隐藏
const fixedTabs = visibleTabs.filter((t) => !t.closable)

// 可滚动区标签：排除固定标签；pinned 靠左排序
const scrollTabs = useMemo(() => {
  const rest = visibleTabs.filter((t) => t.closable)
  return [...rest.filter((t) => t.pinned), ...rest.filter((t) => !t.pinned)]
}, [visibleTabs])
```

并将 JSX 中 `{marketTab && (…)}` 那段改为 `{fixedTabs.map((tab) => (…))}`，逐项渲染（`data-tab-id={tab.id}`、标题 `{tab.title}`、点击 `setActiveTab(tab.id)`、无右键、`onContextMenu` preventDefault）。`TabContent/index.tsx` 里的 `tabs.find((t) => t.type === 'market')` 兜底逻辑保持不变。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/stores/tabs.test.ts frontend/src/components/TabBar/index.tsx frontend/src/components/TabBar/index.test.tsx
git commit -m "feat(tabs): 标签栏双固定标签（期货+期权），固定区判断泛化为 closable=false"
```

---

### Task 3: 顶部菜单改名 + IPC market-view 语义

**Files:**
- Modify: `frontend/electron/menuTemplate.ts:46-47`（label）
- Modify: `frontend/electron/menuActions.ts`（`market` 窗口标题 `📊 期货`）
- Modify: `frontend/src/services/electron.ts:123-124`、`frontend/electron/preload.ts`（注释同步，可选）
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`、`frontend/electron/__tests__/menuManager.test.ts`

**Interfaces:**
- Consumes: `MenuAction['market-view']` 的 `view` 值 `'all' | 'options' | 'favorites'`（保持不变，仅 label 文案变）。
- Produces: 菜单 label `📊 期货` / `📉 期权`。Task 6 的 `MarketPanel` 处理器据此激活对应标签。

- [ ] **Step 1: 写失败测试**

更新 `frontend/electron/__tests__/menuTemplate.test.ts` 与 `menuManager.test.ts` 中「行情子菜单」断言：

```ts
it('行情子菜单镜像：期货/期权/自选/分隔符/在新窗口打开', () => {
  // 原来断言 '📊 全部行情' / '📉 T型期权'，改为：
  expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '🪟 在新窗口打开'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/../electron/__tests__/menuTemplate.test.ts`（若 vitest 不覆盖 electron，改用 `cd frontend && npx vitest run electron` 或直接断言更新后重跑）
Expected: FAIL（label 仍是旧文案）

- [ ] **Step 3: 改 label**

`frontend/electron/menuTemplate.ts:46-47` 改为：

```ts
{ id: 'market-all', label: '📊 期货', action: { type: 'market-view', view: 'all' } },
{ id: 'market-options', label: '📉 期权', action: { type: 'market-view', view: 'options' } },
```

`frontend/electron/menuActions.ts:39` 的 `openTabWindow('market', 'tab-market', '📊 行情')` 改 `'📊 期货'`。

- [ ] **Step 4: 运行测试确认通过**

Run: 同 Step 2
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/menuActions.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuManager.test.ts
git commit -m "feat(menu): 顶部行情菜单改名（全部行情→期货、T型期权→期权）"
```

---

### Task 4: 共享行情基础设施上移到 App

**Files:**
- Modify: `frontend/src/App.tsx`（挂载 `useMarketWs` + `useSubscriptionManager` + 合约/收藏加载）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（移除 `useMarketWs`、`useSubscriptionManager`、加载 effect、`API_BASE` import）
- Test: `frontend/src/App.test.tsx`、`frontend/src/modules/market/MarketPanel.test.tsx`

**Interfaces:**
- Consumes: `useMarketWs`, `useSubscriptionManager`, `useContractsStore.loadAllInstruments/loadFavoriteContracts`。
- Produces: 行情 WS 与订阅管理器为全局单例，挂在 `App`；两面板（期货/期权）共享 `visibleInstrumentIDs`。Task 5/6 的面板不再自行挂这些 hook。

> 目的：期货/期权两个面板都依赖同一份订阅生命周期与 WS 单例。`useSubscriptionManager` 内部 `subscribedRef` 是组件私有，若在两个面板各挂一份会双份 diff 冲突，故必须单例。`useMarketWs` 虽有 `globalWs` 幂等，但订阅管理器不能双份，统一上移。

- [ ] **Step 1: 写失败测试**

`frontend/src/App.test.tsx` 追加（mock `useMarketWs`/`useSubscriptionManager` 后断言被调用一次）：

```tsx
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'

vi.mock('@/hooks/useMarketWs', () => ({ useMarketWs: vi.fn() }))
vi.mock('@/hooks/useSubscriptionManager', () => ({ useSubscriptionManager: vi.fn() }))

it('App 挂载共享行情 WS 与订阅管理器各一次', () => {
  render(<App />)
  expect(useMarketWs).toHaveBeenCalledTimes(1)
  expect(useSubscriptionManager).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL（`useMarketWs`/`useSubscriptionManager` 未被 App 调用）

- [ ] **Step 3: 上移基础设施**

在 `frontend/src/App.tsx` 顶部 import 并在组件内（`useSystemWs` 附近）加：

```ts
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'

// 在 App() 内：
useMarketWs(API_BASE.replace('http', 'ws'))
useSubscriptionManager()

// 启动时加载全量合约 + 收藏合约（原先在 MarketPanel，现上移共享）
useEffect(() => {
  useContractsStore.getState().loadAllInstruments()
  useContractsStore.getState().loadFavoriteContracts()
}, [])
```

从 `frontend/src/modules/market/MarketPanel.tsx` 删除：`useMarketWs(...)`（:74）、`useSubscriptionManager()`（:36）、启动加载 effect（:77-83）、`loadedRef`（:33 及其引用）、`useContractsStore.loadAllInstruments/loadFavoriteContracts` 解构、`import { API_BASE }`（:18）。保留 `useMarketStore`、`useContractsStore` 的 `contracts/favorites/addToFavorites/removeFromFavorites`（收藏按钮与表格仍用）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/App.test.tsx src/modules/market/MarketPanel.test.tsx`
Expected: PASS（MarketPanel 测试更新掉对加载 effect 的断言，其余绿）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx
git commit -m "refactor(market): 共享行情 WS/订阅管理器/合约加载上移到 App，支持双面板单例"
```

---

### Task 5: MarketTable 泛化为 spec 驱动的 QuoteTable（期货 spec）

**Files:**
- Create: `frontend/src/modules/market/quoteTable.ts`（spec 类型 + 通用辅助导出）
- Create: `frontend/src/modules/market/futuresSpec.ts`（期货列 + buildRecord）
- Rename/Move: `frontend/src/modules/market/MarketTable.tsx` → `frontend/src/modules/market/QuoteTable.tsx`（通用机制）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（改用 `<QuoteTable spec={futuresSpec} …/>`）
- Test: `frontend/src/modules/market/MarketTable.test.tsx` → 更新为 `QuoteTable.test.tsx`（或新增 futuresSpec 单测）

**Interfaces:**
- Consumes: `MarketSnapshot`、`ContractInfo`、`getProductName`、`getContractStatus`、`isValidPrice`。
- Produces: `QuoteTableSpec`、`QuoteRecord`、`ColumnDef`、`futuresSpec`；`QuoteTable` 组件 props 见下。Task 6 的期权 spec 复用同一定义。

定义（`quoteTable.ts`）：

```ts
import type { MarketSnapshot, ContractInfo } from '@/services/types'

export type QuoteRowKind = 'normal' | 'underlying' | 'option'

export interface QuoteRecord {
  instrumentID: string
  kind: QuoteRowKind
  [field: string]: unknown
}

export interface ColumnDef {
  field: string
  title: string
  width: number
  style?: (args: any) => any
}

export interface QuoteTableSpec {
  columns: ColumnDef[]
  buildRecord: (contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean) => QuoteRecord
  /** 可选：按记录返回行级样式覆盖（期权表标底行深色底用） */
  rowStyle?: (record: QuoteRecord) => Record<string, unknown> | undefined
}

export const PLACEHOLDER = '--'
export const CTP_INVALID_PRICE = 1.7976931348623157e+308
export const isValidPrice = (p: number) => p > 0 && p < CTP_INVALID_PRICE
export const UP_COLOR = '#ef4444'
export const DOWN_COLOR = '#22c55e'
export const FLAT_COLOR = '#e6edf3'

export function priceColor(record: any): string { /* 原样搬移 */ }
export function coloredStyle(args: any) { /* 原样搬移 */ }
export function statusStyle(args: any) { /* 原样搬移 */ }
export function shouldRenderAnchor(selectedInstrument, selectedContracts): boolean { /* 原样搬移 */ }
```

`QuoteTable` props（从 `MarketTableProps` 演化，新增 `spec`、`isActive`）：

```ts
interface QuoteTableProps {
  spec: QuoteTableSpec
  contracts: ContractInfo[]
  snapshots: Map<string, MarketSnapshot>
  selectedInstrument?: string | null
  isActive?: boolean          // 当前标签是否激活（激活时重报可见区）
  onRowClick?: (instrumentID: string, price: number) => void
  onRowDoubleClick?: (instrumentID: string, price: number) => void
  onContextMenu?: (instrumentID: string, price: number, event: MouseEvent) => void
  onMultiSelectContextMenu?: (instrumentIDs: string[], event: MouseEvent) => void
  onVisibleRangeChange?: (visibleInstrumentIDs: string[]) => void
  favoritedIds?: Set<string>
  onFavoriteChange?: (instrumentID: string, isFavorited: boolean) => void
  selectedContracts?: Set<string>
  onSelectionChange?: (selectedIDs: Set<string>) => void
}
```

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/modules/market/futuresSpec.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { futuresSpec } from './futuresSpec'

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }

describe('futuresSpec', () => {
  it('列定义含合约/品种/交易所/最新价等', () => {
    expect(futuresSpec.columns.map((c) => c.field)).toEqual(
      expect.arrayContaining(['instrumentID', 'productName', 'exchangeID', 'lastPrice', 'change']),
    )
  })

  it('无快照时 buildRecord 产出 kind=normal 与占位行情', () => {
    const r = futuresSpec.buildRecord(fut, undefined, false)
    expect(r.kind).toBe('normal')
    expect(r.instrumentID).toBe('FG609')
    expect(r.lastPrice).toBe('--')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/futuresSpec.test.ts`
Expected: FAIL（`Cannot find module './futuresSpec'`）

- [ ] **Step 3: 抽出 spec 类型与通用辅助**

创建 `frontend/src/modules/market/quoteTable.ts`（内容见上方 Interfaces）。其中 `priceColor`/`coloredStyle`/`statusStyle`/`shouldRenderAnchor` 原样从 `MarketTable.tsx:31-93` 搬入并 `export`。

- [ ] **Step 4: 抽期货 spec**

创建 `frontend/src/modules/market/futuresSpec.ts`，把 `MarketTable.tsx:64-80` 的 `columns`、`:95-140` 的 `buildRecord`（原样，`buildRecord` 内加 `kind: 'normal'`）搬入，导入 `quoteTable.ts` 的常量/辅助：

```ts
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'
import { getContractStatus, type ContractStatus } from '@/utils/contractStatus'
import { PLACEHOLDER, isValidPrice, coloredStyle, statusStyle, type QuoteTableSpec, type QuoteRecord } from './quoteTable'

const columns = [ /* 原 MarketTable columns 原样 */ ]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean): QuoteRecord {
  // 原 MarketTable buildRecord 原样，返回对象加 kind: 'normal'
}

export const futuresSpec: QuoteTableSpec = { columns, buildRecord }
```

- [ ] **Step 5: MarketTable → QuoteTable（通用机制）**

把 `MarketTable.tsx` 复制为 `QuoteTable.tsx`，做如下参数化：
- 删除文件内 `columns`、`buildRecord`、`priceColor`/`coloredStyle`/`statusStyle`/`shouldRenderAnchor`、`PLACEHOLDER` 等（已移入 spec/quoteTable.ts，从 `./quoteTable` 导入 `shouldRenderAnchor`）。
- 组件签名与 props 换成 `QuoteTableProps`（加 `spec`、`isActive`）。
- 两处 `contracts.map((c) => buildRecord(…))`（:201、:507、:537）改为 `contracts.map((c) => spec.buildRecord(c, snapshots.get(c.instrumentID), favoritedIds?.has(c.instrumentID) ?? false))`。
- `columns` 引用改 `spec.columns`。
- `bodyStyle.bgColor` 回调（:240-247）改为先查 `spec.rowStyle?.(record)`，无则按选中态蓝高亮，逻辑顺序：`spec.rowStyle(record)?.bgColor ?? (选中 ? 蓝 : 默认)`。
- 新增激活重报 effect：`useEffect(() => { if (isActive) notifyVisibleRange() }, [isActive])`。

删除旧 `MarketTable.tsx`。更新 `MarketPanel.tsx` 导入：`import { QuoteTable } from './QuoteTable'`、`import { futuresSpec } from './futuresSpec'`，渲染 `<QuoteTable spec={futuresSpec} … />`（其余 props 不变）。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/futuresSpec.test.ts src/modules/market/MarketTable.test.tsx src/modules/market/MarketPanel.test.tsx`
Expected: PASS（`MarketTable.test.tsx` 改为引用 `QuoteTable` 后绿；futuresSpec 单测绿）

- [ ] **Step 7: 提交**

```bash
git add frontend/src/modules/market/quoteTable.ts frontend/src/modules/market/futuresSpec.ts frontend/src/modules/market/QuoteTable.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/futuresSpec.test.ts
git rm frontend/src/modules/market/MarketTable.tsx
git commit -m "refactor(market): MarketTable 泛化为 spec 驱动 QuoteTable，抽出期货 spec"
```

---

### Task 6: 期权面板（分组列表 + T型报价二级视图）

**Files:**
- Create: `frontend/src/modules/market/optionsSpec.ts`（期权列 + buildRecord + rowStyle）
- Create: `frontend/src/modules/options/OptionsPanel.tsx`（重写：二级切换 shell）
- Create: `frontend/src/modules/options/TQuoteView.tsx`（现 OptionPanel 的 T型报价内容原样迁入）
- Modify: `frontend/src/components/TabContent/index.tsx:51-52`（`case 'options'` 渲染 `OptionsPanel`）
- Modify: `frontend/src/modules/options/OptionPanel.tsx`（删除，内容迁到 TQuoteView）
- Test: `frontend/src/modules/market/optionsSpec.test.ts`、`frontend/src/modules/options/OptionsPanel.test.tsx`

**Interfaces:**
- Consumes: `QuoteTableSpec`/`QuoteRecord`（Task 5）、`groupOptionsByUnderlying`/`deriveUnderlyingProduct`（Task 1）、`useTabStore`（判断激活）、`useMarketStore`/`useContractsStore`。
- Produces: `optionsSpec`；`OptionsPanel`（含 `[列表|T型报价]` 切换）；`TQuoteView`（原 OptionPanel 内容）。Task 8 在其工具行叠加搜索栏与筛选。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/modules/market/optionsSpec.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { optionsSpec } from './optionsSpec'

const fut: ContractInfo = { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' }
const opt: ContractInfo = { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 }

describe('optionsSpec', () => {
  it('列定义含 类型/行权价', () => {
    expect(optionsSpec.columns.map((c) => c.field)).toEqual(
      expect.arrayContaining(['contractType', 'strikePrice']),
    )
  })

  it('标底行 kind=underlying 且类型列为「标」', () => {
    const r = optionsSpec.buildRecord(fut, undefined, false)
    expect(r.kind).toBe('underlying')
    expect(r.contractType).toBe('标')
  })

  it('期权行 kind=option 且类型列 C/P、行权价填充', () => {
    const r = optionsSpec.buildRecord(opt, undefined, false)
    expect(r.kind).toBe('option')
    expect(r.contractType).toBe('C')
    expect(r.strikePrice).toBe(1300)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts`
Expected: FAIL（`Cannot find module './optionsSpec'`）

- [ ] **Step 3: 抽期权 spec**

创建 `frontend/src/modules/market/optionsSpec.ts`：

```ts
import type { MarketSnapshot, ContractInfo } from '@/services/types'
import { getProductName } from '@/utils/productNames'
import { getContractStatus, type ContractStatus } from '@/utils/contractStatus'
import { PLACEHOLDER, isValidPrice, coloredStyle, statusStyle, type QuoteTableSpec, type QuoteRecord } from './quoteTable'
import { deriveUnderlyingProduct } from './sort'

const columns = [
  { field: 'instrumentID', title: '合约', width: 150 },
  { field: 'contractType', title: '类型', width: 50, style: statusStyle },
  { field: 'strikePrice', title: '行权价', width: 90 },
  { field: 'expireDate', title: '到期日', width: 115 },
  { field: 'exchangeID', title: '交易所', width: 85 },
  { field: 'status', title: '状态', width: 85, style: statusStyle },
  { field: 'lastPrice', title: '最新价', width: 90, style: coloredStyle },
  { field: 'change', title: '涨跌', width: 115, style: coloredStyle },
  { field: 'changePercent', title: '涨跌%', width: 115, style: coloredStyle },
  { field: 'bidPrice1', title: '买一', width: 120, style: coloredStyle },
  { field: 'askPrice1', title: '卖一', width: 120, style: coloredStyle },
  { field: 'volume', title: '成交量', width: 90 },
  { field: 'openInterest', title: '持仓量', width: 90 },
  { field: 'favorite', title: '⭐', width: 60 },
]

function buildRecord(contract: ContractInfo, snap: MarketSnapshot | undefined, isFavorited: boolean): QuoteRecord {
  const kind = contract.productClass === '1' ? 'underlying' : 'option'
  const status = getContractStatus(contract)
  const contractType = kind === 'underlying' ? '标' : (contract.optionsType === '1' ? 'C' : 'P')
  const base = {
    instrumentID: contract.instrumentID,
    kind,
    contractType,
    strikePrice: kind === 'option' ? contract.strikePrice : PLACEHOLDER,
    expireDate: contract.expireDate || PLACEHOLDER,
    exchangeID: contract.exchangeID || PLACEHOLDER,
    status,
    favorite: isFavorited ? '⭐' : '☆',
  }
  if (!snap) {
    return { ...base, lastPrice: PLACEHOLDER, change: PLACEHOLDER, changePercent: PLACEHOLDER, bidPrice1: PLACEHOLDER, askPrice1: PLACEHOLDER, volume: PLACEHOLDER, openInterest: PLACEHOLDER }
  }
  const preSettlement = (snap.preSettlementPrice && snap.preSettlementPrice > 0) ? snap.preSettlementPrice : (snap.preClosePrice || snap.lastPrice)
  const change = snap.lastPrice - preSettlement
  const changePercent = preSettlement ? (change / preSettlement) * 100 : 0
  return {
    ...base,
    lastPrice: isValidPrice(snap.lastPrice) ? snap.lastPrice : PLACEHOLDER,
    change: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? change : PLACEHOLDER,
    changePercent: isValidPrice(snap.lastPrice) && isValidPrice(preSettlement) ? changePercent : PLACEHOLDER,
    bidPrice1: isValidPrice(snap.bidPrice1) ? snap.bidPrice1 : PLACEHOLDER,
    askPrice1: isValidPrice(snap.askPrice1) ? snap.askPrice1 : PLACEHOLDER,
    volume: snap.volume,
    openInterest: snap.openInterest,
  }
}

/** 标底行：深色底 + 上分隔线 */
function rowStyle(record: QuoteRecord): Record<string, unknown> | undefined {
  if (record.kind === 'underlying') return { bgColor: '#1a2230' }
  return undefined
}

export const optionsSpec: QuoteTableSpec = { columns, buildRecord, rowStyle }
```

- [ ] **Step 4: 迁 T型报价为二级视图**

新建 `frontend/src/modules/options/TQuoteView.tsx`，内容 = 现 `OptionPanel.tsx` 整体（原样搬移，仅组件名改 `TQuoteView`）。删除 `OptionPanel.tsx`。

- [ ] **Step 5: 新建 OptionsPanel shell**

创建 `frontend/src/modules/options/OptionsPanel.tsx`，含 `[列表|T型报价]` 二级切换 + 列表视图渲染分组表：

```tsx
import { useMemo, useState } from 'react'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { groupOptionsByUnderlying } from '@/modules/market/sort'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { useTabStore } from '@/stores/tabs'
import { usePointOrder } from '@/hooks/usePointOrder'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { TQuoteView } from './TQuoteView'

export function OptionsPanel() {
  const [view, setView] = useState<'list' | 'tquote'>('list')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const isActive = useTabStore((s) => s.tabs.some((t) => t.type === 'options' && t.id === s.activeTabId))

  // 期货全量 → 期权全量 → 分组展平为有序 ContractInfo[]（标底行在前、期权行随后）
  const rows = useMemo(() => {
    const futures = contracts.filter((c) => c.productClass === '1')
    const options = contracts.filter((c) => c.productClass === '2' || c.productClass === '6')
    const groups = groupOptionsByUnderlying(options, futures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [contracts])

  // 行级收藏/选中/右键复用 futures 页同一套 hook（usePointOrder + useContractContextMenu），
  // 此处为示意，具体 onRowClick/onContextMenu 从这两个 hook 取得后透传。

  return (
    <section className="options-panel">
      <div className="market-toolbar">
        <div className="market-toolbar__mode">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>列表</button>
          <button className={view === 'tquote' ? 'active' : ''} onClick={() => setView('tquote')}>T型报价</button>
        </div>
        {/* Task 7/8 在此叠加 全部/自选、筛选、仅交易中、收藏、搜索框 */}
      </div>
      {view === 'tquote'
        ? <TQuoteView />
        : <QuoteTable spec={optionsSpec} contracts={rows} snapshots={snapshots} isActive={isActive} /* …交互 props */ />
      }
    </section>
  )
}
```

（`usePointOrder`/`useContractContextMenu` 的接入与 futures 页一致，Task 8 统一补齐交互 props。）

- [ ] **Step 6: TabContent 渲染期权面板**

`frontend/src/components/TabContent/index.tsx:51-52` 的 `case 'options'` 改为 `return <OptionsPanel />`（import 该组件）。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/optionsSpec.test.ts src/modules/options/OptionsPanel.test.tsx src/components/TabContent/index.test.tsx`
Expected: PASS（OptionsPanel.test 覆盖 `[列表|T型报价]` 切换、列表默认；TabContent 期权不再占位符）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/modules/market/optionsSpec.ts frontend/src/modules/market/optionsSpec.test.ts frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/TQuoteView.tsx frontend/src/components/TabContent/index.tsx
git rm frontend/src/modules/options/OptionPanel.tsx
git commit -m "feat(options): 期权面板=按标底分组列表(默认)+T型报价二级视图"
```

---

### Task 7: 多选筛选（交易所 + 品种）

**Files:**
- Create: `frontend/src/modules/market/filter.ts`（纯过滤函数 + 类型）
- Create: `frontend/src/stores/marketFilter.ts`（两页独立筛选状态 + localStorage 持久化）
- Create: `frontend/src/components/ContractFilter/index.tsx`（多选面板组件）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（期货页接入筛选，品种列表=期货 `productID`）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（期权页接入筛选，品种列表=标底品种）
- Test: `frontend/src/modules/market/filter.test.ts`、`frontend/src/stores/marketFilter.test.ts`、`frontend/src/components/ContractFilter/index.test.tsx`

**Interfaces:**
- Consumes: `ContractInfo`、`deriveUnderlyingProduct`（Task 1）。
- Produces: `filterByExchangeAndProduct(contracts, exchanges, products, getProduct)`；`useMarketFilterStore`（`{ futures, options }` 两页筛选态 + `setExchanges/setProducts/reset`）；`ContractFilter` 组件。Task 8 的搜索栏与这些叠加。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/modules/market/filter.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import type { ContractInfo } from '@/services/types'
import { filterByExchangeAndProduct } from './filter'
import { deriveUnderlyingProduct } from './sort'

const c = (instrumentID: string, exchangeID: string, productID: string, underlyingInstrID?: string): ContractInfo =>
  ({ instrumentID, instrumentName: instrumentID, exchangeID, productID, volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1', underlyingInstrID })

describe('filterByExchangeAndProduct', () => {
  const list = [c('FG609', 'CZCE', 'FG'), c('cu2609', 'SHFE', 'cu'), c('MA609', 'CZCE', 'MA')]

  it('空集 = 不限', () => {
    expect(filterByExchangeAndProduct(list, [], [], (x) => x.productID).length).toBe(3)
  })

  it('多交易所命中', () => {
    const r = filterByExchangeAndProduct(list, ['SHFE'], [], (x) => x.productID)
    expect(r.map((x) => x.instrumentID)).toEqual(['cu2609'])
  })

  it('交易所与品种叠加（AND）', () => {
    const r = filterByExchangeAndProduct(list, ['CZCE'], ['FG'], (x) => x.productID)
    expect(r.map((x) => x.instrumentID)).toEqual(['FG609'])
  })

  it('期权按标底品种过滤', () => {
    const opts = [c('FG609-C-1300', 'CZCE', 'FGC', 'FG609'), c('MA609-C-1000', 'CZCE', 'MAC', 'MA609')]
    const r = filterByExchangeAndProduct(opts, [], ['FG'], (x) => deriveUnderlyingProduct(x.underlyingInstrID ?? ''))
    expect(r.map((x) => x.instrumentID)).toEqual(['FG609-C-1300'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts`
Expected: FAIL（`Cannot find module './filter'`）

- [ ] **Step 3: 实现纯过滤函数**

创建 `frontend/src/modules/market/filter.ts`：

```ts
import type { ContractInfo } from '@/services/types'

export interface MarketFilter {
  exchanges: string[]
  products: string[]
}

export const EMPTY_FILTER: MarketFilter = { exchanges: [], products: [] }

/** 交易所/品种多选过滤；空集=不限；命中 = exchange ∈ exchanges(或空) 且 product ∈ products(或空) */
export function filterByExchangeAndProduct(
  contracts: ContractInfo[],
  exchanges: string[],
  products: string[],
  getProduct: (c: ContractInfo) => string,
): ContractInfo[] {
  const exSet = exchanges.length ? new Set(exchanges) : null
  const prodSet = products.length ? new Set(products) : null
  return contracts.filter((c) => {
    if (exSet && !exSet.has(c.exchangeID)) return false
    if (prodSet && !prodSet.has(getProduct(c))) return false
    return true
  })
}
```

- [ ] **Step 4: 筛选状态 store（两页独立 + 持久化）**

创建 `frontend/src/stores/marketFilter.ts`：

```ts
import { create } from 'zustand'
import type { MarketFilter } from '@/modules/market/filter'

const STORAGE_KEY = 'simnow-market-filter'

type Page = 'futures' | 'options'

interface MarketFilterStore {
  futures: MarketFilter
  options: MarketFilter
  setExchanges: (page: Page, exchanges: string[]) => void
  setProducts: (page: Page, products: string[]) => void
  reset: (page: Page) => void
  load: () => void
}

export const useMarketFilterStore = create<MarketFilterStore>((set, get) => ({
  futures: { exchanges: [], products: [] },
  options: { exchanges: [], products: [] },
  setExchanges: (page, exchanges) => set((s) => ({ [page]: { ...s[page], exchanges } } as any)),
  setProducts: (page, products) => set((s) => ({ [page]: { ...s[page], products } } as any)),
  reset: (page) => set((s) => ({ [page]: { exchanges: [], products: [] } } as any)),
  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      set({
        futures: data.futures ?? { exchanges: [], products: [] },
        options: data.options ?? { exchanges: [], products: [] },
      })
    } catch { /* 忽略损坏数据 */ }
  },
}))

// 每次变更持久化（订阅式）
useMarketFilterStore.subscribe((state) => {
  const { futures, options } = state
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ futures, options }))
})
```

在 `App.tsx` 挂载时 `useMarketFilterStore.getState().load()`（并入 Task 4 的启动 effect）。

- [ ] **Step 5: ContractFilter 组件**

创建 `frontend/src/components/ContractFilter/index.tsx`（含 `index.css`）：props `{ exchanges: string[]; products: string[]; productNames: Record<string,string>; value: MarketFilter; onChange: (v: MarketFilter) => void }`。渲染「筛选 🔽」按钮 + 点击展开面板：交易所 checkbox 列表、品种 checkbox 列表（`getProductName` 中文名 + 内嵌关键词过滤输入）、「清空」按钮；点击外部/Esc 关闭；按钮显示已选数徽标。

- [ ] **Step 6: 接入两页**

期货页 `MarketPanel.tsx`：`const filter = useMarketFilterStore((s) => s.futures)`；品种列表 = `sortFutures(contracts).map(c => c.productID)` 去重；`displayContracts` 管道里在「全部/自选」之后加 `filterByExchangeAndProduct(..., filter.exchanges, filter.products, c => c.productID)`。工具行加 `<ContractFilter exchanges={…} products={…} value={filter} onChange={…} />`。

期权页 `OptionsPanel.tsx`：`const filter = useMarketFilterStore((s) => s.options)`；品种列表 = 期权合约 `deriveUnderlyingProduct(underlyingInstrID)` 去重；分组前先过滤期权（按 `c.exchangeID` + `deriveUnderlyingProduct`），再 `groupOptionsByUnderlying`；标底行随组保留。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts src/stores/marketFilter.test.ts src/components/ContractFilter/index.test.tsx`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add frontend/src/modules/market/filter.ts frontend/src/modules/market/filter.test.ts frontend/src/stores/marketFilter.ts frontend/src/components/ContractFilter/ frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/options/OptionsPanel.tsx
git commit -m "feat(market): 交易所+品种多选筛选（两页独立+持久化）"
```

---

### Task 8: 搜索栏重构（功能靠左、搜索贴右）+ 期权页搜索定位

**Files:**
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（工具行重排：左功能集群 + 右搜索）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（同布局 + 搜索定位到标底分组）
- Modify: `frontend/src/modules/market/styles.css`（`market-toolbar__search` 加 `margin-left:auto`）
- Test: `frontend/src/modules/market/MarketPanel.test.tsx`、`frontend/src/modules/options/OptionsPanel.test.tsx`

**Interfaces:**
- Consumes: `ContractSearch`、`InstrumentSearchModal`、`useMarketFilterStore`、`groupOptionsByUnderlying`。
- Produces: 两页工具行布局「[全部|自选] [筛选] [仅交易中] [收藏] …(弹性)… [搜索框][🔍]」；期权页搜索选中期权合约时定位到其标底分组。

- [ ] **Step 1: 写失败测试**

`MarketPanel.test.tsx` 追加布局断言（用 `data-testid` 或顺序断言）：搜索框（`placeholder="搜索合约..."`）在 DOM 中位于收藏按钮之后；`筛选` 按钮位于「全部/自选」之后、「仅交易中」之前。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/MarketPanel.test.tsx`
Expected: FAIL（当前搜索在中间）

- [ ] **Step 3: 重排工具行 + CSS**

`MarketPanel.tsx` 工具行 JSX 顺序改为：`market-toolbar__tabs`（全部/自选）→ `ContractFilter` → `market-toolbar__actions`（仅交易中 + 收藏）→ `market-toolbar__search`（ContractSearch + 🔍 + 计数）。`styles.css` 的 `.market-toolbar__search` 加 `margin-left: auto;`（吃掉中间空间，把搜索推右）。

- [ ] **Step 4: 期权页搜索定位**

`OptionsPanel.tsx` 列表视图：搜索框作用域=当前期权列表（标底 `instrumentID` + 期权 `instrumentID` + `getProductName` 中文名）；选中时若命中期权合约，找到其 `underlyingInstrID` 所在分组首行 `instrumentID`，`setSelectedInstrument(underlyingID)` 并 `setSelectedContracts(new Set([underlyingID]))`（复用 futures 页 `handleSelectContract` 语义，锚点跳转）。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: 全量回归 + 提交**

Run: `cd frontend && npm test && npm run build`
Expected: 全绿 + 构建通过

```bash
git add frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionsPanel.test.tsx frontend/src/modules/market/styles.css
git commit -m "feat(market): 搜索栏重构（功能靠左、搜索贴右）+ 期权页搜索定位标底分组"
```

---

## Self-Review 记录

- **Spec 覆盖**：标签页改造→Task 2/6；表格泛化→Task 5/6；多选筛选→Task 7；排序→Task 1；搜索栏重构→Task 8；菜单改名→Task 3；订阅架构→Task 4。全部覆盖。
- **类型一致性**：`QuoteTableSpec`/`QuoteRecord`/`ColumnDef` 在 Task 5 定义、Task 6 复用；`sortFutures`/`groupOptionsByUnderlying`/`deriveUnderlyingProduct` 在 Task 1 定义、Task 6/7 复用；`MarketFilter`/`filterByExchangeAndProduct` 在 Task 7 定义、Task 8 复用。字段名一致。
- **范围**：单一实现计划，8 个任务各自可独立提交且测试绿。
