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

