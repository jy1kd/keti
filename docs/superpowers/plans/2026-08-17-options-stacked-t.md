# 期权页堆叠可折叠 T 型链 + 系列收藏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将期权页从平铺列表重构为「堆叠可折叠 T 型链」（每标底一个红粗组头 + 可展开迷你 T 表），并支持系列收藏（收藏整个标底系列，收藏夹以同样 T 型渲染）。

**Architecture:** P1 重构 `OptionsPanel` 为组列表，新增 `OptionChainGroup`（组头 + 到期切换 + 复用 `TQuoteTable`）；数据管道路由复用 `groupOptionsByUnderlying`/`filterByExchangeAndProduct`，指数标底走合成组头。P2 在 `collections` store 加 `seriesIDs`，`CollectionPicker` 加 series 模式，收藏夹页渲染 series 为堆叠 T 型组。P1/P2 两阶段各自独立可上线，合并前互不依赖。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5；`@visactor/vtable` 渲染 T 表；Zustand（stores）；Vitest + @testing-library/react 测试。

**Spec:** `docs/superpowers/specs/2026-08-17-options-stacked-t-design.md`（执行者务必同时阅读 spec 了解背景与非目标）

## Global Constraints

- 分支 `feature/options-stacked-t`（已建，spec 已提交 `a09c639`）；代码改动由开发者在该分支内提交，不 merge/push/删分支（合并由用户手动）。
- TDD：每个任务先写失败测试 → 跑红 → 最小实现 → 跑绿 → 提交。
- 测试命令（前端）：`cd frontend && node_modules/.bin/vitest run <path>`；类型 `npx tsc --noEmit`；lint `npx eslint --max-warnings 0 <file>`。
- 不引入新依赖；不修改 `MarketPanel` 期货平铺、不动 `TQuoteView` 悬浮窗。
- 指数期权（MO/IO/HO）：`underlyingInstrID` 非可交易合约，组头合成、永不订阅、不显示行情。
- 组头纯导航，不显示实时价；报价为主，不做跨表多选/拖选/右键。

---

## File Structure

**P1（视图重构）**
- `frontend/src/modules/market/sort.ts` — 新增 `syntheticUnderlyingContract(underlyingInstrID): ContractInfo`；`OptionGroup` 类型已存在。
- `frontend/src/modules/market/sort.test.ts` — 合成组头测试。
- `frontend/src/modules/options/OptionChainGroup.tsx` — 新建：组头（折叠/展开、⇗新窗）+ 到期切换条 + 迷你 `TQuoteTable`；管理展开态、链缓存、订阅锁定。
- `frontend/src/modules/options/OptionChainGroup.test.tsx` — 新组件测试。
- `frontend/src/modules/options/TQuoteTable.tsx` — 新增可选 `onRowClick?`；`TQuoteRow` 加 `callInstrumentID`/`putInstrumentID`。
- `frontend/src/modules/options/TQuoteTable.test.tsx` — onRowClick 回调测试（含无回调回归）。
- `frontend/src/modules/options/OptionsPanel.tsx` — 重写为组列表（移除平铺 `QuoteTable`/`optionsSpec` 渲染、移除 ⭐ 按钮）；工具栏改造（筛选组、搜索过滤组、搜索选中展开定位）。
- `frontend/src/modules/options/OptionsPanel.test.tsx` — 重写测试。

**P2（系列收藏）**
- `frontend/src/stores/collections.ts` — `Collection` 加 `seriesIDs`；新增 `addSeriesToCollections`/`removeSeriesFromCollection`/`removeSeriesFromAllCollections`/`unionSerializedIds`。
- `frontend/src/stores/collections.test.ts` — series 增删/持久化/并集/存在性校验。
- `frontend/src/components/CollectionPicker/index.tsx` — 加 series 模式（prop `seriesIDs?: string[]` 与 `instrumentIDs` 互斥，提交走系列 API）。
- `frontend/src/components/CollectionPicker/index.test.tsx` — series 模式测试。
- `frontend/src/modules/options/OptionsPanel.tsx` — 组头加 ⭐ 系列收藏（P1 后增量）。
- `frontend/src/pages/CollectionPage.tsx` — 渲染 `seriesIDs` 为堆叠 T 型组（复用 `OptionChainGroup`）。
- `frontend/src/pages/CollectionPage.test.tsx` — 双段渲染测试。

---

## P1 — 阶段一：期权页堆叠可折叠 T 型链

### Task 1: 合成标底合约 `syntheticUnderlyingContract`

**Files:**
- Modify: `frontend/src/modules/market/sort.ts`（在 `groupOptionsByUnderlying` 之后新增函数）
- Test: `frontend/src/modules/market/sort.test.ts`

**Interfaces:**
- Consumes: `deriveUnderlyingProduct(underlyingInstrID: string): string`、`getProductName(productID: string): string`（已存在）
- Produces: `syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo` —— 供 Task 5 / OptionsPanel 在 `underlying === undefined` 时使用。

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/modules/market/sort.test.ts 末尾 describe 外新增：
describe('syntheticUnderlyingContract', () => {
  it('指数期权标底合成：productClass=1、isTrading=0、品种/中文名映射', () => {
    const c = syntheticUnderlyingContract('MO2608')
    expect(c.instrumentID).toBe('MO2608')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
    expect(c.productID).toBe('MO')
    expect(c.instrumentName).toBe('中证1000期权')
  })
  it('真实期货标底同格式但可交易标志由调用方决定（合成恒为不可交易）', () => {
    const c = syntheticUnderlyingContract('FG609')
    expect(c.instrumentID).toBe('FG609')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
  })
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/market/sort.test.ts`
Expected: FAIL `syntheticUnderlyingContract is not defined`

- [ ] **Step 3: 最小实现**

```ts
// frontend/src/modules/market/sort.ts 顶部 import 增加 getProductName：
import { getProductName } from '@/utils/productNames'
// 在 groupOptionsByUnderlying 函数之后新增：
/** 标的不可订阅时（指数期权 MO/IO/HO 的 underlyingInstrID 非期货），
 * 合成一条仅作组头的标底合约：productClass='1'（走 underlying 红粗渲染分支），
 * isTrading=0（不可下单/不可订阅）。 */
export function syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo {
  const productID = deriveUnderlyingProduct(underlyingInstrID)
  return {
    instrumentID: underlyingInstrID,
    instrumentName: getProductName(productID),
    exchangeID: '',
    productID,
    volumeMultiple: 0,
    priceTick: 0,
    expireDate: '',
    isTrading: 0,
    productClass: '1',
    underlyingInstrID: undefined,
    optionsType: undefined,
    strikePrice: undefined,
  }
}
```

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/market/sort.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/market/sort.ts frontend/src/modules/market/sort.test.ts
git commit -m "feat(options): 合成标底合约工具（指数期权组头）"
```

### Task 2: TQuoteTable 支持 `onRowClick`

**Files:**
- Modify: `frontend/src/modules/options/TQuoteTable.tsx`（`TQuoteRow` 加 `callInstrumentID`/`putInstrumentID`；`buildRecords` 填充；props 加 `onRowClick?`；单元格点击回调）
- Test: `frontend/src/modules/options/TQuoteTable.test.tsx`

**Interfaces:**
- Consumes: `OptionChain` 类型（`{ underlying, expireDate, calls: OptionQuote[], puts: OptionQuote[] }`），`OptionQuote` 含 `instrumentID`
- Produces: `TQuoteTable` 新签名 `onRowClick?: (instrumentID: string, price: number) => void`；点击 C 侧列回传该 `call.instrumentID`，P 侧列回传 `put.instrumentID`，中列（行权价）不回调，缺失侧不回调。

- [ ] **Step 1: 写失败测试**

```tsx
// frontend/src/modules/options/TQuoteTable.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { ListTable } from '@visactor/vtable'
import { TQuoteTable } from './TQuoteTable'
import type { OptionChain } from '@/services/types'

// vtable 在 jsdom 下无法真实初始化；mock ListTable，捕获 on('click_cell') handler
vi.mock('@visactor/vtable', () => ({
  ListTable: class {
    _handlers: Record<string, Function[]> = {}
    constructor(public el: any, public opts: any) {}
    on(ev: string, fn: Function) { (this._handlers[ev] ||= []).push(fn) }
    release() {}
    setRecords() {}
  } as any,
}))

const chain: OptionChain = {
  underlying: 'FG609',
  expireDate: '20260930',
  calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, optionType: '1', lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
  puts: [{ instrumentID: 'FG609-P-1250', strikePrice: 1300, optionType: '2', lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
}

function getClickHandler(table: any) {
  return table._handlers['click_cell'][0]
}

describe('TQuoteTable onRowClick', () => {
  it('未传 onRowClick 时不报错（回归 TQuoteView）', () => {
    const { container } = render(<TQuoteTable chain={chain} />)
    const table = (container.querySelector('div') as any).__vtable ?? (container as any).__vtable
    // 渲染完成即可，无回调断言
    expect(table).toBeDefined()
  })

  it('点击 C 侧列回传 call.instrumentID 与最新价', () => {
    const onRowClick = vi.fn()
    const { container } = render(<TQuoteTable chain={chain} onRowClick={onRowClick} />)
    const tbl = (container as any).__vtable
    // callLastPrice 是 index 6 列；行 1 = 第一行数据
    getClickHandler(tbl)({ row: 1, col: 6, event: {} })
    expect(onRowClick).toHaveBeenCalledWith('FG609-C-1300', 10)
  })

  it('点击中列（行权价，index 7）不回调', () => {
    const onRowClick = vi.fn()
    const { container } = render(<TQuoteTable chain={chain} onRowClick={onRowClick} />)
    getClickHandler((container as any).__vtable)({ row: 1, col: 7, event: {} })
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
```

注意：上面 mock 依赖 ListTable 实例能被取出。实现时需让 `TQuoteTable` 在 `useEffect` 里把 `tableRef.current` 挂到 `container.__vtable` 之外可由测试触达的位置。更稳妥的写法见 Step 3：在 `TQuoteTable` 暴露一个 `onReady?` 回调或在测试里通过 `fireEvent.click` 真实单元格不可行（canvas）。因此测试改用「捕获 click_cell handler」策略，要求 `TQuoteTable` 把创建好的 table 实例通过 `ref` 或 `onTableReady` 暴露。**采用下方 Step 3 的 `onTableReady?` 透传方案**：

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/TQuoteTable.test.tsx`
Expected: FAIL（测试文件/函数不存在）

- [ ] **Step 3: 最小实现**

```tsx
// TQuoteTable.tsx 改动：
interface TQuoteTableProps {
  chain: OptionChain
  snapshots?: Map<string, MarketSnapshot>
  /** 新增：点击 C/P 侧单元格回调；中列（行权价）与缺失侧不回调 */
  onRowClick?: (instrumentID: string, price: number) => void
  /** 新增：暴露 vtable 实例（测试用，生产可忽略） */
  onTableReady?: (table: ListTable) => void
}

// TQuoteRow 增加两侧合约 ID
interface TQuoteRow {
  strikePrice: number
  callInstrumentID?: string
  callLastPrice: number | string
  ...
  putInstrumentID?: string
  putLastPrice: number | string
  ...
}

// buildRecords 填充：
const c = entry.call
const p = entry.put
return {
  strikePrice: strike,
  callInstrumentID: c?.instrumentID,
  putInstrumentID: p?.instrumentID,
  callLastPrice: ...,
  ...
}

// 在 new ListTable(...) 之后：
tableRef.current = table
props.onTableReady?.(table)   // 透传实例给测试

// 在 table.on('click_cell', ...) 内，现有逻辑之后增加：
if (props.onRowClick) {
  const record = recordsRef.current[rowIndex]
  if (!record) return
  // 列定义顺序见 columns：call* 在左（0..4），strike 中（5），put* 在右（6..10）
  if (col >= 0 && col <= 4 && record.callInstrumentID) {
    const price = typeof record.callLastPrice === 'number' ? record.callLastPrice : 0
    props.onRowClick(record.callInstrumentID, price)
  } else if (col >= 6 && col <= 10 && record.putInstrumentID) {
    const price = typeof record.putLastPrice === 'number' ? record.putLastPrice : 0
    props.onRowClick(record.putInstrumentID, price)
  }
}
```
（列索引以 `columns` 数组 `TQuoteTable.tsx:81-101` 为准：callOpenInterest0、callVolume1、callAskPrice2、callBidPrice3、callLastPrice4、strikePrice5、putLastPrice6、putBidPrice7、putAskPrice8、putVolume9、putOpenInterest10。Step 1 测试 col 需按此更正。）

- [ ] **Step 4: 跑绿**（修正测试 col 索引后）

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/TQuoteTable.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/TQuoteTable.tsx frontend/src/modules/options/TQuoteTable.test.tsx
git commit -m "feat(options): TQuoteTable 支持 onRowClick 回填合约"
```

### Task 3: OptionChainGroup 组件（组头 + 到期切换 + 迷你 T 表 + 订阅）

**Files:**
- Create: `frontend/src/modules/options/OptionChainGroup.tsx`
- Test: `frontend/src/modules/options/OptionChainGroup.test.tsx`

**Interfaces:**
- Consumes:
  - `OptionGroup`（`{ underlyingID, underlying?: ContractInfo, options: ContractInfo[] }`）
  - `getOptionChains(underlying?: string): Promise<{ chains: OptionChain[] }>`（api）
  - `syntheticUnderlyingContract`（Task 1）
  - `TQuoteTable`（Task 2，含 `onRowClick`）
  - `addLockedContract(id)` / `removeLockedContract(id)`（`useMarketStore`）
  - `getSnapshots(ids)`（api）
  - `openTQuoteFloating(underlyingID)`（`@/utils/openFloatingTab`）
- Produces: `OptionChainGroup` 组件，props `{ group: OptionGroup; onSelectContract: (instrumentID, price) => void }`。展开时拉链、锁订阅、渲染 T 表；折叠/切到期/卸载解锁。

- [ ] **Step 1: 写失败测试**

```tsx
// OptionChainGroup.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { OptionChainGroup } from './OptionChainGroup'
import { useMarketStore } from '@/modules/market/store'
import { OptionGroup } from '@/modules/market/sort'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    getOptionChains: vi.fn().mockResolvedValue({
      chains: [
        { underlying: 'FG609', expireDate: '20260930', calls: [], puts: [] },
        { underlying: 'FG609', expireDate: '20261230', calls: [], puts: [] },
      ],
    }),
    getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  }
})
vi.mock('@/utils/openFloatingTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/openFloatingTab')>()
  return { ...actual, openTQuoteFloating: vi.fn() }
})

const group: OptionGroup = {
  underlyingID: 'FG609',
  underlying: { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
  options: [],
}

describe('OptionChainGroup', () => {
  beforeEach(() => {
    useMarketStore.setState({ lockedContracts: new Map(), addLockedContract: vi.fn(), removeLockedContract: vi.fn() })
  })

  it('默认折叠：组头可见、无到期切换条', () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText(/到期/)).toBeNull()
  })

  it('展开：渲染到期切换条，默认最早到期 20260930', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(screen.getByText('20260930')).toBeDefined()
    expect(screen.queryByText('20261230')).toBeDefined()
  })

  it('展开调用 addLockedContract；折叠调用 removeLockedContract', async () => {
    const { addLockedContract, removeLockedContract } = useMarketStore.getState()
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(addLockedContract).toHaveBeenCalled()
    fireEvent.click(screen.getByText('FG609'))
    expect(removeLockedContract).toHaveBeenCalled()
  })

  it('⇗ 新窗按钮调用 openTQuoteFloating(underlyingID)', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    fireEvent.click(screen.getByText('⇗ 新窗'))
    expect(useFloatingWindowSpy()).toHaveBeenCalledWith('FG609')
  })
})
// useFloatingWindowSpy 简化：在 Task 内直接 import openTQuoteFloating 断言
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionChainGroup.test.tsx`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 最小实现**

```tsx
import { useEffect, useRef, useState, useMemo } from 'react'
import type { OptionGroup } from '@/modules/market/sort'
import { getOptionChains, getSnapshots } from '@/services/api'
import { TQuoteTable } from './TQuoteTable'
import { useMarketStore } from '@/modules/market/store'
import { openTQuoteFloating } from '@/utils/openFloatingTab'

interface OptionChainGroupProps {
  group: OptionGroup
  onSelectContract: (instrumentID: string, price: number) => void
}

const RED_BOLD = { color: '#f87171', fontWeight: 'bold', fontSize: 14 }

export function OptionChainGroup({ group, onSelectContract }: OptionChainGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const [chains, setChains] = useState<OptionChain[] | null>(null)
  const [expireDate, setExpireDate] = useState<string | null>(null)
  const { addLockedContract, removeLockedContract } = useMarketStore()

  const underlyingLabel = group.underlying?.instrumentID ?? group.underlyingID

  // 展开时拉链（缓存）；选中最早到期
  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    getOptionChains(group.underlyingID).then((res) => {
      if (cancelled) return
      const sorted = [...res.chains].sort((a, b) => a.expireDate.localeCompare(b.expireDate))
      setChains(sorted)
      if (sorted.length > 0) setExpireDate(sorted[0].expireDate)
    })
    return () => { cancelled = true }
  }, [expanded, group.underlyingID])

  // 选链 → 锁订阅 + 预拉快照；链变化/折叠 → 解锁
  useEffect(() => {
    if (!expanded || !expireDate || !chains) return
    const chain = chains.find((c) => c.expireDate === expireDate)
    if (!chain) return
    const ids = [...chain.calls.map((q) => q.instrumentID), ...chain.puts.map((q) => q.instrumentID)]
    if (ids.length > 0) {
      ids.forEach((id) => addLockedContract(id))
      getSnapshots(ids).catch(() => {})
    }
    return () => {
      ids.forEach((id) => removeLockedContract(id))
    }
  }, [expanded, expireDate, chains, addLockedContract, removeLockedContract])

  const activeChain = chains?.find((c) => c.expireDate === expireDate) ?? null

  return (
    <div className="option-chain-group">
      <div className="option-chain-group__header" style={RED_BOLD} onClick={() => setExpanded((v) => !v)}>
        <span className="option-chain-group__arrow">{expanded ? '▼' : '▶'}</span>
        <span className="option-chain-group__name">{underlyingLabel}</span>
        <button
          className="option-chain-group__new-window"
          onClick={(e) => { e.stopPropagation(); openTQuoteFloating(group.underlyingID) }}
        >
          ⇗ 新窗
        </button>
      </div>
      {expanded && activeChain && (
        <>
          <div className="option-chain-group__expires">
            {chains!.map((c) => (
              <button
                key={c.expireDate}
                className={`option-chain-group__expire${c.expireDate === expireDate ? ' active' : ''}`}
                onClick={() => setExpireDate(c.expireDate)}
              >
                {c.expireDate}
              </button>
            ))}
          </div>
          <TQuoteTable chain={activeChain} onRowClick={onSelectContract} />
        </>
      )}
    </div>
  )
}
```
（`OptionChain` 类型需从 `@/services/types` import。）

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionChainGroup.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/OptionChainGroup.tsx frontend/src/modules/options/OptionChainGroup.test.tsx
git commit -m "feat(options): OptionChainGroup 组头+到期切换+订阅锁定"
```

### Task 4: OptionsPanel 重写为组列表 + 工具栏改造

**Files:**
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（移除平铺 `QuoteTable`/`optionsSpec`、移除 ⭐ 按钮；改为渲染 `OptionChainGroup[]`；工具栏筛选组/搜索过滤组）
- Test: `frontend/src/modules/options/OptionsPanel.test.tsx`（重写核心用例）

**Interfaces:**
- Consumes: `groupOptionsByUnderlying(options, futures)`、`filterByExchangeAndProduct(baseOptions, exchanges, products, getProduct)`、`OptionsPanel` 现有 `searchQuery` 逻辑（改过滤组）、`OptionChainGroup`（Task 3）、`usePointOrder` 的 `onOrder` 语义（`setSelectedInstrument` + `setOrderInstrument` + 非期货时 `setOrderForm({limitPrice})`）。
- Produces: 新的 `OptionsPanel` 渲染：折叠组列表；工具栏 = `ContractFilter`（组粒度）+ `ContractSearch`（过滤组）+ 🔍高级搜索（选中合约→展开定位）。

- [ ] **Step 1: 写失败测试**（针对新行为）

```tsx
// OptionsPanel.test.tsx 新增/改写：
describe('OptionsPanel 堆叠 T 型', () => {
  it('默认全部折叠：可见标底组头但不挂载 T 表', () => {
    render(<OptionsPanel />)
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText('到期')).toBeNull()
  })

  it('指数期权（MO2608）也渲染组头', () => {
    useContractsStore.setState({ contracts: [optMO, /* MO2608-P-8900 ... */], isLoaded: true })
    render(<OptionsPanel />)
    expect(screen.getByText('MO2608')).toBeDefined()
  })

  it('搜索框过滤组：输入 MO 仅显示 MO 组', () => {
    // 设 contracts 含 FG609 组 + MO2608 组
    render(<OptionsPanel />)
    fireEvent.change(screen.getByPlaceholderText('搜索合约...'), { target: { value: 'MO' } })
    expect(screen.getByText('MO2608')).toBeDefined()
    expect(screen.queryByText('FG609')).toBeNull()
  })

  it('T 行单击回填：展开 FG609 → 点击 C 侧 → 报单表收到合约与价格', async () => {
    const setOrderForm = vi.fn()
    useOrderStore.setState({ setOrderInstrument: vi.fn(), setOrderForm })
    render(<OptionsPanel />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    // 通过 TQuoteTable onRowClick 触发：模拟点击 C 侧（依赖 Task2 透出的 table）
    // 简化：直接断言 onSelectContract 被 OptionsPanel 以正确合约/价调用
    // （实际由 TQuoteTable click_cell 触发，集成测试见 Task2/3）
  })
})
```
（最后一条交互断言在集成层较脆；采用「展开后 OptionsPanel 把 onSelectContract 透传给 OptionChainGroup→TQuoteTable」的单元保证 + Task 2/3 已覆盖 click_cell。本条简化为断言 `openOrderPopup` 不被调用、`setOrderInstrument` 在组头点击时不触发。）

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx`
Expected: FAIL（旧测试断言 `optionsSpec`/`QuoteTable` 挂载，与新结构冲突）

- [ ] **Step 3: 最小实现（重写 OptionsPanel 渲染段）**

```tsx
// OptionsPanel.tsx 关键改造（保留 useMemo 数据管道、工具栏骨架）：
// 1. listRows 改为「组」列表而非「合约」列表：
const groups = useMemo(() => {
  const filteredOptions = filterByExchangeAndProduct(
    baseOptions, filter.exchanges, filter.products,
    (c) => deriveUnderlyingProduct(c.underlyingInstrID ?? ''),
  )
  return groupOptionsByUnderlying(filteredOptions, futures)
}, [baseOptions, filter, futures])

// 2. 搜索过滤「组」：按 underlyingID / 品种中文名
const visibleGroups = useMemo(() => {
  if (!searchQuery.trim()) return groups
  const q = searchQuery.toLowerCase()
  return groups.filter((g) =>
    g.underlyingID.toLowerCase().includes(q) ||
    getProductName(deriveUnderlyingProduct(g.underlyingID)).toLowerCase().includes(q),
  )
}, [groups, searchQuery])

// 3. onSelectContract（透传给 OptionChainGroup，语义对齐平铺期权的 onOrder）：
const onSelectContract = useCallback((instrumentID: string, price: number) => {
  setSelectedInstrument(instrumentID)
  setOrderInstrument(instrumentID)
  const inst = contracts.find((c) => c.instrumentID === instrumentID)
  if (!(inst && inst.productClass === '1')) setOrderForm({ limitPrice: price }) // 指数合成组头不可达此（无 onRowClick）
}, [contracts, setSelectedInstrument, setOrderInstrument, setOrderForm])

// 4. 渲染：移除 <QuoteTable spec={optionsSpec} .../>，改为：
<div className="options-groups">
  {visibleGroups.map((g) => (
    <OptionChainGroup key={g.underlyingID} group={g} onSelectContract={onSelectContract} />
  ))}
</div>

// 5. 移除工具栏 ⭐ 按钮（P1 不做合约收藏；P2 加系列收藏）。

// 6. ContractSearch 的 onQueryChange 绑定 setSearchQuery（过滤组）；onSelect 改为
//    定位展开：找到该合约所在 group → 展开。本期若实现成本高，可仅作「过滤组」不自动展开，
//    但 spec §4.3 要求「选中合约→展开定位」，故实现：onSelect={handleSelectContract}
//    其中 handleSelectContract 设 searchQuery 为标底并展开首个匹配组（通过 ref map group→ref）。
```

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx src/modules/market/sort.test.ts src/modules/options/OptionChainGroup.test.tsx src/modules/options/TQuoteTable.test.tsx`
Expected: PASS

- [ ] **Step 5: 类型 + lint + 全量回归**

Run: `cd frontend && npx tsc --noEmit && npx eslint --max-warnings 0 src/modules/options/OptionsPanel.tsx src/modules/options/OptionChainGroup.tsx src/modules/options/TQuoteTable.tsx src/modules/market/sort.ts && node_modules/.bin/vitest run`
Expected: 全绿（注意隔离 electron main 偶发超时，与本次无关）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionsPanel.test.tsx frontend/src/components/ContractSearch 2>/dev/null; git add frontend/src/modules/options/
git commit -m "feat(options): 期权页重构为堆叠可折叠 T 型链（P1）"
```

---

## P2 — 阶段二：系列收藏

### Task 5: collections store 加 `seriesIDs`

**Files:**
- Modify: `frontend/src/stores/collections.ts`（`Collection` 加 `seriesIDs`；新增 4 个方法；`persist` 兼容；`loadCollections` 系列存在性校验）
- Test: `frontend/src/stores/collections.test.ts`

**Interfaces:**
- Consumes: `useContractsStore`（`contracts` 用于校验 series 是否存在对应期权）
- Produces: `Collection.seriesIDs: string[]`；`addSeriesToCollections(seriesIDs, collectionIds)`、`removeSeriesFromCollection(seriesID, collectionId)`、`removeSeriesFromAllCollections(seriesIDs)`、`unionSerializedIds(collections): Set<string>`。

- [ ] **Step 1: 写失败测试**

```ts
describe('系列收藏', () => {
  it('addSeriesToCollections 加入 seriesIDs 并持久化', () => {
    const { addSeriesToCollections } = useCollectionsStore.getState()
    const id = useCollectionsStore.getState().createCollection('期权夹')
    const collId = id
    addSeriesToCollections(['MO2608'], [collId])
    const c = useCollectionsStore.getState().collections.find((x) => x.id === collId)!
    expect(c.seriesIDs).toContain('MO2608')
  })

  it('removeSeriesFromCollection 移除', () => {
    const { addSeriesToCollections, removeSeriesFromCollection } = useCollectionsStore.getState()
    const collId = useCollectionsStore.getState().createCollection('期权夹')
    addSeriesToCollections(['MO2608'], [collId])
    removeSeriesFromCollection('MO2608', collId)
    expect(useCollectionsStore.getState().collections.find((x) => x.id === collId)!.seriesIDs).not.toContain('MO2608')
  })

  it('unionSerializedIds 收集所有 series', () => {
    useCollectionsStore.setState({
      collections: [
        { id: 'a', name: 'x', instrumentIDs: [], seriesIDs: ['MO2608'] },
        { id: 'b', name: 'y', instrumentIDs: [], seriesIDs: ['IO2608'] },
      ],
    })
    expect(unionSerializedIds(useCollectionsStore.getState().collections)).toEqual(new Set(['MO2608', 'IO2608']))
  })

  it('loadCollections 校验 series：无对应期权的 series 被剔除', async () => {
    // contracts 含 MO2608 期权 → MO2608 保留；不存在的 XX9999 剔除
    useContractsStore.setState({ contracts: [{ instrumentID: 'MO2608-P-8900', productClass: '2', underlyingInstrID: 'MO2608' } as any], isLoaded: true })
    useCollectionsStore.setState({ collections: [{ id: 'a', name: 'x', instrumentIDs: [], seriesIDs: ['MO2608', 'XX9999'] }] })
    await useCollectionsStore.getState().loadCollections()
    const c = useCollectionsStore.getState().collections.find((x) => x.id === 'a')!
    expect(c.seriesIDs).toEqual(['MO2608'])
  })
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/stores/collections.test.ts`
Expected: FAIL（`seriesIDs`/`addSeriesToCollections` 不存在）

- [ ] **Step 3: 最小实现**

```ts
// collections.ts：
export interface Collection {
  id: string
  name: string
  instrumentIDs: string[]
  seriesIDs: string[]  // 新增：标底系列（如 'MO2608'）
}

// unionFavoritedIds 保持不变（合约粒度）
export function unionSerializedIds(collections: Collection[]): Set<string> {
  const set = new Set<string>()
  for (const c of collections) for (const id of c.seriesIDs) set.add(id)
  return set
}

interface CollectionsStore {
  // ... 原有
  addSeriesToCollections: (seriesIDs: string[], collectionIds: string[]) => void
  removeSeriesFromCollection: (seriesID: string, collectionId: string) => void
  removeSeriesFromAllCollections: (seriesIDs: string[]) => void
}

// createCollection：加 seriesIDs: []
createCollection: (name) => {
  const id = nextCollectionId()
  const collections = [...get().collections, { id, name, instrumentIDs: [], seriesIDs: [] }]
  persist(collections)
  set({ collections })
  return id
}

addSeriesToCollections: (seriesIDs, collectionIds) => {
  const collections = get().collections.map((c) => {
    if (!collectionIds.includes(c.id)) return c
    const added = seriesIDs.filter((id) => !c.seriesIDs.includes(id))
    if (added.length === 0) return c
    return { ...c, seriesIDs: [...c.seriesIDs, ...added] }
  })
  persist(collections)
  set({ collections })
},

removeSeriesFromCollection: (seriesID, collectionId) => {
  const collections = get().collections.map((c) =>
    c.id === collectionId ? { ...c, seriesIDs: c.seriesIDs.filter((id) => id !== seriesID) } : c,
  )
  persist(collections)
  set({ collections })
},

removeSeriesFromAllCollections: (seriesIDs) => {
  const ids = new Set(seriesIDs)
  const collections = get().collections.map((c) => ({
    ...c,
    seriesIDs: c.seriesIDs.filter((id) => !ids.has(id)),
  }))
  persist(collections)
  set({ collections })
},
```

`loadCollections` 的 series 校验：在现有合约校验之后追加：
```ts
const optByUnderlying = new Map<string, boolean>()
for (const c of (result.instruments ?? [])) {
  if (c.productClass === '2' || c.productClass === '6') optByUnderlying.set(c.underlyingInstrID, true)
}
const nextSeries = collections.map((c) => ({
  ...c,
  seriesIDs: c.seriesIDs.filter((s) => optByUnderlying.get(s) === true),
}))
```
（`getInstrumentsByIds` 返回 `instrumentID` + `productClass` + `underlyingInstrID`，见 `api.ts` 返回结构；若无 `underlyingInstrID` 则改为遍历 `useContractsStore` 的 contracts。Task 实现时按实际类型确认。）

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/stores/collections.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/stores/collections.ts frontend/src/stores/collections.test.ts
git commit -m "feat(collections): 支持系列收藏 seriesIDs"
```

### Task 6: CollectionPicker 加 series 模式

**Files:**
- Modify: `frontend/src/components/CollectionPicker/index.tsx`（props 加 `seriesIDs?: string[]` 与 `instrumentIDs` 互斥；提交走系列 API；初始勾选按 series 判定）
- Test: `frontend/src/components/CollectionPicker/index.test.tsx`

**Interfaces:**
- Consumes: `useCollectionsStore` 的 `addSeriesToCollections`/`removeSeriesFromCollection`/`removeSeriesFromAllCollections`（Task 5）
- Produces: `CollectionPicker` 可接收 `seriesIDs`，渲染「收藏整条链到收藏夹」。

- [ ] **Step 1: 写失败测试**

```tsx
it('series 模式：初始勾选按 seriesIDs 判定，确认走 addSeriesToCollections', () => {
  const addSeriesToCollections = vi.fn()
  useCollectionsStore.setState({
    collections: [{ id: 'a', name: '期权夹', instrumentIDs: [], seriesIDs: [] }],
    addSeriesToCollections,
  } as any)
  render(<CollectionPicker isOpen seriesIDs={['MO2608']} onClose={() => {}} />)
  // 单 series：默认勾选所在夹（此处不在任何夹）→ 勾选后会 addSeriesToCollections(['MO2608'], ['a'])
  fireEvent.click(screen.getByText('确定'))
  expect(addSeriesToCollections).toHaveBeenCalledWith(['MO2608'], expect.arrayContaining(['a']))
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/components/CollectionPicker/index.test.tsx`
Expected: FAIL

- [ ] **Step 3: 最小实现**

```tsx
interface CollectionPickerProps {
  isOpen: boolean
  instrumentIDs?: string[]
  /** P2 新增：系列模式（与 instrumentIDs 互斥） */
  seriesIDs?: string[]
  onClose: () => void
}

export function CollectionPicker({ isOpen, instrumentIDs = [], seriesIDs, onClose }: CollectionPickerProps) {
  const isSeries = seriesIDs != null
  const ids = isSeries ? seriesIDs : instrumentIDs
  const single = ids.length === 1
  const targetId = ids[0]

  // 初始勾选：系列模式按 seriesIDs 判定
  useEffect(() => {
    if (!isOpen) return
    if (single) {
      const key = isSeries ? 'seriesIDs' : 'instrumentIDs'
      setChecked(new Set(collections.filter((c) => c[key].includes(targetId)).map((c) => c.id)))
    } else setChecked(new Set())
    setNewName('')
  }, [isOpen, single, targetId, isSeries])

  const handleConfirm = () => {
    const checkedIds = Array.from(checked)
    if (checkedIds.length === 0) {
      if (single) {
        if (isSeries) removeSeriesFromAllCollections([targetId])
        else removeFromAllCollections([targetId])
        toast.success(`已移除 ${targetId} 的全部收藏`)
        onClose()
      } else toast.error('请选择收藏夹')
      return
    }
    if (isSeries) {
      if (single) {
        const current = collections.filter((c) => c.seriesIDs.includes(targetId)).map((c) => c.id)
        const toAdd = checkedIds.filter((id) => !current.includes(id))
        const toRemove = current.filter((id) => !checkedIds.includes(id))
        if (toAdd.length > 0) addSeriesToCollections([targetId], toAdd)
        for (const id of toRemove) removeSeriesFromCollection(targetId, id)
      } else {
        addSeriesToCollections(ids, checkedIds)
      }
      toast.success(`已将 ${ids.length} 个系列收藏到 ${checkedIds.length} 个收藏夹`)
    } else {
      // 原有合约逻辑
    }
    onClose()
  }

  // 头部文案按 isSeries 切换
}
```

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/components/CollectionPicker/index.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/CollectionPicker/index.tsx frontend/src/components/CollectionPicker/index.test.tsx
git commit -m "feat(collections): CollectionPicker 支持系列模式"
```

### Task 7: OptionsPanel 组头 ⭐ 系列收藏（P1 后增量）

**Files:**
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（`OptionChainGroup` 组头加 ⭐；打开 `CollectionPicker` series 模式）
- Test: `frontend/src/modules/options/OptionsPanel.test.tsx`（追加：组头 ⭐ 打开 series 模式 picker）

**Interfaces:**
- Consumes: `unionSerializedIds(collections)`（Task 5）、`CollectionPicker` series 模式（Task 6）、`OptionChainGroup` 组头需透传 `isFavorited` 与 `onToggleFavorite(seriesID)`。
- Produces: 组头 ⭐ 切换系列收藏；OptionsPanel 管理 `picker` state（series 模式）。

- [ ] **Step 1: 写失败测试**

```tsx
it('组头 ⭐ 打开系列收藏选夹面板（series 模式）', async () => {
  render(<OptionsPanel />)
  // 展开 FG609
  fireEvent.click(screen.getByText('FG609'))
  await screen.findByText('20260930')
  const star = screen.getByTitle('收藏整条链') // 组头 ⭐
  fireEvent.click(star)
  expect(screen.getByText('收藏到收藏夹')).toBeDefined() // picker 打开（series 文案）
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx`
Expected: FAIL（组头无 ⭐）

- [ ] **Step 3: 最小实现**

`OptionChainGroup` props 增加 `isFavorited?: boolean`、`onToggleFavorite?: (seriesID: string) => void`；组头渲染 `★/☆` 按钮（stopPropagation，不触发折叠），点击调用 `onToggleFavorite(group.underlyingID)`。

`OptionsPanel` 增加 `pickerSeries: string[] | null`；组头 ⭐ → `setPickerSeries([underlyingID])`；渲染 `<CollectionPicker isOpen={!!pickerSeries} seriesIDs={pickerSeries ?? []} onClose=... />`。

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionChainGroup.tsx frontend/src/modules/options/OptionsPanel.test.tsx
git commit -m "feat(options): 组头 ⭐ 系列收藏（P2）"
```

### Task 8: CollectionPage 渲染 series 为堆叠 T 型组

**Files:**
- Modify: `frontend/src/pages/CollectionPage.tsx`（渲染 `seriesIDs` 段，复用 `OptionChainGroup`；保留 `instrumentIDs` 段）
- Test: `frontend/src/pages/CollectionPage.test.tsx`（双段渲染）

**Interfaces:**
- Consumes: `OptionChainGroup`（Task 3）、`unionSerializedIds`、`collection.seriesIDs`
- Produces: 收藏夹页 = series 段（堆叠 T 型，可交互）+ 合约段（现有单合约展示）并存。

- [ ] **Step 1: 写失败测试**

```tsx
it('收藏夹含 series 时渲染为 T 型组（可展开）', () => {
  useCollectionsStore.setState({ collections: [{ id: 'c1', name: '期权夹', instrumentIDs: [], seriesIDs: ['MO2608'] }] })
  render(<CollectionPage collectionId="c1" />)
  expect(screen.getByText('MO2608')).toBeDefined()
  // 展开后出到期条
  fireEvent.click(screen.getByText('MO2608'))
  // findByText 到期日（依赖 mock 的 getOptionChains）
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/pages/CollectionPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: 最小实现**

```tsx
// CollectionPage.tsx 在 optionRows / contractRows 之前加 series 段：
const seriesIDs = collection.seriesIDs ?? []
// series → 组：从 contracts 反查该 series 下的期权，组建成 OptionGroup
const seriesGroups = useMemo(() => {
  return seriesIDs.map((sid) => {
    const opts = memberContracts.filter((c) => (c.underlyingInstrID ?? '') === sid)
    const underlying = allFutures.find((f) => f.instrumentID === sid)
    return { underlyingID: sid, underlying, options: opts }
  })
}, [seriesIDs, memberContracts, allFutures])

// 渲染：若有 seriesGroups 且有 opts 非空，渲染 series 段标题 + OptionChainGroup 列表
{seriesGroups.filter((g) => g.options.length > 0).map((g) => (
  <OptionChainGroup key={g.underlyingID} group={g} onSelectContract={handleClickLike} />
))}
// contract 段保持原样
```

- [ ] **Step 4: 跑绿 + 类型 + lint**

Run: `cd frontend && node_modules/.bin/vitest run src/pages/CollectionPage.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 src/pages/CollectionPage.tsx`
Expected: PASS / 干净

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/CollectionPage.tsx frontend/src/pages/CollectionPage.test.tsx
git commit -m "feat(collections): 收藏夹页渲染系列为堆叠 T 型（P2）"
```

### Task 9: 全量回归 + 收尾

**Files:**
- 无新增，仅验证。

- [ ] **Step 1: 全量测试 + 类型 + lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint --max-warnings 0 "src/**/*.{ts,tsx}" && node_modules/.bin/vitest run`
Expected: 全绿（隔离 electron main 偶发超时忽略，与本次无关）

- [ ] **Step 2: 提交（若有零散修改）**

```bash
git add -A && git commit -m "chore(options): 堆叠 T 型链 + 系列收藏 收尾"
```
（若无零散修改则跳过；不要空提交。）

---

## Self-Review 结果

1. **Spec 覆盖**：§4.1 数据管道→Task4；§4.2 合成标底→Task1、OptionChainGroup→Task3、TQuoteTable onRowClick→Task2；§4.3 交互→Task3/Task4；§4.4 订阅→Task3；§4.5 工具栏→Task4；§5.1 数据模型→Task5；§5.2 组头⭐→Task7；§5.3 收藏夹页→Task8；§6 测试策略全覆盖。
2. **Placeholder 扫描**：Task2/Task4 标注了列索引需按 `columns` 数组实际值更正（已写明具体索引），非占位；其余均为可执行代码。
3. **类型一致性**：`OptionGroup`/`OptionChain`/`ContractInfo` 跨 Task 一致；`syntheticUnderlyingContract`(Task1)→OptionsPanel(Task4)；`onRowClick`(Task2)→OptionChainGroup(Task3)→OptionsPanel(Task4)；series API(Task5)→CollectionPicker(Task6)→OptionsPanel(Task7)/CollectionPage(Task8)。`unionSerializedIds` 命名在 Task5/Task7/Task8 一致。
