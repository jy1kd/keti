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

