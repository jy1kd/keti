### Task 3: 筛选交叉过滤（交易所↔品种双向联动）

**Files:**
- Modify: `frontend/src/modules/market/filter.ts`（加 `computeFilterOptions`）
- Modify: `frontend/src/components/ContractFilter/index.tsx`（用动态列表替换静态传入）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（期货页传全量合约供交叉计算）
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`（期权页传全量合约供交叉计算，按标底品种）
- Test: `frontend/src/modules/market/filter.test.ts`、`frontend/src/components/ContractFilter/index.test.tsx`

**Interfaces:**
- Consumes: `MarketFilter`/`filterByExchangeAndProduct`（filter.ts）。
- Produces: `computeFilterOptions(contracts, exchanges, products, getProduct) → { exchanges: string[]; products: string[] }`：`exchanges` = 有合约满足「products(或空)」的交易所；`products` = 有合约满足「exchanges(或空)」的品种。`ContractFilter` 增加可选 props 或在组件内接收全量契约与 getProduct 自行计算。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/market/filter.test.ts` 追加：

```ts
import { computeFilterOptions } from './filter'

describe('computeFilterOptions', () => {
  const list = [
    c('FG609', 'CZCE', 'FG'), c('cu2609', 'SHFE', 'cu'),
    c('MA609', 'CZCE', 'MA'), c('MA610', 'CZCE', 'MA'),
  ]
  it('未选任何筛选时列出全部交易所与品种', () => {
    const r = computeFilterOptions(list, [], [], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE', 'SHFE'])
    expect(r.products).toEqual(['FG', 'cu', 'MA'])
  })
  it('选品种后交易所只剩有该品种的交易所', () => {
    const r = computeFilterOptions(list, [], ['MA'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
  })
  it('选交易所后品种只剩该所有合约的品种', () => {
    const r = computeFilterOptions(list, ['SHFE'], [], (x) => x.productID)
    expect(r.products).toEqual(['cu'])
  })
  it('已选品种与已选交易所交集（不影响可用项）', () => {
    const r = computeFilterOptions(list, ['CZCE'], ['FG'], (x) => x.productID)
    expect(r.exchanges).toEqual(['CZCE'])
    expect(r.products).toEqual(['FG', 'MA'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts`
Expected: FAIL（`computeFilterOptions` 未导出）

- [ ] **Step 3: 实现 computeFilterOptions**

`frontend/src/modules/market/filter.ts`：

```ts
/** 筛选面板动态选项：exchanges = 有合约满足已选品种的交易所；products = 有合约满足已选交易所的品种（空集=不限） */
export function computeFilterOptions(
  contracts: ContractInfo[],
  exchanges: string[],
  products: string[],
  getProduct: (c: ContractInfo) => string,
): { exchanges: string[]; products: string[] } {
  const exSet = exchanges.length ? new Set(exchanges) : null
  const prodSet = products.length ? new Set(products) : null
  // 可选交易所：满足已选品种（若有）的合约所涉及的交易所
  const ex = new Set<string>()
  // 可选品种：满足已选交易所（若有）的合约所涉及的品种
  const prod = new Set<string>()
  for (const c of contracts) {
    if (prodSet && !prodSet.has(getProduct(c))) continue
    ex.add(c.exchangeID)
    if (!exSet || exSet.has(c.exchangeID)) prod.add(getProduct(c))
  }
  return { exchanges: [...ex].sort(), products: [...prod].sort() }
}
```

（注意：`ex` 只累加「品种满足」的合约交易所；`prod` 只累加「交易所满足」的合约品种。）

- [ ] **Step 4: ContractFilter 用动态列表**

`frontend/src/components/ContractFilter/index.tsx`：props 增加 `getProduct: (c: ContractInfo) => string` 与 `allContracts: ContractInfo[]`（或改为接收 `exchanges`/`products` 全量 + 派生函数）；组件内部用 `computeFilterOptions` 计算展示列表。已选项目仍显示在列表中（即使被交叉过滤掉，只要它在已选集合中就要保留勾选显示，避免已选项消失无法取消）——实现时把「已选项并回可用列表」。

- [ ] **Step 5: 两页接入**

`MarketPanel.tsx`：`<ContractFilter allContracts={sortedFutures} getProduct={(c)=>c.productID} .../>`（品种=productID）。`OptionsPanel.tsx`：`<ContractFilter allContracts={options} getProduct={(c)=>deriveUnderlyingProduct(c.underlyingInstrID ?? '')} .../>`（品种=标底品种）。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/filter.test.ts src/components/ContractFilter/index.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx`
Expected: PASS

- [ ] **Step 7: 全量回归 + 提交**

Run: `cd frontend && npm test && npm run build && npx tsc --noEmit`
Expected: 全绿 + 构建/类型通过

```bash
git add frontend/src/modules/market/filter.ts frontend/src/components/ContractFilter/ frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/options/OptionsPanel.tsx
git commit -m "feat(market): 筛选交易所/品种双向交叉联动（computeFilterOptions）"
```

---

## Self-Review 记录

- **Spec 覆盖**：§7.1 标底合并行 → V2-1；§7.2 T型报价独立悬浮标签 → V2-2；§7.3 筛选交叉 → V2-3。全覆盖。
- **类型一致性**：`openTQuoteFloating(underlyingID?)`、`TQuoteView { instrumentID? }`、`'tquote'` tab、`computeFilterOptions` 签名在 V2-1/V2-2/V2-3 各自定义并被消费方引用，字段一致。
- **风险点**：V2-1 的 `mergeCells` 时序（setRecords 后需渲染完成再合并，用 rAF 兜底）；V2-2 的 TQuoteView 自包含化是中等重构（删 store 需确认无孤儿引用，已核实仅 TQuoteView 使用）；V2-2 多实例按 `instrumentID` 去重（`generateTabId` 用 `props.instrumentID`，`tab-tquote-<标底>` 天然成立）。
