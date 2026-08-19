### Task 7: 订阅去 favorites + contracts 清理 + 启动 loadCollections + 删 FavoritesPage

**Files:**
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`
- Modify: `frontend/src/stores/contracts.ts`
- Modify: `frontend/src/App.tsx`（启动 `loadCollections()`）
- Delete: `frontend/src/pages/FavoritesPage.tsx`、`frontend/src/pages/FavoritesPage.test.tsx`、`frontend/src/pages/FavoritesPage.css`
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`（更新）、`frontend/src/stores/contracts.test.ts`（更新）、`frontend/src/App.test.tsx`（更新）

**Interfaces:**
- Consumes: `useCollectionsStore.loadCollections`（Task 1）
- Produces: `useSubscriptionManager.calculateShouldSubscribe` = 可见区 ∪ 锁定（无 favorites）；`useContractsStore` 只剩 `contracts/isLoaded/setContracts/loadAllInstruments`

- [ ] **Step 1: 改 `useSubscriptionManager.ts` 去 favorites**

```ts
// 删除：const favorites = useContractsStore((s) => s.favorites)
// calculateShouldSubscribe 改为：
const calculateShouldSubscribe = useCallback((): Set<string> => {
  const shouldSubscribe = new Set<string>()
  for (const id of visibleInstrumentIDs) shouldSubscribe.add(id)
  for (const id of lockedContracts.keys()) shouldSubscribe.add(id)
  return shouldSubscribe
}, [visibleInstrumentIDs, lockedContracts])
```

若 `useContractsStore` 在本文件仅用于 favorites，删除该 import；否则保留。

- [ ] **Step 2: 更新 `useSubscriptionManager.test.ts`**

- 移除所有播种 `favorites` 后断言「自选自动订阅」的用例（改为断言收藏不再自动订阅：`favorites` 不在 should → 不订阅）
- 保留 可见区/锁定/宽限期/LRU/批次上限 用例（原断言不受影响，仅删除 favorites 相关部分）

- [ ] **Step 3: 改 `stores/contracts.ts` 清理 favorites + userPrefs 移除废弃字段**

- 删除 `contracts.ts`：`favorites` 字段、`loadFavoriteContracts`、`addToFavorites`、`removeFromFavorites`、`getInstrumentsByIds`/`useUserPrefsStore` import。保留 `contracts/isLoaded/setContracts/loadAllInstruments`
- 删除 `userPrefs.ts`（Task 1 保留的废弃字段）：`selectedContracts`、`addSelectedContract`、`removeSelectedContract` 及其在 `saveToLocalStorage`/`loadFromLocalStorage`/interface 中的引用（`saveToLocalStorage` 不再持久化它；`loadFromLocalStorage` 仍读旧数据做迁移——`const legacy = Array.isArray(data.selectedContracts) ...` 逻辑保留）

- [ ] **Step 4: 更新 `contracts.test.ts` + `userPrefs.test.ts`**

- `contracts.test.ts`：`beforeEach` setState 去掉 `favorites`；删除 `loadFavoriteContracts`/`addToFavorites`/`removeFromFavorites` 相关用例（`collections.test.ts` 已覆盖等价能力）；`vi.mock('@/services/api')` 保留 `getInstruments`（loadAllInstruments 用），多余 mock 可留
- `userPrefs.test.ts`：删除四个 `selectedContracts` 测试（`addSelectedContract 添加自选合约`、`addSelectedContract 重复添加不会产生重复项`、`removeSelectedContract 移除自选合约`、`saveToLocalStorage 持久化`/`loadFromLocalStorage` 中的 `selectedContracts` 断言）；`beforeEach` 去掉 `selectedContracts` 字段

- [ ] **Step 5: 改 `App.tsx` 启动加载**

- import 加 `useCollectionsStore`；启动 effect 里 `useContractsStore.getState().loadFavoriteContracts()` → `useCollectionsStore.getState().loadCollections()`

- [ ] **Step 6: 更新 `App.test.tsx`**

- `loadFavSpy` 改为 `vi.spyOn(useCollectionsStore.getState(), 'loadCollections').mockResolvedValue(undefined)`

- [ ] **Step 7: 全量回归（本任务中途红，Task 8 收口前先局部跑）**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts src/stores/contracts.test.ts src/stores/userPrefs.test.ts src/App.test.tsx`
Expected: PASS（若其它文件引用 `contracts.favorites` 报错，是遗漏的消费点——grep `\.favorites|addToFavorites|removeFromFavorites|loadFavoriteContracts|selectedContracts` 全仓库修复）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts frontend/src/stores/contracts.ts frontend/src/stores/contracts.test.ts frontend/src/stores/userPrefs.ts frontend/src/stores/userPrefs.test.ts frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "refactor(collections): 订阅去 favorites + contracts/userPrefs 清理废弃收藏字段 + 启动 loadCollections

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

