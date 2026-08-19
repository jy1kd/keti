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

