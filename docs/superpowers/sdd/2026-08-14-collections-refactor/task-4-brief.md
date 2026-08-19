### Task 4: 标签系统改造（collections/collection 类型 + 页面壳 + TabContent）

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/App.tsx`（onNavigateTab 'favorites' → 管理页）
- Create: `frontend/src/pages/CollectionsPage.tsx`（壳：空态）
- Create: `frontend/src/pages/CollectionPage.tsx`（壳：空态）
- Test: `frontend/src/stores/tabs.test.ts`（更新）、`frontend/src/components/TabContent/index.test.tsx`（更新）

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）
- Produces: `TabType` 含 `'collections'`/`'collection'`、不含 `'favorites'`；`generateTabId` 支持 `props.collectionId`；`openTab` 按 type+collectionId 去重；`TabContent` 渲染 `<CollectionsPage />` / `<CollectionPage collectionId={getCollectionId(tab.props)} tabId={tab.id} />`

- [ ] **Step 1: 写失败测试（tabs store）**

更新 `frontend/src/stores/tabs.test.ts`：
- `TAB_TYPES` 期望改为：`['market','collections','collection','order','kline','options','tquote','ipc-monitor','settings','query','infinite']`
- 所有 `type: 'favorites'` 的 openTab/closeTab/getTabByType 用例改为 `type: 'collections'`（标题 `📁 收藏夹`）或 `type: 'collection'`
- 新增用例：

```ts
it('generateTabId 支持 collectionId 后缀', () => {
  const { generateTabId } = await import('./tabs')
  expect(generateTabId('collection', { collectionId: 'coll-x' })).toBe('tab-collection-coll-x')
})

it('openTab 按 type+collectionId 去重（激活已有）', () => {
  const { openTab } = useTabStore.getState()
  openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'coll-x' } })
  const result = openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'coll-x' } })
  expect(result).toBe(true)
  expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(1)
})

it('可同时打开多个不同 collectionId 的夹标签', () => {
  const { openTab } = useTabStore.getState()
  openTab({ type: 'collection', title: '📁 A', props: { collectionId: 'a' } })
  openTab({ type: 'collection', title: '📁 B', props: { collectionId: 'b' } })
  expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(2)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts`
Expected: FAIL — 类型/去重未实现。

- [ ] **Step 3: 改 `stores/tabs.ts`**

1. `TabType`：删 `'favorites'`，加 `'collections'`、`'collection'`（放在 market 之后）
2. `TAB_TYPES` 同步
3. `generateTabId`：

```ts
export function generateTabId(type: TabType, props?: Record<string, unknown>): string {
  const suffix = props?.collectionId ?? props?.instrumentID
  const suffixStr = typeof suffix === 'string' ? `-${suffix}` : ''
  return `tab-${type}${suffixStr}`
}
```

4. `openTab` 去重条件追加 collectionId：

```ts
const existing = state.tabs.find(
  (t) =>
    t.id === tabId ||
    (typeof props.instrumentID === 'string' &&
      t.type === type &&
      t.props.instrumentID === props.instrumentID) ||
    (typeof props.collectionId === 'string' &&
      t.type === type &&
      t.props.collectionId === props.collectionId),
)
```

- [ ] **Step 4: 改 `TabContent/index.tsx` + App.tsx + 页面壳**

`TabContent/index.tsx`：
- import 替换：删 `FavoritesPage`，加 `CollectionsPage`、`CollectionPage`
- 加 `getCollectionId` 辅助：

```ts
function getCollectionId(props: Record<string, unknown>): string {
  return typeof props.collectionId === 'string' ? props.collectionId : ''
}
```

- switch：删 `case 'favorites'`，加：

```ts
case 'collections':
  return <CollectionsPage />
case 'collection':
  return <CollectionPage collectionId={getCollectionId(tab.props)} tabId={tab.id} />
```

创建页面壳 `pages/CollectionsPage.tsx`：

```tsx
import './CollectionsPage.css'

/** 收藏夹管理页（壳：Task 5 完整实现） */
export function CollectionsPage() {
  return (
    <section className="collections-page" data-testid="collections-page">
      <div className="collections-page__empty">
        <p>收藏夹</p>
        <p className="collections-page__hint">管理页实现中…</p>
      </div>
    </section>
  )
}
```

创建页面壳 `pages/CollectionPage.tsx`：

```tsx
import './CollectionPage.css'

/** 单收藏夹页（壳：Task 6 完整实现） */
export function CollectionPage({ collectionId, tabId }: { collectionId: string; tabId: string }) {
  return (
    <section className="collection-page" data-testid="collection-page">
      <div className="collection-page__empty">
        <p>收藏夹 {collectionId}</p>
        <p className="collection-page__hint">夹页实现中…</p>
      </div>
    </section>
  )
}
```

创建两个壳 CSS（`CollectionsPage.css` / `CollectionPage.css`）：

```css
.collections-page,
.collection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.collections-page__empty,
.collection-page__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.collections-page__hint,
.collection-page__hint {
  font-size: 13px;
  margin-top: 8px;
}
```

`App.tsx` onNavigateTab：`case 'favorites': openTab({ type: 'collections', title: '📁 收藏夹' }); break`

**删除 FavoritesPage（预检裁定）**：Task 4 移除 `'favorites'` tab type 后，`FavoritesPage.tsx` 的 `t.type === 'favorites'` 比较会变 TS2367 类型错误（阻断 `tsc --noEmit`），且 TabContent 已不再导入它——故在本任务一并删除三个文件（不再等 Task 7）：
`git rm frontend/src/pages/FavoritesPage.tsx frontend/src/pages/FavoritesPage.test.tsx frontend/src/pages/FavoritesPage.css`

- [ ] **Step 5: 更新 TabContent 测试**

`TabContent/index.test.tsx`：原 `favorites` 渲染用例改为 `collections` 渲染 `<CollectionsPage />`（断言 `data-testid="collections-page"`）；新增 `collection` 用例（断言 `data-testid="collection-page"` 且传入 collectionId）。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx src/components/TabContent/detachFlow.repro.test.tsx src/components/TabContent/detachFlow.integration.test.tsx`
Expected: PASS（若 App.test 因 onNavigateTab 变化失败，属 Task 7 范围，先记录）

- [ ] **Step 7: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/App.tsx frontend/src/pages/CollectionsPage.tsx frontend/src/pages/CollectionsPage.css frontend/src/pages/CollectionPage.tsx frontend/src/pages/CollectionPage.css frontend/src/stores/tabs.test.ts frontend/src/components/TabContent/index.test.tsx
git rm frontend/src/pages/FavoritesPage.tsx frontend/src/pages/FavoritesPage.test.tsx frontend/src/pages/FavoritesPage.css
git commit -m "feat(collections): 标签系统改造（collections/collection 类型 + 页面壳 + TabContent + 删 FavoritesPage）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

