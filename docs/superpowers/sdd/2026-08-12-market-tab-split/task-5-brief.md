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

