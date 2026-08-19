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

