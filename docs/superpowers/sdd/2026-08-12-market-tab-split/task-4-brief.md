### Task 4: 共享行情基础设施上移到 App

**Files:**
- Modify: `frontend/src/App.tsx`（挂载 `useMarketWs` + `useSubscriptionManager` + 合约/收藏加载）
- Modify: `frontend/src/modules/market/MarketPanel.tsx`（移除 `useMarketWs`、`useSubscriptionManager`、加载 effect、`API_BASE` import）
- Test: `frontend/src/App.test.tsx`、`frontend/src/modules/market/MarketPanel.test.tsx`

**Interfaces:**
- Consumes: `useMarketWs`, `useSubscriptionManager`, `useContractsStore.loadAllInstruments/loadFavoriteContracts`。
- Produces: 行情 WS 与订阅管理器为全局单例，挂在 `App`；两面板（期货/期权）共享 `visibleInstrumentIDs`。Task 5/6 的面板不再自行挂这些 hook。

> 目的：期货/期权两个面板都依赖同一份订阅生命周期与 WS 单例。`useSubscriptionManager` 内部 `subscribedRef` 是组件私有，若在两个面板各挂一份会双份 diff 冲突，故必须单例。`useMarketWs` 虽有 `globalWs` 幂等，但订阅管理器不能双份，统一上移。

- [ ] **Step 1: 写失败测试**

`frontend/src/App.test.tsx` 追加（mock `useMarketWs`/`useSubscriptionManager` 后断言被调用一次）：

```tsx
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'

vi.mock('@/hooks/useMarketWs', () => ({ useMarketWs: vi.fn() }))
vi.mock('@/hooks/useSubscriptionManager', () => ({ useSubscriptionManager: vi.fn() }))

it('App 挂载共享行情 WS 与订阅管理器各一次', () => {
  render(<App />)
  expect(useMarketWs).toHaveBeenCalledTimes(1)
  expect(useSubscriptionManager).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL（`useMarketWs`/`useSubscriptionManager` 未被 App 调用）

- [ ] **Step 3: 上移基础设施**

在 `frontend/src/App.tsx` 顶部 import 并在组件内（`useSystemWs` 附近）加：

```ts
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'

// 在 App() 内：
useMarketWs(API_BASE.replace('http', 'ws'))
useSubscriptionManager()

// 启动时加载全量合约 + 收藏合约（原先在 MarketPanel，现上移共享）
useEffect(() => {
  useContractsStore.getState().loadAllInstruments()
  useContractsStore.getState().loadFavoriteContracts()
}, [])
```

从 `frontend/src/modules/market/MarketPanel.tsx` 删除：`useMarketWs(...)`（:74）、`useSubscriptionManager()`（:36）、启动加载 effect（:77-83）、`loadedRef`（:33 及其引用）、`useContractsStore.loadAllInstruments/loadFavoriteContracts` 解构、`import { API_BASE }`（:18）。保留 `useMarketStore`、`useContractsStore` 的 `contracts/favorites/addToFavorites/removeFromFavorites`（收藏按钮与表格仍用）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/App.test.tsx src/modules/market/MarketPanel.test.tsx`
Expected: PASS（MarketPanel 测试更新掉对加载 effect 的断言，其余绿）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx
git commit -m "refactor(market): 共享行情 WS/订阅管理器/合约加载上移到 App，支持双面板单例"
```

---

