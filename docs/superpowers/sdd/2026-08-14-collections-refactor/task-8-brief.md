### Task 8: 菜单「📁 收藏夹」+ market-view 改向 + 全量回归

**Files:**
- Modify: `frontend/electron/menuTemplate.ts`
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（onMarketView 'favorites' → 打开管理页）
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`（更新）、`frontend/src/modules/market/MarketPanel.test.tsx`（onMarketView 用例更新）

- [ ] **Step 1: 改 `menuTemplate.ts` label**

`{ id: 'market-favorites', label: '⭐ 自选行情', action: { type: 'market-view', view: 'favorites' } }` → `label: '📁 收藏夹'`。

- [ ] **Step 2: 更新 `menuTemplate.test.ts`**

line 30 期望数组改为 `['📊 期货', '📉 期权', '📁 收藏夹', '📉 T型报价', '🪟 在新窗口打开']`。

- [ ] **Step 3: 改 `MarketPanel.tsx` onMarketView**

```tsx
useEffect(() => {
  if (!isElectron()) return
  const cleanup = window.electronAPI?.onMarketView?.((view) => {
    if (view === 'options') {
      const options = useTabStore.getState().tabs.find((t) => t.type === 'options')
      if (options) useTabStore.getState().setActiveTab(options.id)
      return
    }
    if (view === 'favorites') {
      useTabStore.getState().openTab({ type: 'collections', title: '📁 收藏夹' })
      return
    }
    setActiveTab('all')
    const market = useTabStore.getState().tabs.find((t) => t.type === 'market')
    if (market) useTabStore.getState().setActiveTab(market.id)
  })
  return () => cleanup?.()
}, [])
```

- [ ] **Step 4: 更新 `MarketPanel.test.tsx` onMarketView 用例**

`view=favorites/all → 激活期货标签并切内部 自选/全部` 拆为两个：
- `view=favorites` → `useTabStore.getState().tabs.some((t) => t.type === 'collections')` 为 true（打开管理页），不切期货页内部自选（`自选` 按钮不 active）
- `view=all` → 激活期货标签，`全部` active

- [ ] **Step 5: 全量前端回归 + 类型检查 + 构建**

Run:
```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```
Expected: 全部通过（前端 1241 左右；后端 `cd server && python -m pytest tests/` 也应通过——本特性纯前端，仅需回归确认无破坏）

- [ ] **Step 6: 提交**

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx
git commit -m "feat(collections): 菜单「📁 收藏夹」+ market-view favorites 改向管理页 + 全量回归

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- §3 数据模型/持久化/迁移 → Task 1 ✓
- §4 收藏入口统一 → CollectionPicker + 入口改造 → Task 2、3 ✓（⭐/右键/工具栏/搜索弹窗；夹页直切 → Task 6）
- §5.1 标签系统 → Task 4 ✓；§5.2 管理页 → Task 5 ✓；§5.3 夹页 → Task 6 ✓；§5.4 期货页自选聚合 → Task 3（sortedFavorites 派生自 favoritedIds）✓
- §6 订阅调整 → Task 7 ✓（shouldSubscribe=可见+锁定）
- §7 菜单/IPC → Task 8 ✓
- §10 删除项 → Task 4（tab type）、Task 7（FavoritesPage + contracts favorites + userPrefs selectedContracts）✓
- 订阅上限不受多夹影响（只订阅打开的夹）→ Task 6 可见区合并 + Task 7 ✓

**2. Placeholder scan:** 无 TBD/TODO；每步含完整代码。

**3. Type consistency:**
- `generateTabId('collection', { collectionId })` → `tab-collection-<id>`（Task 4）与 CollectionPage/openTab 一致 ✓
- `useContractMenus` 新签名（favoriteMode/picker 回调）在 Task 3 定义、Task 6（folder）与 Task 8 消费一致 ✓
- `CollectionPicker` props `{isOpen, instrumentIDs, onClose}` 在 Task 2 定义、Task 3 消费 ✓
- `useCollectionsStore` actions 在 Task 1 定义，Task 2/3/5/6/7 消费一致 ✓
- `InstrumentSearchModal` 新 props（`onOpenFavoritePicker`/`onRemoveFromAllCollections`）Task 3 改、Task 3 测试更新 ✓
- `toast.warning` 未使用（Toast 仅 success/error）✓
