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

