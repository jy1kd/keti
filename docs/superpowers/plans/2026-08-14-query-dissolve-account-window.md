# 查询窗口解散 + 资金独立窗口 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解散查询窗口（成交/资金/止损单），资金拆为独立窗口并从左上角原生菜单打开；成交/止损单随查询窗口下线，store 瘦身。

**Architecture:** 复用现有「浮动窗 + 原生菜单 open-floating IPC」范式（报单/持仓查询同款）：新增 `query-account` 标签类型与菜单项，`AccountQuery` 加 10s 自刷新成为资金窗口内容；删除 `query` 标签类型、5 处查询窗口入口、`QueryPanel`/`TradeFlow`/`StopOrderList` 组件及其测试；`store.ts` 移除只服务于已下线功能的字段与方法。

**Tech Stack:** React 18 + TypeScript 5 + Zustand + Vitest（前端）；Electron（原生菜单）。

## Global Constraints

- **`isPaused` store 字段必须保留**（值恒 `false`）：`modules/order/AccountBar.tsx`、`modules/order/MarketDepth.tsx`、`pages/InfiniteOrderPage.tsx` 读取它做轮询门控，移除会破坏它们。只删 `togglePause` action。
- **报单面板 `StopOrderForm`（创建止损单）保留**；只删查询窗口内 `StopOrderList`（列表展示）。
- **后端零改动**：`/api/query/*`、`/api/order/stop/*` 接口全部保留。
- **每个 Task 结束时 `git status` 干净、`npm test` 相关用例绿、代码可编译**（TS 严格模式，删除 `'query'` 标签类型时必须同步删完所有 `type: 'query'` 引用）。
- Commit 一次只针对一个功能点，禁攒大量改动一次性提交。

---

### Task 1: 新增资金查询窗口链路（标签类型 + 菜单 + IPC + helper）

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/utils/openFloatingTab.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/electron/menuTemplate.ts`
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/services/electron.ts`
- Test: `frontend/src/stores/tabs.test.ts`
- Test: `frontend/src/components/TabContent/index.test.tsx`
- Test: `frontend/src/utils/openFloatingTab.test.ts`
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `openAccountQueryFloating(): boolean`（`utils/openFloatingTab.ts`）；`TabType` 含 `'query-account'`；`FloatingTab` 含 `'query-account'`；原生菜单 id `func-query-account`，label `💰 资金查询窗口`；浮动窗 tab title `💰 资金查询`。此 Task 后 `'query'` 仍存在（后续 Task 删）。

- [ ] **Step 1: tabs.ts 新增 `query-account` 类型**

`frontend/src/stores/tabs.ts`：
- 在 `TabType` 联合类型中 `'query-positions' // 持仓查询（独立窗口）` 之后加一行：
```ts
  | 'query-account' // 资金查询（独立窗口）
```
- 在 `TAB_TYPES` 数组 `'query-positions',` 之后加一行：
```ts
  'query-account',
```

- [ ] **Step 2: TabContent 接入 AccountQuery**

`frontend/src/components/TabContent/index.tsx`：
- 顶部 import 区加：
```ts
import { AccountQuery } from '@/modules/query/AccountQuery'
```
- `renderTabContent` switch 中 `case 'query-positions':` 之后加：
```ts
    case 'query-account':
      return <AccountQuery />
```

- [ ] **Step 3: openFloatingTab.ts 新增 openAccountQueryFloating**

`frontend/src/utils/openFloatingTab.ts`，在 `openPositionsQueryFloating` 之后加：
```ts
/** 打开资金查询浮动窗 */
export function openAccountQueryFloating(): boolean {
  return openFloatingTab({ type: 'query-account', title: '💰 资金查询' })
}
```

- [ ] **Step 4: App.tsx 新增 IPC case**

`frontend/src/App.tsx`：
- import 区（`@/utils/openFloatingTab` 导入块）加 `openAccountQueryFloating,`。
- `onOpenFloatingTab` switch 中 `case 'query-positions':` 之后加：
```ts
        case 'query-account':
          openAccountQueryFloating()
          break
```

- [ ] **Step 5: Electron 菜单 + IPC 类型**

`frontend/electron/menuTemplate.ts`：
- `FloatingTab` 联合类型末尾加 `| 'query-account'`：
```ts
export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account';
```
- 「功能」子菜单 `func-query-positions` 之后加：
```ts
        { id: 'func-query-account', label: '💰 资金查询窗口', action: { type: 'open-floating', tab: 'query-account' } },
```

`frontend/electron/preload.ts` 两处（`onOpenFloatingTab` 类型声明 + 实现 handler）的 tab 联合类型末尾都加 `| 'query-account'`。

`frontend/src/services/electron.ts` 的 `onOpenFloatingTab` 回调类型末尾加 `| 'query-account'`。

- [ ] **Step 6: 更新相关测试**

`frontend/src/stores/tabs.test.ts`（`应定义所有标签页类型`）期望数组末尾加 `'query-account',`（`'query-positions'` 之后）。

`frontend/src/components/TabContent/index.test.tsx`：
- 把 `vi.mock('@/modules/query/QueryPanel', ...)` 块（12-15 行）替换为 AccountQuery mock：
```tsx
// Mock AccountQuery 组件（避免依赖复杂子组件）
vi.mock('@/modules/query/AccountQuery', () => ({
  AccountQuery: () => <div data-testid="account-query">资金查询 Mock</div>,
}))
```
- `标签类型渲染` 的 `it.each` 里 `['query', '查询面板 Mock'],` 替换为 `['query-account', '资金查询 Mock'],`。

`frontend/src/utils/openFloatingTab.test.ts`：
- import 里 `openQueryFloating` 改为 `openAccountQueryFloating`：
```ts
import { openOrderFloating, openKlineFloating, openAccountQueryFloating, openSettingsFloating, openIpcMonitorFloating } from './openFloatingTab';
```
- `openQueryFloating 打开查询浮动窗` 用例（16-22 行）替换为：
```ts
  it('openAccountQueryFloating 打开资金查询浮动窗', () => {
    openAccountQueryFloating();
    const tab = tabByType('query-account');
    expect(tab).toBeDefined();
    expect(tab!.title).toBe('💰 资金查询');
    expect(useFloatingWindowStore.getState().windows['tab-query-account']).toBeDefined();
  });
```
- 末尾「打开浮动窗后保持原活跃标签」用例（85-87 行）`openQueryFloating()` → `openAccountQueryFloating()`；`windows['tab-query']` → `windows['tab-query-account']`。

`frontend/electron/__tests__/menuTemplate.test.ts`（`功能子菜单包含...`）期望标签列表末尾加 `'💰 资金查询窗口'`：
```ts
expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 查询窗口', '📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口', '退出']);
```

`frontend/src/App.test.tsx`（`onOpenFloatingTab query 打开查询浮动窗` 用例，136-146 行）替换为：
```tsx
    it('onOpenFloatingTab query-account 打开资金查询浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('query-account')
      })
      expect(useFloatingWindowStore.getState().windows['tab-query-account']).toBeDefined()
      delete (window as any).electronAPI
    })
```

- [ ] **Step 7: 跑测试验证**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx src/utils/openFloatingTab.test.ts src/App.test.tsx`
Expected: 全绿。

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts`
Expected: 全绿。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/utils/openFloatingTab.ts frontend/src/App.tsx frontend/electron/menuTemplate.ts frontend/electron/preload.ts frontend/src/services/electron.ts
git add frontend/src/stores/tabs.test.ts frontend/src/components/TabContent/index.test.tsx frontend/src/utils/openFloatingTab.test.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/src/App.test.tsx
git commit -m "feat(query): 新增资金查询窗口标签类型/菜单入口/openAccountQueryFloating"
```

---

### Task 2: AccountQuery 10s 自刷新

**Files:**
- Modify: `frontend/src/modules/query/AccountQuery.tsx`
- Test: `frontend/src/modules/query/AccountQuery.test.tsx`

**Interfaces:**
- Consumes: `useQueryStore.fetchAccount`（保留字段，Task 5 才瘦身）。
- Produces: `AccountQuery` 挂载即拉取账户并每 10s 自刷新（防重入，对齐 `OrdersQuery`）。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/query/AccountQuery.test.tsx`：
- 顶部 import 加 `refreshAccount`：
```tsx
import { refreshAccount } from '../../services/api'
const mockRefreshAccount = vi.mocked(refreshAccount)
```
（现有 `vi.mock('../../services/api', ...)` 已含 `refreshAccount: vi.fn().mockResolvedValue(null)`，保留。）
- 新增用例：
```tsx
  it('挂载时自刷新拉取账户数据', async () => {
    const mockAccount = {
      accountID: 'test', balance: 100000, available: 50000, frozenMargin: 10000,
      currMargin: 40000, commission: 100, closeProfit: 500, positionProfit: 200,
      deposit: 0, withdraw: 0, preBalance: 99800, tradingDay: '20260727',
    }
    mockRefreshAccount.mockResolvedValue(mockAccount as never)
    useQueryStore.setState({ account: null })
    render(<AccountQuery />)
    expect(await screen.findByText('100000.00')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/modules/query/AccountQuery.test.tsx`
Expected: 新用例 FAIL（AccountQuery 未自刷新，渲染为空态「暂无资金数据」）。

- [ ] **Step 3: 实现自刷新**

`frontend/src/modules/query/AccountQuery.tsx`：
- 顶部加 `import { useEffect } from 'react'`。
- 组件内取 `fetchAccount`，并加 effect：
```tsx
export function AccountQuery() {
  const account = useQueryStore((s) => s.account)
  const fetchAccount = useQueryStore((s) => s.fetchAccount)

  // 10s 自刷新：完成后调度下一次，避免重入（对齐 OrdersQuery 节奏）
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = async () => {
      await fetchAccount()
      if (cancelled) return
      timer = setTimeout(schedule, 10000)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchAccount])
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/modules/query/AccountQuery.test.tsx`
Expected: 全绿（含既有空态/字段/数值用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/query/AccountQuery.tsx frontend/src/modules/query/AccountQuery.test.tsx
git commit -m "feat(query): 资金窗口 10s 自刷新账户数据"
```

---

### Task 3: 移除查询窗口 UI 入口（BottomBar / TabBar / 合约右键 / 托盘导航）

**Files:**
- Modify: `frontend/src/components/BottomBar/index.tsx`
- Modify: `frontend/src/components/TabBar/index.tsx`
- Modify: `frontend/src/hooks/useContractContextMenu.ts`
- Modify: `frontend/src/hooks/useContractMenus.tsx`
- Modify: `frontend/src/modules/market/MarketPanel.tsx`
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`
- Modify: `frontend/src/pages/FavoritesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/BottomBar/index.test.tsx`
- Test: `frontend/src/components/TabBar/index.test.tsx`
- Test: `frontend/src/hooks/useContractContextMenu.test.ts`

**Interfaces:**
- 此 Task 后 `'query'` 标签类型与 `openQueryFloating` 仍存在于代码中（无人引用），保证可编译；Task 4 才删类型与 helper。

- [ ] **Step 1: BottomBar 移除查询按钮**

`frontend/src/components/BottomBar/index.tsx`：
- import 块删 `openQueryFloating,`。
- 删 `openQuery` useCallback（41-43 行）。
- 删查询按钮 JSX（83-86 行）：
```tsx
        <button type="button" className="bottom-bar__tool" aria-label="📋 查询" title="查询" onClick={openQuery}>
          <span className="bottom-bar__tool-icon">📋</span>
          <span className="bottom-bar__tool-label">查询</span>
        </button>
```

- [ ] **Step 2: TabBar 移除查询项**

`frontend/src/components/TabBar/index.tsx`：`ADD_TAB_ITEMS` 删 `{ type: 'query' as const, icon: '📋', label: '查询', title: '📋 查询' },` 一行。

- [ ] **Step 3: 合约右键菜单移除查询**

`frontend/src/hooks/useContractContextMenu.ts`：
- 删 `openQueryPopup` useCallback（44-50 行，含注释）：
```ts
  // 打开查询浮动窗口（统一浮动窗模式；传入合约并选中，使查询面板合约/K线子页显示该合约）
  const openQueryPopup = useCallback((instrumentID: string) => {
    if (instrumentID) {
      useMarketStore.getState().setSelectedInstrument(instrumentID)
    }
    openFloatingTab({ type: 'query', title: '📋 查询' })
  }, [])
```
- 返回对象删 `openQueryPopup,`（124 行）。
- 若 `useMarketStore` import 在删 `openQueryPopup` 后无人使用（检查 `handleContextMenu` 第 97 行仍使用 `useMarketStore.getState().setSelectedInstrument`，**保留 import**）。

`frontend/src/hooks/useContractMenus.tsx`：
- `UseContractMenusArgs` interface 删 `openQueryPopup: (instrumentID: string) => void`（32 行）。
- 函数参数解构删 `openQueryPopup,`（60 行）。
- `singleMenu` items 删查询项（129 行）：
```ts
        { label: '查询', icon: '📋', onClick: () => openQueryPopup(contextMenu.instrumentID) },
```

`frontend/src/modules/market/MarketPanel.tsx`：从 `useContractContextMenu()` 解构删 `openQueryPopup,`。
`frontend/src/modules/options/OptionsPanel.tsx`：同上删 `openQueryPopup,`。
`frontend/src/pages/FavoritesPage.tsx`：
- 从 `useContractContextMenu()` 解构删 `openQueryPopup,`。
- 删内联右键菜单「📋 查询」按钮（105-109 行）：
```tsx
          <button
            className="context-menu__item"
            onClick={() => openQueryPopup(contextMenu.instrumentID)}
          >
            📋 查询
          </button>
```

- [ ] **Step 4: App.tsx 移除托盘导航 query case**

`frontend/src/App.tsx`：`onNavigateTab` switch 删：
```ts
        case 'query':
          openTab({ type: 'query', title: '📋 查询' })
          break
```
若 `openTab` 因此在该 effect 内不再使用，注意 `openTab` 是 `useTabStore` selector（32 行），其他 case 仍用（market/favorites/order/kline/settings/ipc-monitor），**保留**。

- [ ] **Step 5: 更新相关测试**

`frontend/src/components/BottomBar/index.test.tsx`：
- 模块 mock 删 `openQueryFloating: mockOpenQueryFloating,`（30 行）。
- 删用例 `点击 📋 查询按钮调用 openQueryFloating`（104-108 行附近）。

`frontend/src/components/TabBar/index.test.tsx`：
- `悬停 + 显示选择栏（报单/K线/查询/设置）` 用例：标题改 `悬停 + 显示选择栏（报单/K线/无限下单/设置）`；删 `expect(screen.getByText('📋 查询')).toBeInTheDocument()`（265 行）。

`frontend/src/hooks/useContractContextMenu.test.ts`：删 `openQueryPopup 打开查询浮动窗口（统一浮动窗模式）` 用例（47-54 行）。

- [ ] **Step 6: 跑测试验证**

Run: `cd frontend && npx vitest run src/components/BottomBar/index.test.tsx src/components/TabBar/index.test.tsx src/hooks/useContractContextMenu.test.ts`
Expected: 全绿。

Run: `cd frontend && npx vitest run src/App.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx src/pages/FavoritesPage.test.tsx`
Expected: 全绿（这些测试不引用查询项，确认无回归）。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/BottomBar/index.tsx frontend/src/components/TabBar/index.tsx frontend/src/hooks/useContractContextMenu.ts frontend/src/hooks/useContractMenus.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/options/OptionsPanel.tsx frontend/src/pages/FavoritesPage.tsx frontend/src/App.tsx
git add frontend/src/components/BottomBar/index.test.tsx frontend/src/components/TabBar/index.test.tsx frontend/src/hooks/useContractContextMenu.test.ts
git commit -m "refactor(query): 移除查询窗口 UI 入口（BottomBar/TabBar/合约右键/托盘导航）"
```

---

### Task 4: 移除 query 标签类型与剩余链路

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/utils/openFloatingTab.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/electron/menuTemplate.ts`
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/services/electron.ts`
- Test: `frontend/src/stores/tabs.test.ts`
- Test: `frontend/src/components/TabContent/index.test.tsx`
- Test: `frontend/src/utils/openFloatingTab.test.ts`
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`
- Test: `frontend/electron/__tests__/menuActions.test.ts`

**Interfaces:**
- 此 Task 是原子改动：TS 严格模式下删 `'query'` 类型必须同步删完所有 `type: 'query'` / `tab: 'query'` 引用（Task 3 已清空 UI 侧，本 Task 清链路侧）。完成后 `QueryPanel.tsx` 无任何 import（Task 5 删除）。

- [ ] **Step 1: tabs.ts 删除 query**

`frontend/src/stores/tabs.ts`：
- `TabType` 删 `| 'query' // 查询（全局账户查询）`。
- `TAB_TYPES` 删 `'query',`。

- [ ] **Step 2: TabContent 删除 query case 与 import**

`frontend/src/components/TabContent/index.tsx`：
- 删 `import { QueryPanel } from '@/modules/query/QueryPanel'`。
- 删 33 行注释中 `query 类型已集成 QueryPanel（全局账户查询）；` 一句。
- 删 switch：
```ts
    case 'query':
      return <QueryPanel />
```

- [ ] **Step 3: openFloatingTab.ts 删除 openQueryFloating**

`frontend/src/utils/openFloatingTab.ts`：删：
```ts
/** 打开查询浮动窗 */
export function openQueryFloating(): boolean {
  return openFloatingTab({ type: 'query', title: '📋 查询' })
}
```

- [ ] **Step 4: App.tsx 删除 open-floating query case**

`frontend/src/App.tsx`：
- import 块删 `openQueryFloating,`。
- `onOpenFloatingTab` switch 删：
```ts
        case 'query':
          openQueryFloating()
          break
```

- [ ] **Step 5: Electron 链路删除 query**

`frontend/electron/menuTemplate.ts`：
- `FloatingTab` 删 `'query' |`。
- 「功能」子菜单删 `func-query` 项：
```ts
        { id: 'func-query', label: '📋 查询窗口', action: { type: 'open-floating', tab: 'query' } },
```

`frontend/electron/preload.ts` 两处 tab 联合类型删 `'query' |`。
`frontend/src/services/electron.ts` `onOpenFloatingTab` 回调类型删 `'query' |`。

- [ ] **Step 6: 更新测试**

`frontend/src/stores/tabs.test.ts`：期望 TAB_TYPES 数组删 `'query',`。
`frontend/src/components/TabContent/index.test.tsx`：Task 1 已把 `['query', ...]` 换成 `['query-account', ...]`，无进一步改动（确认无残留 `'query'`）。
`frontend/src/utils/openFloatingTab.test.ts`：Task 1 已替换，无进一步改动。
`frontend/electron/__tests__/menuTemplate.test.ts`：功能子菜单期望列表删 `'📋 查询窗口'`：
```ts
expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口', '退出']);
```
`frontend/electron/__tests__/menuActions.test.ts`：`open-floating: show+focus 主窗并发送 menu:open-floating` 用例（35-37 行）`tab: 'query'` → `tab: 'query-account'`，期望发送参数同步为 `'query-account'`：
```ts
  it('open-floating: show+focus 主窗并发送 menu:open-floating', () => {
    resolveAction({ type: 'open-floating', tab: 'query-account' }, ctx);
    expect(ctx.mainWindow.show).toHaveBeenCalled();
    expect(ctx.mainWindow.focus).toHaveBeenCalled();
    expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query-account');
  });
```

- [ ] **Step 7: 全仓查残留 + 跑测试**

Run: `cd frontend && grep -rn "type: 'query'\|'query' |\|\"query\"\|tab: 'query'" src/ electron/ --include=*.ts --include=*.tsx`
Expected: 仅剩 `query-orders` / `query-positions` / `query-account` 匹配，无孤立 `'query'`。

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx src/utils/openFloatingTab.test.ts src/App.test.tsx`
Expected: 全绿。

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts`
Expected: 全绿。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/utils/openFloatingTab.ts frontend/src/App.tsx frontend/electron/menuTemplate.ts frontend/electron/preload.ts frontend/src/services/electron.ts
git add frontend/src/stores/tabs.test.ts frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuActions.test.ts
git commit -m "refactor(query): 移除 query 标签类型与查询窗口链路"
```

---

### Task 5: 删除下线组件 + store 瘦身

**Files:**
- Delete: `frontend/src/modules/query/QueryPanel.tsx`、`QueryPanel.test.tsx`、`TradeFlow.tsx`、`TradeFlow.test.tsx`、`StopOrderList.tsx`、`StopOrderList.test.tsx`
- Modify: `frontend/src/modules/query/store.ts`
- Test: `frontend/src/modules/query/store.test.ts`
- Modify: `frontend/src/components/TabContent/index.test.tsx`（删 QueryPanel mock，Task 1 已替换为 AccountQuery mock）
- Modify: `frontend/src/components/TabContent/detachFlow.repro.test.tsx`（删 QueryPanel mock）
- Modify: `frontend/src/components/TabContent/detachFlow.integration.test.tsx`（删 QueryPanel mock）

**Interfaces:**
- 消费方复核（均保留字段，无需改）：`OrdersQuery`/`OrderFlow` 用 `orders`/`newOrderRefs`/`handleCancelOrder`/`handleCancelAll`；`PositionsQuery`/`Position` 用 `positions`；`AccountQuery` 用 `account`/`fetchAccount`；`AccountBar`/`MarketDepth`/`InfiniteOrderPage` 读 `isPaused`。

- [ ] **Step 1: 写失败测试（store 瘦身红）**

先改 `frontend/src/modules/query/store.test.ts` 为瘦身后的版本（删除对已下线功能的测试），保留 `defaults to not paused` / `fetchOrders` ×2 / `fetchPositions` / `fetchAccount` / `handleCancelOrder` / `handleCancelAll` / `upsertOrder` ×2 / `clearNewOrderRef`。mock 删 `refreshTrades`、`getStopOrders`、`cancelStopOrder`。完整替换：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQueryStore } from './store'

// Mock API functions — store 使用 refresh* 函数（POST /refresh 触发 CTP 查询）
vi.mock('../../services/api', () => ({
  refreshOrders: vi.fn(),
  refreshPositions: vi.fn(),
  refreshAccount: vi.fn(),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
}))

import { refreshOrders, refreshPositions, refreshAccount, cancelOrder, cancelAllOrders } from '../../services/api'

const mockRefreshOrders = vi.mocked(refreshOrders)
const mockRefreshPositions = vi.mocked(refreshPositions)
const mockRefreshAccount = vi.mocked(refreshAccount)
const mockCancelOrder = vi.mocked(cancelOrder)
const mockCancelAllOrders = vi.mocked(cancelAllOrders)

describe('QueryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      orders: [],
      positions: [],
      account: null,
      isPaused: false,
      newOrderRefs: new Set(),
    })
  })

  // ── Pause ──────────────────────────────────────────────────────

  it('defaults to not paused', () => {
    expect(useQueryStore.getState().isPaused).toBe(false)
  })

  // ── Fetch Orders ───────────────────────────────────────────────

  it('fetchOrders populates orders from API', async () => {
    const mockOrders = [
      { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
    ]
    mockRefreshOrders.mockResolvedValue({ orders: mockOrders, count: 1 })

    await useQueryStore.getState().fetchOrders()

    expect(useQueryStore.getState().orders).toHaveLength(1)
    expect(useQueryStore.getState().orders[0].orderRef).toBe('1001')
  })

  it('fetchOrders handles API error gracefully', async () => {
    mockRefreshOrders.mockRejectedValue(new Error('network'))
    await useQueryStore.getState().fetchOrders()
    expect(useQueryStore.getState().orders).toEqual([])
  })

  // ── Fetch Positions ────────────────────────────────────────────

  it('fetchPositions populates positions from API', async () => {
    const mockPositions = [
      { instrumentID: 'IF2608', posiDirection: '2', position: 2, positionCost: 9600, positionProfit: 100, openCost: 9600, useMargin: 96000, todayPosition: 1, ydPosition: 1, tradingDay: '20260727' },
    ]
    mockRefreshPositions.mockResolvedValue({ positions: mockPositions, count: 1 })

    await useQueryStore.getState().fetchPositions()

    expect(useQueryStore.getState().positions).toHaveLength(1)
    expect(useQueryStore.getState().positions[0].posiDirection).toBe('2')
  })

  // ── Fetch Account ──────────────────────────────────────────────

  it('fetchAccount populates account from API', async () => {
    const mockAccount = {
      accountID: 'test', balance: 100000, available: 50000, frozenMargin: 10000,
      currMargin: 40000, commission: 100, closeProfit: 500, positionProfit: 200,
      deposit: 0, withdraw: 0, preBalance: 99800, tradingDay: '20260727',
    }
    mockRefreshAccount.mockResolvedValue(mockAccount)

    await useQueryStore.getState().fetchAccount()

    expect(useQueryStore.getState().account).not.toBeNull()
    expect(useQueryStore.getState().account?.balance).toBe(100000)
  })

  // ── Cancel Order ───────────────────────────────────────────────

  it('handleCancelOrder calls API and removes from orders', async () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })
    mockCancelOrder.mockResolvedValue({ success: true })

    const result = await useQueryStore.getState().handleCancelOrder('1001')

    expect(result).toBe(true)
    expect(mockCancelOrder).toHaveBeenCalledWith('1001')
    expect(useQueryStore.getState().orders[0].orderStatus).toBe('5')
  })

  // ── Cancel All Orders ──────────────────────────────────────────

  it('handleCancelAll calls cancelAllOrders API', async () => {
    mockCancelAllOrders.mockResolvedValue({ success: true, attempted: 3, succeeded: 3, failedRefs: [] })

    const result = await useQueryStore.getState().handleCancelAll()

    expect(result).toBe(true)
    expect(mockCancelAllOrders).toHaveBeenCalled()
  })

  // ── Incremental Order Update ───────────────────────────────────

  it('upsertOrder inserts new order at top', () => {
    const order = { orderRef: '1002', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:31:00' }
    useQueryStore.getState().upsertOrder(order)

    const state = useQueryStore.getState()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].orderRef).toBe('1002')
    expect(state.newOrderRefs.has('1002')).toBe(true)
  })

  it('upsertOrder updates existing order in place', () => {
    useQueryStore.setState({
      orders: [
        { orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '0', statusMsg: '', insertTime: '09:30:00' },
      ],
    })

    useQueryStore.getState().upsertOrder({
      orderRef: '1001', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0',
      limitPrice: 4800, volumeTotalOriginal: 1, volumeTraded: 1, orderStatus: '3', statusMsg: '全部成交', insertTime: '09:30:00',
    })

    const state = useQueryStore.getState()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].volumeTraded).toBe(1)
    expect(state.orders[0].orderStatus).toBe('3')
    expect(state.newOrderRefs.has('1001')).toBe(false)
  })

  // ── Clear New Highlights ───────────────────────────────────────

  it('clearNewOrderRef removes from highlight set', () => {
    useQueryStore.setState({ newOrderRefs: new Set(['1001', '1002']) })

    useQueryStore.getState().clearNewOrderRef('1001')

    expect(useQueryStore.getState().newOrderRefs.has('1001')).toBe(false)
    expect(useQueryStore.getState().newOrderRefs.has('1002')).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认红**

Run: `cd frontend && npx vitest run src/modules/query/store.test.ts`
Expected: FAIL（store 仍有旧字段，部分被删字段类型不匹配/编译错误）。

- [ ] **Step 3: store.ts 瘦身**

`frontend/src/modules/query/store.ts` 整体替换为（保留字段与逻辑不变，删除下线字段/方法）：

```ts
import { create } from 'zustand'
import {
  refreshOrders,
  refreshPositions,
  refreshAccount,
  cancelOrder,
  cancelAllOrders,
} from '../../services/api'
import type { AccountInfo } from '../../services/types'
import { toast } from '../../components/Toast'

// API 返回的原始类型（direction/offsetFlag/posiDirection 等为 CTP 字符串）
interface RawOrder {
  orderRef: string
  instrumentID: string
  direction: string
  combOffsetFlag: string
  limitPrice: number
  volumeTotalOriginal: number
  volumeTraded?: number
  orderStatus: string
  statusMsg?: string
  insertTime?: string
}

interface RawPosition {
  instrumentID: string
  posiDirection: string
  position: number
  positionCost: number
  positionProfit: number
  openCost: number
  useMargin: number
  todayPosition: number
  ydPosition: number
  tradingDay: string
}

// 前端使用类型（放宽约束，允许 CTP 原始字符串）
export type OrderEntry = RawOrder
export type PositionEntry = RawPosition

interface QueryStore {
  // Data
  orders: OrderEntry[]
  positions: PositionEntry[]
  account: AccountInfo | null

  // New order highlight tracking
  newOrderRefs: Set<string>
  clearNewOrderRef: (ref: string) => void

  // Control（轮询门控，报单面板读取；恒 false，无置位方）
  isPaused: boolean

  // Fetch methods
  fetchOrders: () => Promise<void>
  fetchPositions: () => Promise<void>
  fetchAccount: () => Promise<void>

  // Incremental update (from WebSocket)
  upsertOrder: (order: OrderEntry) => void

  // Actions
  handleCancelOrder: (orderRef: string) => Promise<boolean>
  handleCancelAll: () => Promise<boolean>
}

export const useQueryStore = create<QueryStore>((set, get) => ({
  // Data
  orders: [],
  positions: [],
  account: null,

  // Highlight tracking
  newOrderRefs: new Set<string>(),
  clearNewOrderRef: (ref) => {
    const next = new Set(get().newOrderRefs)
    next.delete(ref)
    set({ newOrderRefs: next })
  },

  // Control
  isPaused: false,

  // ── Fetch methods ──────────────────────────────────────────────

  fetchOrders: async () => {
    try {
      const res = await refreshOrders()
      if (res && typeof res === 'object' && 'orders' in res) {
        set({ orders: res.orders ?? [] })
      }
    } catch {
      // Silently fail
    }
  },

  fetchPositions: async () => {
    try {
      const res = await refreshPositions()
      if (res && typeof res === 'object' && 'positions' in res) {
        set({ positions: (res.positions ?? []) as unknown as RawPosition[] })
      }
    } catch {
      // Silently fail
    }
  },

  fetchAccount: async () => {
    try {
      const res = await refreshAccount()
      if (res && typeof res === 'object' && 'balance' in res) {
        set({ account: res })
      }
    } catch {
      // Silently fail
    }
  },

  // ── Incremental updates (from WebSocket) ───────────────────────

  upsertOrder: (order) => {
    const { orders, newOrderRefs } = get()
    const idx = orders.findIndex((o) => o.orderRef === order.orderRef)
    if (idx >= 0) {
      // Update existing — do NOT mark as new
      const next = [...orders]
      next[idx] = order
      set({ orders: next })
    } else {
      // Insert new at top — mark as new for highlight
      const nextNew = new Set(newOrderRefs)
      nextNew.add(order.orderRef)
      set({ orders: [order, ...orders], newOrderRefs: nextNew })
    }
  },

  // ── Actions ────────────────────────────────────────────────────

  handleCancelOrder: async (orderRef) => {
    try {
      const result = await cancelOrder(orderRef)
      if (result.success) {
        toast.success('撤单成功')
        // Optimistic: mark as canceled locally
        const orders = get().orders.map((o) =>
          o.orderRef === orderRef ? { ...o, orderStatus: '5' } : o
        )
        set({ orders })
        return true
      }
      toast.error(`撤单失败：${result.message || '未知错误'}`)
      return false
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`撤单失败：${message}`)
      return false
    }
  },

  handleCancelAll: async () => {
    try {
      const result = await cancelAllOrders()
      if (result.success) {
        toast.success(`已撤销 ${result.succeeded} 笔报单`)
        // Refresh to get updated status
        await get().fetchOrders()
        return true
      }
      toast.error('批量撤单失败')
      return false
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      toast.error(`批量撤单失败：${message}`)
      return false
    }
  },
}))
```

- [ ] **Step 4: 删除下线组件与测试**

Run（一次删一个，禁止批量）：
```bash
git rm frontend/src/modules/query/QueryPanel.tsx
git rm frontend/src/modules/query/QueryPanel.test.tsx
git rm frontend/src/modules/query/TradeFlow.tsx
git rm frontend/src/modules/query/TradeFlow.test.tsx
git rm frontend/src/modules/query/StopOrderList.tsx
git rm frontend/src/modules/query/StopOrderList.test.tsx
```

- [ ] **Step 5: 删除测试中 QueryPanel mock**

`frontend/src/components/TabContent/index.test.tsx`：删 QueryPanel mock 块（Task 1 已替换为 AccountQuery mock，确认无 `vi.mock('@/modules/query/QueryPanel'` 残留）。
`frontend/src/components/TabContent/detachFlow.repro.test.tsx`：删 18-19 行 QueryPanel mock。
`frontend/src/components/TabContent/detachFlow.integration.test.tsx`：删 13-14 行 QueryPanel mock。

- [ ] **Step 6: 跑测试验证**

Run: `cd frontend && npx vitest run src/modules/query/store.test.ts src/modules/query/OrdersQuery.test.tsx src/modules/query/PositionsQuery.test.tsx src/modules/query/Position.test.tsx src/modules/query/OrderFlow.test.tsx src/modules/query/AccountQuery.test.tsx`
Expected: 全绿。

Run: `cd frontend && npx vitest run src/components/TabContent/index.test.tsx src/components/TabContent/detachFlow.repro.test.tsx src/components/TabContent/detachFlow.integration.test.tsx`
Expected: 全绿。

Run: `cd frontend && npx vitest run src/modules/order/AccountBar.test.tsx src/pages/InfiniteOrderPage.test.tsx src/modules/order/MarketDepth.test.tsx`
Expected: 全绿（isPaused 保留，回归通过）。

- [ ] **Step 7: 全仓查残留**

Run: `cd frontend && grep -rn "QueryPanel\|TradeFlow\|StopOrderList\|refreshAll\|fetchTrades\|fetchStopOrders\|togglePause\|stopOrders\|upsertTrade" src/ --include=*.ts --include=*.tsx`
Expected: 无匹配（`OrderFlow` 是子串，用 `grep -w` 或单独核对，允许 `OrderFlow`/`Position` 命中，不允许 `QueryPanel`/`TradeFlow`/`StopOrderList`）。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/query/store.ts frontend/src/modules/query/store.test.ts
git add frontend/src/components/TabContent/index.test.tsx frontend/src/components/TabContent/detachFlow.repro.test.tsx frontend/src/components/TabContent/detachFlow.integration.test.tsx
git commit -m "refactor(query): 下线成交/止损单，store 瘦身"
```

---

### Task 6: 全量回归 + 重新构建 dist-electron

**Files:**
- Modify: `frontend/dist-electron/main.cjs`、`frontend/dist-electron/preload.cjs`（由编译生成）

**Interfaces:**
- 菜单模板/预加载类型改动需反映到 Electron 构建产物（沿用 `d517579` 先例提交 dist-electron）。

- [ ] **Step 1: 前端全量测试**

Run: `cd frontend && npm test`
Expected: 全绿（469+ 用例，含 Electron 目录测试）。

- [ ] **Step 2: 类型检查 + 前端构建**

Run: `cd frontend && npm run build`
Expected: `tsc` 无类型错误 + vite build 成功。

- [ ] **Step 3: 重新编译 dist-electron**

Run: `cd frontend && npm run electron:compile`
Expected: 重新生成 `dist-electron/main.cjs`、`dist-electron/preload.cjs`（含菜单模板：无「📋 查询窗口」，有「💰 资金查询窗口」；preload 类型含 `query-account`）。

- [ ] **Step 4: 核对产物菜单**

Run: `grep -n "资金查询窗口\|查询窗口" dist-electron/main.cjs`
Expected: 命中 `💰 资金查询窗口`，不命中 `📋 查询窗口`（注意区分 `报单查询窗口`/`持仓查询窗口` 子串）。

- [ ] **Step 5: Commit 构建产物**

```bash
git add frontend/dist-electron/main.cjs frontend/dist-electron/preload.cjs
git commit -m "chore(electron): 更新构建产物以匹配资金查询窗口菜单入口"
```

- [ ] **Step 6: 更新文档（可选，一致性检查口径）**

若 `docs/specs/dev.md` / `docs/specs/design.md` 提及「查询窗口含成交/资金/止损单」的表述，同步改为「资金查询窗口（独立）」。仅当 grep 到相关表述时改，禁止无关改。

---

## Self-Review

**1. Spec 覆盖：**
- 资金窗口新增（标签类型/菜单/IPC/helper/自刷新）→ Task 1、2。
- 查询窗口 5 入口移除（原生菜单/托盘导航/BottomBar/TabBar/右键菜单）→ Task 3、4（菜单 func-query 在 Task 4）。
- 成交/止损单下线 + store 瘦身 + 保留 `isPaused`/`StopOrderForm`/后端 → Task 5 + Global Constraints。
- 测试/构建产物 → Task 6。

**2. 占位符扫描：** 所有改动含精确代码，无 TBD/TODO。

**3. 类型一致性：**
- `openAccountQueryFloating()` 在 Task 1 定义、Task 1 App case 使用，命名一致。
- `query-account` 在 tabs/TabContent/openFloatingTab/menuTemplate/preload/electron.ts 统一。
- store 瘦身后保留字段与 Task 5 测试一致（`orders`/`positions`/`account`/`isPaused`/`newOrderRefs`/`clearNewOrderRef`/`fetchOrders`/`fetchPositions`/`fetchAccount`/`upsertOrder`/`handleCancelOrder`/`handleCancelAll`）。
- `AccountQuery.test.tsx` 中 `vi.mocked(refreshAccount)` 的 mock 工厂已在现有文件定义（返回 `null` 的默认值），per-test 覆盖为 mockAccount。
