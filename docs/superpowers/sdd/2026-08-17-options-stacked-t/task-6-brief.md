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

