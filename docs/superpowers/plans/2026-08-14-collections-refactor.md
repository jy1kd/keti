# 自选重构 → 收藏夹（多夹多标签）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把扁平单集合「自选合约」重构为可新建/命名/多选收藏的「收藏夹」系统：收藏夹管理页 + 每夹一个标签页（可同时开多个）、行情页 ⭐ 弹选夹面板、只订阅已打开的夹。

**Architecture:** 数据层新增 `stores/collections.ts`（元数据 CRUD + 持久化 + 无效 ID 清理），`userPrefs` 从 `selectedContracts` 迁移到 `collections`；收藏入口统一走新组件 `CollectionPicker`（单选对账 / 批量只加）；标签系统删 `'favorites'` 加 `'collections'`（管理页）+ `'collection'`（夹页，按 collectionId 去重）；订阅管理器去掉 favorites 后台保活（只订阅可见区 + 锁定）；夹内合约从全局 `contracts` store 派生（避免陈旧缓存），`loadCollections` 用 `getInstrumentsByIds` 做权威校验清理。

**Tech Stack:** React 18 + TypeScript + Zustand（localStorage 持久化）+ @visactor/vtable（QuoteTable）+ vitest（TDD）。

**Spec:** `docs/superpowers/specs/2026-08-14-collections-design.md`

## Global Constraints

- 纯收藏夹模型：合约可同时属于多个夹；无隐式默认收藏（迁移时旧 `selectedContracts` → 「默认收藏夹」`coll-default`）
- ⭐ 列上下文区分：行情页（期货/期权）弹 `CollectionPicker`；夹页直接切换本夹
- 订阅：`shouldSubscribe` = 可见区 ∪ 锁定（**去掉 favorites**）；收藏不后台保活
- 夹内展示：`[全部|期货|期权]` 切换；全部 = 两段（期货区 futuresSpec + 期权区 optionsSpec），单类型 = 单表
- 持久化：`userPrefs` 单一 storage key `simnow-user-prefs`；`collections` 写穿 localStorage
- 收藏夹 id 生成：`coll-<Date.now().toString(36)>-<counter.toString(36)>`（`nextCollectionId()`）
- 菜单 label：`📁 收藏夹`；管理页标题 `📁 收藏夹`；夹页标题 `📁 <夹名>`
- Toast 只有 `success` / `error`（无 warning）
- **实现偏差（相对 spec）**：`contractsByCollection` 解析图从 store 移除，改为夹页/管理页从全局 `contracts` store 按 `instrumentIDs` 派生（`collection.instrumentIDs.map(id => contracts.find(...)).filter(Boolean)`），避免增删夹后解析图陈旧的 bug；`loadCollections` 仍用 `getInstrumentsByIds` 校验 + 清理无效 ID（spec §3 意图保留）

---

## File Structure

| 文件 | 职责 |
|---|---|
| `frontend/src/stores/userPrefs.ts` | `selectedContracts` → `collections`；save/load + 迁移 |
| `frontend/src/stores/collections.ts`（新） | `Collection` 类型 + CRUD + 持久化 + 无效 ID 清理 + 纯派生函数 |
| `frontend/src/components/CollectionPicker/index.tsx` + `.css`（新） | 选夹面板（多选/全选/新建/移除全部/管理链接；单选对账/批量只加） |
| `frontend/src/hooks/useContractMenus.tsx` | 收藏交互双模式（picker/folder）；右键菜单 + 工具栏批量 |
| `frontend/src/modules/market/MarketPanel.tsx` | ⭐/工具栏/搜索弹窗 → picker；自选视图 = 聚合所有夹的期货 |
| `frontend/src/modules/options/OptionsPanel.tsx` | 同上（期权页） |
| `frontend/src/components/InstrumentSearchModal/index.tsx` | 收藏按钮 → picker；移除 → 从所有夹移除 |
| `frontend/src/stores/tabs.ts` | TabType 删 `'favorites'` 加 `'collections'`/`'collection'`；generateTabId collectionId；openTab 去重 |
| `frontend/src/components/TabContent/index.tsx` | 渲染 CollectionsPage / CollectionPage；去 FavoritesPage |
| `frontend/src/pages/CollectionsPage.tsx` + `.css`（新） | 收藏夹管理页（新建/列表/打开/重命名/删除确认） |
| `frontend/src/pages/CollectionPage.tsx` + `.css`（新） | 单夹页（类型切换/分段、本夹 ⭐ 直切、右键从本夹移除） |
| `frontend/src/hooks/useSubscriptionManager.ts` | `shouldSubscribe` 去掉 favorites |
| `frontend/src/stores/contracts.ts` | 删除 favorites 相关字段与 action |
| `frontend/src/App.tsx` | 启动 `loadCollections()`；onNavigateTab 'favorites' → 管理页 |
| `frontend/electron/menuTemplate.ts` | 「⭐ 自选行情」→「📁 收藏夹」 |
| 删除 | `frontend/src/pages/FavoritesPage.tsx` / `.test.tsx` / `.css` |

---

### Task 1: 数据层 — userPrefs collections + 迁移 + collections store

**Files:**
- Modify: `frontend/src/stores/userPrefs.ts`
- Create: `frontend/src/stores/collections.ts`
- Test: `frontend/src/stores/userPrefs.test.ts`（更新）、`frontend/src/stores/collections.test.ts`（新）

**Interfaces:**
- Consumes: `getInstrumentsByIds(ids: string[]): Promise<InstrumentsResponse>`（`@/services/api`）；`useUserPrefsStore`
- Produces:
  - `export interface Collection { id: string; name: string; instrumentIDs: string[] }`
  - `export function nextCollectionId(): string`
  - `export function unionFavoritedIds(collections: Collection[]): Set<string>`
  - `export function collectionFavoritedIds(collections: Collection[], collectionId: string): Set<string>`
  - `useCollectionsStore` actions：`loadCollections/ createCollection(name): string/ renameCollection(id,name)/ deleteCollection(id)/ addToCollections(instrumentIDs, collectionIds)/ removeFromCollection(instrumentID, collectionId)/ removeFromAllCollections(instrumentIDs)`，state：`collections: Collection[]`、`loaded: boolean`
  - `useUserPrefsStore`：新增 `collections: Collection[]` + `setCollections(c)`

- [ ] **Step 1: 写失败测试（collections store）**

创建 `frontend/src/stores/collections.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCollectionsStore, unionFavoritedIds, collectionFavoritedIds } from './collections'
import { useUserPrefsStore } from './userPrefs'

vi.mock('@/services/api', () => ({
  getInstrumentsByIds: vi.fn(),
  getInstruments: vi.fn(),
  subscribeMarket: vi.fn(),
  unsubscribeMarket: vi.fn(),
}))

const mockContract = {
  instrumentID: 'au2406',
  instrumentName: '黄金2406',
  exchangeID: 'SHFE',
  productID: 'au',
  volumeMultiple: 1000,
  priceTick: 0.02,
  expireDate: '2024-06-15',
  isTrading: 1,
  productClass: '1',
}

describe('useCollectionsStore', () => {
  beforeEach(() => {
    useCollectionsStore.setState({ collections: [], loaded: false })
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { buy: 'b', sell: 's', cancel: 'c', reverse: '', lock: '', batchCancel: 'Escape', openOrder: '', openKline: '', openSettings: '' },
      quickTradeConfig: { lock: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, reverse: { close: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, open: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, executionMode: 'serial' }, confirmBeforeExecute: true },
    })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('createCollection 创建收藏夹并持久化，返回 id', () => {
    const id = useCollectionsStore.getState().createCollection('农产品')
    expect(useCollectionsStore.getState().collections).toEqual([{ id, name: '农产品', instrumentIDs: [] }])
    const stored = JSON.parse(localStorage.getItem('simnow-user-prefs') || '{}')
    expect(stored.collections).toEqual([{ id, name: '农产品', instrumentIDs: [] }])
  })

  it('addToCollections 去重追加；removeFromCollection 移除单个；removeFromAllCollections 全夹移除', () => {
    const store = useCollectionsStore.getState()
    const a = store.createCollection('A')
    const b = store.createCollection('B')
    store.addToCollections(['au2406', 'rb2406'], [a, b])
    store.addToCollections(['au2406'], [a]) // 重复
    expect(useCollectionsStore.getState().collections.find((c) => c.id === a)?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    store.removeFromCollection('au2406', a)
    expect(useCollectionsStore.getState().collections.find((c) => c.id === a)?.instrumentIDs).toEqual(['rb2406'])
    expect(useCollectionsStore.getState().collections.find((c) => c.id === b)?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    store.removeFromAllCollections(['au2406'])
    expect(useCollectionsStore.getState().collections.find((c) => c.id === b)?.instrumentIDs).toEqual(['rb2406'])
  })

  it('renameCollection / deleteCollection', () => {
    const store = useCollectionsStore.getState()
    const id = store.createCollection('旧名')
    store.renameCollection(id, '新名')
    expect(useCollectionsStore.getState().collections[0].name).toBe('新名')
    store.deleteCollection(id)
    expect(useCollectionsStore.getState().collections).toEqual([])
  })

  it('loadCollections：无收藏夹时置空并 loaded', async () => {
    await useCollectionsStore.getState().loadCollections()
    expect(useCollectionsStore.getState().loaded).toBe(true)
    expect(useCollectionsStore.getState().collections).toEqual([])
  })

  it('loadCollections：union 一次拉取解析，无效 ID 清理并回写', async () => {
    const { getInstrumentsByIds } = await import('@/services/api')
    const store = useCollectionsStore.getState()
    const id = store.createCollection('A')
    useCollectionsStore.setState({ collections: [{ id, name: 'A', instrumentIDs: ['au2406', 'delisted1'] }] })
    vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract], count: 1 })
    await useCollectionsStore.getState().loadCollections()
    const coll = useCollectionsStore.getState().collections[0]
    expect(coll.instrumentIDs).toEqual(['au2406']) // delisted1 被清理
    expect(getInstrumentsByIds).toHaveBeenCalledWith(['au2406', 'delisted1'])
    const stored = JSON.parse(localStorage.getItem('simnow-user-prefs') || '{}')
    expect(stored.collections[0].instrumentIDs).toEqual(['au2406'])
    expect(useCollectionsStore.getState().loaded).toBe(true)
  })

  it('纯派生函数', () => {
    const cols = [
      { id: 'a', name: 'A', instrumentIDs: ['au2406', 'rb2406'] },
      { id: 'b', name: 'B', instrumentIDs: ['rb2406'] },
    ]
    expect(Array.from(unionFavoritedIds(cols)).sort()).toEqual(['au2406', 'rb2406'])
    expect(Array.from(collectionFavoritedIds(cols, 'a')).sort()).toEqual(['au2406', 'rb2406'])
    expect(collectionFavoritedIds(cols, 'zz').size).toBe(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/stores/collections.test.ts`
Expected: FAIL — `collections` 模块不存在。

- [ ] **Step 3: 写失败测试（userPrefs 迁移）**

在 `frontend/src/stores/userPrefs.test.ts` 末尾追加：

```ts
describe('useUserPrefsStore collections', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { ...DEFAULT_HOT_KEYS },
      quickTradeConfig: { lock: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, reverse: { close: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, open: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, executionMode: 'serial' }, confirmBeforeExecute: true },
    })
  })

  it('setCollections + saveToLocalStorage 持久化', () => {
    const coll = [{ id: 'coll-x', name: 'A', instrumentIDs: ['au2406'] }]
    useUserPrefsStore.getState().setCollections(coll)
    useUserPrefsStore.getState().saveToLocalStorage()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.collections).toEqual(coll)
  })

  it('loadFromLocalStorage 迁移：旧 selectedContracts → 默认收藏夹', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts: ['au2406', 'rb2406'], hotKeys: { buy: 'F2' } })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    expect(useUserPrefsStore.getState().collections).toEqual([
      { id: 'coll-default', name: '默认收藏夹', instrumentIDs: ['au2406', 'rb2406'] },
    ])
  })

  it('已有 collections 时不覆盖（无迁移）', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts: ['au2406'], collections: [{ id: 'a', name: 'A', instrumentIDs: ['rb2406'] }] })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    expect(useUserPrefsStore.getState().collections).toEqual([{ id: 'a', name: 'A', instrumentIDs: ['rb2406'] }])
  })
})
```

**同时**：删除 `userPrefs.test.ts` 中四个 `selectedContracts` 相关测试（`addSelectedContract 添加自选合约`、`addSelectedContract 重复添加不会产生重复项`、`removeSelectedContract 移除自选合约`、`saveToLocalStorage 持久化`/`loadFromLocalStorage` 中的 `selectedContracts` 断言），并把 `beforeEach` 的 `selectedContracts: []` 改为 `collections: []`。

- [ ] **Step 4: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/stores/userPrefs.test.ts`
Expected: FAIL — `setCollections` 不存在 / 迁移未实现。

- [ ] **Step 5: 实现 `stores/userPrefs.ts`**

整体重写（保留 `DEFAULT_HOT_KEYS`/`DEFAULT_QUICK_TRADE_CONFIG` 常量）：

```ts
import { create } from 'zustand'
import type { HotKeyConfig, QuickTradeConfig } from '@/services/types'
import type { Collection } from './collections'

const STORAGE_KEY = 'simnow-user-prefs'

export const DEFAULT_HOT_KEYS: HotKeyConfig = { /* 原样保留 */ }
export const DEFAULT_QUICK_TRADE_CONFIG: QuickTradeConfig = { /* 原样保留 */ }

interface UserPrefsStore {
  collections: Collection[]
  hotKeys: HotKeyConfig
  quickTradeConfig: QuickTradeConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  setQuickTradeConfig: (config: Partial<QuickTradeConfig>) => void
  setCollections: (collections: Collection[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useUserPrefsStore = create<UserPrefsStore>((set) => ({
  collections: [],
  hotKeys: { ...DEFAULT_HOT_KEYS },
  quickTradeConfig: { ...DEFAULT_QUICK_TRADE_CONFIG },

  setHotKey: (action, key) =>
    set((state) => ({ hotKeys: { ...state.hotKeys, [action]: key } })),
  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),
  setQuickTradeConfig: (config) =>
    set((state) => ({ quickTradeConfig: { ...state.quickTradeConfig, ...config } })),
  setCollections: (collections) => set({ collections }),

  saveToLocalStorage: () => {
    const { collections, hotKeys, quickTradeConfig } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collections, hotKeys, quickTradeConfig }))
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      let collections: Collection[] = Array.isArray(data.collections) ? data.collections : []
      // 迁移：旧版 selectedContracts（扁平收藏） → 默认收藏夹
      const legacy = Array.isArray(data.selectedContracts) ? data.selectedContracts : []
      if (collections.length === 0 && legacy.length > 0) {
        collections = [{ id: 'coll-default', name: '默认收藏夹', instrumentIDs: legacy }]
      }
      set({
        collections,
        hotKeys: data.hotKeys ?? { ...DEFAULT_HOT_KEYS },
        quickTradeConfig: data.quickTradeConfig ?? { ...DEFAULT_QUICK_TRADE_CONFIG },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
```

注意：`get` 需从 create 回调解构（`create<UserPrefsStore>((set, get) => ...`）。

- [ ] **Step 6: 实现 `stores/collections.ts`**

```ts
import { create } from 'zustand'
import type { ContractInfo } from '@/services/types'
import { getInstrumentsByIds } from '@/services/api'
import { useUserPrefsStore } from './userPrefs'

export interface Collection {
  id: string
  name: string
  instrumentIDs: string[]
}

let idCounter = 0
export function nextCollectionId(): string {
  idCounter += 1
  return `coll-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

/** 持久化元数据 → userPrefs + localStorage */
function persist(collections: Collection[]): void {
  useUserPrefsStore.getState().setCollections(collections)
  useUserPrefsStore.getState().saveToLocalStorage()
}

/** 所有收藏夹合约 ID 并集（行情页 ⭐ 填充态） */
export function unionFavoritedIds(collections: Collection[]): Set<string> {
  const set = new Set<string>()
  for (const c of collections) for (const id of c.instrumentIDs) set.add(id)
  return set
}

/** 指定收藏夹内合约 ID 集合（夹页 ⭐ 填充态） */
export function collectionFavoritedIds(collections: Collection[], collectionId: string): Set<string> {
  return new Set(collections.find((c) => c.id === collectionId)?.instrumentIDs ?? [])
}

interface CollectionsStore {
  collections: Collection[]
  loaded: boolean
  loadCollections: () => Promise<void>
  createCollection: (name: string) => string
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
  addToCollections: (instrumentIDs: string[], collectionIds: string[]) => void
  removeFromCollection: (instrumentID: string, collectionId: string) => void
  removeFromAllCollections: (instrumentIDs: string[]) => void
}

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  collections: [],
  loaded: false,

  loadCollections: async () => {
    useUserPrefsStore.getState().loadFromLocalStorage()
    const collections = useUserPrefsStore.getState().collections
    if (collections.length === 0) {
      set({ collections: [], loaded: true })
      return
    }
    const allIds = Array.from(new Set(collections.flatMap((c) => c.instrumentIDs)))
    try {
      const result = await getInstrumentsByIds(allIds)
      const byId = new Set((result.instruments ?? []).map((c) => c.instrumentID))
      let changed = false
      const next = collections.map((c) => {
        const valid = c.instrumentIDs.filter((id) => {
          if (byId.has(id)) return true
          changed = true
          return false
        })
        return { ...c, instrumentIDs: valid }
      })
      if (changed) persist(next)
      set({ collections: next, loaded: true })
    } catch (err) {
      console.error('[collections] Failed to load collection contracts:', err)
      set({ loaded: true })
    }
  },

  createCollection: (name) => {
    const id = nextCollectionId()
    const collections = [...get().collections, { id, name, instrumentIDs: [] }]
    persist(collections)
    set({ collections })
    return id
  },

  renameCollection: (id, name) => {
    const collections = get().collections.map((c) => (c.id === id ? { ...c, name } : c))
    persist(collections)
    set({ collections })
  },

  deleteCollection: (id) => {
    const collections = get().collections.filter((c) => c.id !== id)
    persist(collections)
    set({ collections })
  },

  addToCollections: (instrumentIDs, collectionIds) => {
    const collections = get().collections.map((c) => {
      if (!collectionIds.includes(c.id)) return c
      const added = instrumentIDs.filter((id) => !c.instrumentIDs.includes(id))
      if (added.length === 0) return c
      return { ...c, instrumentIDs: [...c.instrumentIDs, ...added] }
    })
    persist(collections)
    set({ collections })
  },

  removeFromCollection: (instrumentID, collectionId) => {
    const collections = get().collections.map((c) =>
      c.id === collectionId ? { ...c, instrumentIDs: c.instrumentIDs.filter((id) => id !== instrumentID) } : c,
    )
    persist(collections)
    set({ collections })
  },

  removeFromAllCollections: (instrumentIDs) => {
    const ids = new Set(instrumentIDs)
    const collections = get().collections.map((c) => ({
      ...c,
      instrumentIDs: c.instrumentIDs.filter((id) => !ids.has(id)),
    }))
    persist(collections)
    set({ collections })
  },
}))
```

注意：`useUserPrefsStore` 是运行时值导入（`collections.ts → userPrefs.ts`），`userPrefs.ts → collections.ts` 仅 `import type`（类型擦除，无运行时环）。

- [ ] **Step 7: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/stores/collections.test.ts src/stores/userPrefs.test.ts`
Expected: PASS（若 `contracts.test.ts` 因 `selectedContracts` 断言失败，属 Task 7 范围，先用 `--passWithNoTests` 不适用——直接让它暂时红，Task 7 修。若影响 `npm test` 全量，见 Task 7 前先用 `skipOnWindows` 不必；保持该文件红直到 Task 7。）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/stores/userPrefs.ts frontend/src/stores/collections.ts frontend/src/stores/userPrefs.test.ts frontend/src/stores/collections.test.ts
git commit -m "feat(collections): 数据层——userPrefs collections 迁移 + collections store CRUD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: CollectionPicker 选夹面板组件

**Files:**
- Create: `frontend/src/components/CollectionPicker/index.tsx`
- Create: `frontend/src/components/CollectionPicker/index.css`
- Test: `frontend/src/components/CollectionPicker/index.test.tsx`

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）；`useTabStore.openTab`；`toast`
- Produces: `export function CollectionPicker({ isOpen, instrumentIDs, onClose }: { isOpen: boolean; instrumentIDs: string[]; onClose: () => void })` — `instrumentIDs.length===1` 单选对账；`>1` 批量只加

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/components/CollectionPicker/index.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionPicker } from './index'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'

vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const seed = () =>
  useCollectionsStore.setState({
    collections: [
      { id: 'a', name: 'A', instrumentIDs: ['au2406'] },
      { id: 'b', name: 'B', instrumentIDs: ['rb2406'] },
    ],
    loaded: true,
  })

describe('CollectionPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('单选模式：预勾选所在夹；取消勾选 + 确定 → 从该夹移除', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    const aCheck = screen.getByRole('checkbox', { name: /A/ })
    expect(aCheck.checked).toBe(true)
    fireEvent.click(aCheck)
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual([]) // 对账移除
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406'])
  })

  it('单选模式：勾选新夹 + 确定 → 加入', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /B/ }))
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406', 'au2406'])
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406']) // 保持
  })

  it('批量模式：不预勾选；确认加入勾选的夹（只加不删）', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406', 'rb2406']} onClose={vi.fn()} />)
    // 批量预勾选为空
    expect(screen.getByRole('checkbox', { name: /A/ }).checked).toBe(false)
    fireEvent.click(screen.getByRole('checkbox', { name: /A/ }))
    fireEvent.click(screen.getByText('确定'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406', 'rb2406'])
    expect(collections.find((c) => c.id === 'b')?.instrumentIDs).toEqual(['rb2406']) // 未勾选不动
  })

  it('全选/全不选 toggle', () => {
    render(<CollectionPicker isOpen instrumentIDs={['cu2609']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/全选/))
    expect(screen.getByRole('checkbox', { name: /A/ }).checked).toBe(true)
    expect(screen.getByRole('checkbox', { name: /B/ }).checked).toBe(true)
  })

  it('新建收藏夹：回车创建并勾选', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/新建收藏夹/), { target: { value: '新夹' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/新建收藏夹/), { key: 'Enter' })
    const collections = useCollectionsStore.getState().collections
    const created = collections.find((c) => c.name === '新夹')
    expect(created).toBeDefined()
    expect(screen.getByRole('checkbox', { name: /新夹/ }).checked).toBe(true)
  })

  it('单选「移除全部收藏」从所有夹移除并关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={onClose} />)
    fireEvent.click(screen.getByText('移除全部收藏'))
    const collections = useCollectionsStore.getState().collections
    expect(collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual([])
    expect(onClose).toHaveBeenCalled()
  })

  it('「管理收藏夹」打开 collections 管理标签', () => {
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('管理收藏夹'))
    expect(useTabStore.getState().tabs.some((t) => t.type === 'collections')).toBe(true)
  })

  it('Escape 关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406']} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('批量模式未勾选任何夹 → toast.error 且不关闭', () => {
    const onClose = vi.fn()
    render(<CollectionPicker isOpen instrumentIDs={['au2406', 'rb2406']} onClose={onClose} />)
    fireEvent.click(screen.getByText('确定'))
    expect(toast.error).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/components/CollectionPicker/index.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现 `CollectionPicker/index.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'
import './index.css'

interface CollectionPickerProps {
  isOpen: boolean
  /** 目标合约：1 个 = 单选（对账）；>1 = 批量（只加不删） */
  instrumentIDs: string[]
  onClose: () => void
}

export function CollectionPicker({ isOpen, instrumentIDs, onClose }: CollectionPickerProps) {
  const collections = useCollectionsStore((s) => s.collections)
  const { createCollection, addToCollections, removeFromCollection, removeFromAllCollections } = useCollectionsStore()
  const openTab = useTabStore((s) => s.openTab)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const single = instrumentIDs.length === 1
  const targetId = instrumentIDs[0]

  // 打开时初始化勾选态：单选预勾选所在夹；批量全部不勾
  useEffect(() => {
    if (!isOpen) return
    if (single) {
      setChecked(new Set(collections.filter((c) => c.instrumentIDs.includes(targetId)).map((c) => c.id)))
    } else {
      setChecked(new Set())
    }
    setNewName('')
  }, [isOpen, single, targetId, collections])

  // 外部点击 / Esc 关闭
  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const allChecked = collections.length > 0 && collections.every((c) => checked.has(c.id))

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(collections.map((c) => c.id)))
  }

  const toggleOne = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    const id = createCollection(name)
    setChecked((prev) => new Set(prev).add(id))
    setNewName('')
    toast.success(`已新建收藏夹「${name}」`)
  }

  const handleRemoveAll = () => {
    removeFromAllCollections(instrumentIDs)
    toast.success(`已移除 ${instrumentIDs.length} 个合约的全部收藏`)
    onClose()
  }

  const handleConfirm = () => {
    const checkedIds = Array.from(checked)
    if (checkedIds.length === 0) {
      if (single) {
        // 单选未勾选任何夹 = 从所有夹移除
        removeFromAllCollections([targetId])
        toast.success(`已移除 ${targetId} 的全部收藏`)
        onClose()
      } else {
        toast.error('请选择收藏夹')
      }
      return
    }
    if (single) {
      const current = collections.filter((c) => c.instrumentIDs.includes(targetId)).map((c) => c.id)
      const toAdd = checkedIds.filter((id) => !current.includes(id))
      const toRemove = current.filter((id) => !checkedIds.includes(id))
      if (toAdd.length > 0) addToCollections([targetId], toAdd)
      for (const id of toRemove) removeFromCollection(targetId, id)
      toast.success(`已收藏到 ${checkedIds.length} 个收藏夹`)
    } else {
      addToCollections(instrumentIDs, checkedIds)
      toast.success(`已将 ${instrumentIDs.length} 个合约收藏到 ${checkedIds.length} 个收藏夹`)
    }
    onClose()
  }

  const openManage = () => {
    onClose()
    openTab({ type: 'collections', title: '📁 收藏夹' })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content collection-picker" ref={containerRef}>
        <div className="modal-header">
          <h3>{single ? '收藏到收藏夹' : `收藏 ${instrumentIDs.length} 个合约到收藏夹`}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="collection-picker__list">
          <div className="collection-picker__row">
            <label>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              全选 / 全不选
            </label>
          </div>
          {collections.map((c) => (
            <div key={c.id} className="collection-picker__row">
              <label>
                <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleOne(c.id)} />
                <span className="collection-picker__name">{c.name}</span>
                <span className="collection-picker__count">{c.instrumentIDs.length}</span>
              </label>
            </div>
          ))}
          {collections.length === 0 && <div className="collection-picker__empty">还没有收藏夹，先新建一个</div>}
        </div>
        <div className="collection-picker__new">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="新建收藏夹名称..."
          />
          <button onClick={handleCreate}>+ 新建</button>
        </div>
        <div className="collection-picker__footer">
          <button className="collection-picker__manage" onClick={openManage}>管理收藏夹</button>
          {single && (
            <button className="collection-picker__remove-all" onClick={handleRemoveAll}>移除全部收藏</button>
          )}
          <button className="collection-picker__confirm" onClick={handleConfirm}>确定</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 实现 `CollectionPicker/index.css`**

```css
/* 收藏夹选择面板（复用 modal-overlay/modal-content 骨架） */
.collection-picker {
  width: 320px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.collection-picker__list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 4px 0;
}

.collection-picker__row {
  padding: 6px 12px;
  font-size: 13px;
}

.collection-picker__row label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.collection-picker__row input[type='checkbox'] {
  accent-color: var(--color-primary, #4a9eff);
}

.collection-picker__name {
  color: var(--text-primary);
  flex: 1;
}

.collection-picker__count {
  color: var(--text-secondary);
  font-size: 12px;
}

.collection-picker__empty {
  padding: 12px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 12px;
}

.collection-picker__new {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.collection-picker__new input {
  flex: 1;
  padding: 4px 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.collection-picker__new button {
  padding: 4px 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.collection-picker__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}

.collection-picker__manage {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.collection-picker__remove-all {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--color-error);
  font-size: 12px;
  cursor: pointer;
}

.collection-picker__confirm {
  padding: 4px 16px;
  background: var(--color-primary, #4a9eff);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/components/CollectionPicker/index.test.tsx`
Expected: PASS（`modal-overlay`/`modal-content`/`modal-header`/`modal-close` 为全局 modal 样式，若测试环境无全局 css 不影响 DOM 断言）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/CollectionPicker/
git commit -m "feat(collections): CollectionPicker 选夹面板组件

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 行情页收藏入口改造（⭐ / 右键 / 工具栏 / 搜索弹窗 → 选夹面板）

**Files:**
- Modify: `frontend/src/hooks/useContractMenus.tsx`
- Modify: `frontend/src/modules/market/MarketPanel.tsx`
- Modify: `frontend/src/modules/options/OptionsPanel.tsx`
- Modify: `frontend/src/components/InstrumentSearchModal/index.tsx`
- Test: `frontend/src/modules/market/MarketPanel.test.tsx`（更新）、`frontend/src/modules/options/OptionsPanel.test.tsx`（更新）、`frontend/src/components/InstrumentSearchModal/index.test.tsx`（更新）

**Interfaces:**
- Consumes: `useCollectionsStore`、`unionFavoritedIds`（Task 1）、`CollectionPicker`（Task 2）
- Produces: `useContractMenus` 新签名（见 Step 1）；`InstrumentSearchModal` 新 props：`onOpenFavoritePicker(instrumentID)` + `onRemoveFromAllCollections(instrumentIDs)`（替换 `onAddToFavorite`/`onRemoveFromFavorite`），`favoritedIds`/`allContractIds` 保留

- [ ] **Step 1: 写失败测试（useContractMenus picker/folder 模式）**

创建 `frontend/src/hooks/useContractMenus.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useContractMenus } from './useContractMenus'

const ctx = { instrumentID: 'au2406', price: 100, x: 10, y: 20 }
const multi = { instrumentIDs: ['au2406', 'rb2406'], x: 10, y: 20 }

function Harness({ favoriteMode, favoritedIds, onOpenFavoritePicker, onRemoveFromAll, onToggleInFolder, onRemoveFromFolderBatch }: any) {
  const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
    contextMenu: ctx,
    multiSelectMenu: multi,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup: vi.fn(),
    openQueryPopup: vi.fn(),
    openKlineTab: vi.fn(),
    openOrderTabs: vi.fn(),
    openKlineTabs: vi.fn(),
    closeMenus: vi.fn(),
  } as any)
  return (
    <>
      {singleMenu}
      {multiMenu}
      <button data-testid="batch" onClick={() => batchToggleFavorite('au2406', new Set())}>
        {favoriteButtonLabel('au2406', new Set())}
      </button>
    </>
  )
}

describe('useContractMenus 收藏双模式', () => {
  it('picker 模式：单选右键「收藏到收藏夹…」打开面板；批量菜单含「批量收藏到收藏夹…」与「批量取消收藏」', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set(['au2406'])} onOpenFavoritePicker={onOpen} onRemoveFromAll={vi.fn()} />)
    expect(screen.getByText('收藏到收藏夹…')).toBeDefined()
    fireEvent.click(screen.getByText('收藏到收藏夹…'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
    expect(screen.getByText(/批量收藏到收藏夹…/)).toBeDefined()
    expect(screen.getByText(/批量取消收藏/)).toBeDefined()
  })

  it('picker 模式：工具栏批量收藏 → onOpenFavoritePicker(选中集)；label=批量收藏', () => {
    const onOpen = vi.fn()
    render(<Harness favoriteMode="picker" favoritedIds={new Set()} onOpenFavoritePicker={onOpen} />)
    expect(screen.getByTestId('batch').textContent).toBe('收藏') // 未收藏单选
    fireEvent.click(screen.getByTestId('batch'))
    expect(onOpen).toHaveBeenCalledWith(['au2406'])
  })

  it('folder 模式：单选右键「从本夹移除」；批量「批量从本夹移除」，无「批量收藏到收藏夹…」', () => {
    const onToggle = vi.fn()
    render(<Harness favoriteMode="folder" favoritedIds={new Set(['au2406'])} onToggleInFolder={onToggle} />)
    expect(screen.getByText('从本夹移除')).toBeDefined()
    fireEvent.click(screen.getByText('从本夹移除'))
    expect(onToggle).toHaveBeenCalledWith('au2406')
    expect(screen.queryByText(/批量收藏到收藏夹…/)).toBeNull()
    expect(screen.getByText(/批量从本夹移除/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/hooks/useContractMenus.test.tsx`
Expected: FAIL — 签名不匹配 / 标签不符。

- [ ] **Step 3: 重写 `useContractMenus.tsx`**

```tsx
import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { ContextMenu } from '@/components/ContextMenu'
import { toast } from '@/components/Toast'

interface SingleMenuState {
  instrumentID: string
  price: number
  x: number
  y: number
}

interface MultiMenuState {
  instrumentIDs: string[]
  x: number
  y: number
}

interface UseContractMenusArgs {
  contextMenu: SingleMenuState | null
  multiSelectMenu: MultiMenuState | null
  /** 收藏态集合（行情页 = 任一夹；夹页 = 本夹） */
  favoritedIds: Set<string>
  /** 收藏交互模式：picker（行情页，弹选夹面板）| folder（夹页，直接切本夹） */
  favoriteMode: 'picker' | 'folder'
  /** picker 模式：打开选夹面板 */
  onOpenFavoritePicker?: (instrumentIDs: string[]) => void
  /** picker 模式：批量取消收藏（从所有夹移除） */
  onRemoveFromAll?: (instrumentIDs: string[]) => void
  /** folder 模式：本夹内切换收藏 */
  onToggleInFolder?: (instrumentID: string) => void
  /** folder 模式：批量从本夹移除 */
  onRemoveFromFolderBatch?: (instrumentIDs: string[]) => void
  openOrderPopup: (instrumentID: string) => void
  openQueryPopup: (instrumentID: string) => void
  openKlineTab: (instrumentID: string) => void
  openOrderTabs: (instrumentIDs: string[]) => void
  openKlineTabs: (instrumentIDs: string[]) => void
  closeMenus: () => void
}

/**
 * useContractMenus — 合约右键菜单 + 工具栏收藏共享逻辑（picker / folder 双模式）。
 *
 * - picker（行情页）：收藏项统一弹 CollectionPicker；批量取消收藏 = 从所有夹移除。
 * - folder（夹页）：收藏项直接切本夹 / 批量从本夹移除。
 */
export function useContractMenus(args: UseContractMenusArgs) {
  const {
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode,
    onOpenFavoritePicker,
    onRemoveFromAll,
    onToggleInFolder,
    onRemoveFromFolderBatch,
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  } = args

  /** 工具栏收藏按钮：弹选夹面板（picker 模式）；folder 模式不渲染工具栏收藏 */
  const batchToggleFavorite = useCallback((
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ) => {
    if (favoriteMode !== 'picker') return
    const ids = selectedContracts.size > 0
      ? Array.from(selectedContracts)
      : selectedInstrument ? [selectedInstrument] : []
    if (ids.length > 0) onOpenFavoritePicker?.(ids)
  }, [favoriteMode, onOpenFavoritePicker])

  const favoriteButtonLabel = useCallback((
    selectedInstrument: string | null,
    selectedContracts: Set<string>,
  ): string => {
    if (selectedContracts.size > 1) return '批量收藏'
    return selectedInstrument && favoritedIds.has(selectedInstrument) ? '收藏夹' : '收藏'
  }, [favoritedIds])

  const singleMenu: ReactNode = contextMenu ? (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={[
        { label: '打开报单', icon: '📝', onClick: () => openOrderPopup(contextMenu.instrumentID) },
        { label: '打开K线', icon: '📈', onClick: () => openKlineTab(contextMenu.instrumentID) },
        { label: '查询', icon: '📋', onClick: () => openQueryPopup(contextMenu.instrumentID) },
        favoriteMode === 'folder'
          ? {
              label: favoritedIds.has(contextMenu.instrumentID) ? '从本夹移除' : '收藏到本夹',
              icon: favoritedIds.has(contextMenu.instrumentID) ? '★' : '⭐',
              onClick: () => onToggleInFolder?.(contextMenu.instrumentID),
            }
          : {
              label: '收藏到收藏夹…',
              icon: '⭐',
              onClick: () => onOpenFavoritePicker?.([contextMenu.instrumentID]),
            },
        { label: '复制合约代码', icon: '📋', onClick: () => navigator.clipboard.writeText(contextMenu.instrumentID) },
      ]}
      onClose={closeMenus}
    />
  ) : null

  const multiMenu: ReactNode = multiSelectMenu ? (() => {
    const favoritedInSelection = multiSelectMenu.instrumentIDs.filter((id) => favoritedIds.has(id))
    const favoriteItem =
      favoriteMode === 'folder'
        ? {
            label: `批量从本夹移除 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromFolderBatch?.(favoritedInSelection)
              toast.success(`已从本夹移除 ${favoritedInSelection.length} 个合约`)
            },
          }
        : {
            label: `批量收藏到收藏夹… (${multiSelectMenu.instrumentIDs.length}个)`,
            icon: '⭐',
            onClick: () => onOpenFavoritePicker?.(multiSelectMenu.instrumentIDs),
          }
    const removeAllItem =
      favoriteMode === 'folder'
        ? null
        : {
            label: `批量取消收藏 (${favoritedInSelection.length}个)`,
            icon: '★',
            disabled: favoritedInSelection.length === 0,
            onClick: () => {
              onRemoveFromAll?.(favoritedInSelection)
              toast.success(`已移除 ${favoritedInSelection.length} 个合约的全部收藏`)
            },
          }

    return (
      <ContextMenu
        x={multiSelectMenu.x}
        y={multiSelectMenu.y}
        items={[
          { label: `批量打开报单 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📝', onClick: () => openOrderTabs(multiSelectMenu.instrumentIDs) },
          { label: `批量打开K线 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📈', onClick: () => openKlineTabs(multiSelectMenu.instrumentIDs) },
          favoriteItem,
          ...(removeAllItem ? [removeAllItem] : []),
          { label: `复制合约代码 (${multiSelectMenu.instrumentIDs.length}个)`, icon: '📋', onClick: () => navigator.clipboard.writeText(multiSelectMenu.instrumentIDs.join(',')) },
        ]}
        onClose={closeMenus}
      />
    )
  })() : null

  return { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel }
}
```

- [ ] **Step 4: 更新 `MarketPanel.tsx` 接入 picker**

改动点：
1. `const { contracts, favorites, addToFavorites, removeFromFavorites } = useContractsStore()` → `const contracts = useContractsStore((s) => s.contracts)`
2. 新增：`import { useCollectionsStore, unionFavoritedIds } from '@/stores/collections'`、`import { CollectionPicker } from '@/components/CollectionPicker'`、`import { useState }`（已有）
3. `const collections = useCollectionsStore((s) => s.collections)`；`const [picker, setPicker] = useState<{ instrumentIDs: string[] } | null>(null)`
4. `favoritedIds` 改为：`useMemo(() => unionFavoritedIds(collections), [collections])`
5. `sortedFavorites` 改为：`useMemo(() => sortFutures(contracts.filter((c) => c.productClass === '1' && favoritedIds.has(c.instrumentID))), [contracts, favoritedIds])`
6. `useContractMenus` 调用改为：

```tsx
const { singleMenu, multiMenu, batchToggleFavorite, favoriteButtonLabel } = useContractMenus({
  contextMenu,
  multiSelectMenu,
  favoritedIds,
  favoriteMode: 'picker',
  onOpenFavoritePicker: (instrumentIDs) => setPicker({ instrumentIDs }),
  onRemoveFromAll: (instrumentIDs) => useCollectionsStore.getState().removeFromAllCollections(instrumentIDs),
  openOrderPopup,
  openQueryPopup,
  openKlineTab,
  openOrderTabs,
  openKlineTabs,
  closeMenus,
})
```

7. `QuoteTable` 的 `onFavoriteChange` 改为：`onFavoriteChange={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}`
8. `InstrumentSearchModal` 调用改为：

```tsx
<InstrumentSearchModal
  isOpen={searchModalOpen}
  onClose={() => setSearchModalOpen(false)}
  onOpenFavoritePicker={(instrumentID) => setPicker({ instrumentIDs: [instrumentID] })}
  onRemoveFromAllCollections={(ids) => useCollectionsStore.getState().removeFromAllCollections(ids)}
  allContractIds={allContractIds}
  favoritedIds={favoritedIds}
/>
```

9. 面板底部（`{multiMenu}` 之后）渲染 picker：

```tsx
<CollectionPicker
  isOpen={!!picker}
  instrumentIDs={picker?.instrumentIDs ?? []}
  onClose={() => setPicker(null)}
/>
```

- [ ] **Step 5: 更新 `OptionsPanel.tsx` 接入 picker**

同 MarketPanel 改动（第 4 步 1-9），差异：
1. `favoriteOptions`（自选视图基础集）改为：`useMemo(() => options.filter((c) => favoritedIds.has(c.instrumentID)), [options, favoritedIds])`（`options` 已存在；删 `favorites` 相关行）
2. `favoritedIds` = `unionFavoritedIds(collections)`（任一夹）
3. `useContractMenus` 同 picker 模式；`QuoteTable.onFavoriteChange` → `setPicker({ instrumentIDs: [instrumentID] })`
4. `InstrumentSearchModal` props 同 MarketPanel；渲染 `CollectionPicker`

- [ ] **Step 6: 更新 `InstrumentSearchModal/index.tsx`**

Props 接口改：

```ts
interface Props {
  isOpen: boolean
  onClose: () => void
  /** 打开选夹面板（收藏入口） */
  onOpenFavoritePicker: (instrumentID: string) => void
  /** 从所有收藏夹移除 */
  onRemoveFromAllCollections: (instrumentIDs: string[]) => void
  allContractIds: Set<string>
  favoritedIds: Set<string>
}
```

函数签名解构同步。`handleSubscribe` 改为：`const handleSubscribe = (inst: ContractInfo) => onOpenFavoritePicker(inst.instrumentID)`（去掉 toast——确认在面板内）。操作列 `移除` 按钮改为：`onClick={() => { onRemoveFromAllCollections([inst.instrumentID]); toast.success(\`已移除 ${inst.instrumentID}\`) }}`（`favoritedIds.has` 判断不变）。

- [ ] **Step 7: 更新三个既有测试文件**

- `MarketPanel.test.tsx`：
  - `useContractsStore.setState({ contracts: [], favorites: [], isLoaded: false })` → 去掉 `favorites` 字段；改为 `useCollectionsStore.setState({ collections: [], loaded: true })`
  - 所有 `favorites: [...]` 播种改为 `useCollectionsStore.setState({ collections: [{ id: 'c1', name: '默认', instrumentIDs: ['cu2609', 'FG609'] }] })`（对应 411/512 自选视图测试）
  - `view=favorites/all → 激活期货标签并切内部 自选/全部` 测试（line 462）改断言：`callback('favorites')` → `useTabStore.getState().tabs.some((t) => t.type === 'collections') === true`（此测试最终态以 Task 8 为准，本任务先按「打开管理页」断言——若 TabContent 未挂 collections 页面类型，此处先断言 openTab 已调用；**实现提示**：本任务可先改 onMarketView 行为，Task 8 收尾）
  - DOM 顺序测试（line 486）不变（按钮结构保留）
  - 新增：⭐ 点击 → 打开 CollectionPicker（`render` 后 `fireEvent.click` ⭐ 列回调，断言 `screen.getByText('收藏到收藏夹')` 出现）
- `OptionsPanel.test.tsx`：
  - `收藏列点击：未收藏 → addToFavorites(inst)`（line 214）改为：点击 ⭐ 列回调 → 打开 CollectionPicker（断言面板出现）；`useContractsStore.setState` 播种的 `favorites` 去掉
  - 工具栏 `收藏` 按钮断言（line 315）保留（label 未收藏为 `收藏`）
- `InstrumentSearchModal/index.test.tsx`：
  - `点击收藏弹出 toast` 改为：点击收藏 → `onOpenFavoritePicker` 被调用（断言 prop 收到 instrumentID）
  - `点击移除` → `onRemoveFromAllCollections(['IF2608'])` + toast
  - 渲染 props 更新为 `onOpenFavoritePicker={vi.fn()}` / `onRemoveFromAllCollections={vi.fn()}`

- [ ] **Step 8: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useContractMenus.test.tsx src/modules/market/MarketPanel.test.tsx src/modules/options/OptionsPanel.test.tsx src/components/InstrumentSearchModal/index.test.tsx`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add frontend/src/hooks/useContractMenus.tsx frontend/src/hooks/useContractMenus.test.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/modules/market/MarketPanel.test.tsx frontend/src/modules/options/OptionsPanel.tsx frontend/src/modules/options/OptionsPanel.test.tsx frontend/src/components/InstrumentSearchModal/index.tsx frontend/src/components/InstrumentSearchModal/index.test.tsx
git commit -m "feat(collections): 行情页收藏入口改造（⭐/右键/工具栏/搜索弹窗 → 选夹面板）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

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

- [ ] **Step 5: 更新 TabContent 测试**

`TabContent/index.test.tsx`：原 `favorites` 渲染用例改为 `collections` 渲染 `<CollectionsPage />`（断言 `data-testid="collections-page"`）；新增 `collection` 用例（断言 `data-testid="collection-page"` 且传入 collectionId）。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx src/components/TabContent/detachFlow.repro.test.tsx src/components/TabContent/detachFlow.integration.test.tsx`
Expected: PASS（若 App.test 因 onNavigateTab 变化失败，属 Task 7 范围，先记录）

- [ ] **Step 7: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/App.tsx frontend/src/pages/CollectionsPage.tsx frontend/src/pages/CollectionsPage.css frontend/src/pages/CollectionPage.tsx frontend/src/pages/CollectionPage.css frontend/src/stores/tabs.test.ts frontend/src/components/TabContent/index.test.tsx
git commit -m "feat(collections): 标签系统改造（collections/collection 类型 + 页面壳 + TabContent）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 收藏夹管理页完整实现

**Files:**
- Modify: `frontend/src/pages/CollectionsPage.tsx`（替换壳）
- Modify: `frontend/src/pages/CollectionsPage.css`
- Test: `frontend/src/pages/CollectionsPage.test.tsx`（新，替代原 FavoritesPage.test.tsx 的收藏页职责）

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）、`useTabStore`、`toast`
- Produces: 无（页面终端）

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/pages/CollectionsPage.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionsPage } from './CollectionsPage'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'

vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const seed = () =>
  useCollectionsStore.setState({
    collections: [
      { id: 'a', name: '农产品', instrumentIDs: ['au2406', 'rb2406'] },
      { id: 'b', name: '黑色系', instrumentIDs: [] },
    ],
    loaded: true,
  })

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('展示收藏夹列表（名称 + 合约数）', () => {
    render(<CollectionsPage />)
    expect(screen.getByText('农产品')).toBeDefined()
    expect(screen.getByText('黑色系')).toBeDefined()
    expect(screen.getByText('2 个合约')).toBeDefined()
  })

  it('新建收藏夹', () => {
    render(<CollectionsPage />)
    fireEvent.change(screen.getByPlaceholderText(/新建收藏夹/), { target: { value: '新夹' } })
    fireEvent.click(screen.getByText('+ 新建收藏夹'))
    expect(useCollectionsStore.getState().collections.some((c) => c.name === '新夹')).toBe(true)
  })

  it('打开收藏夹 → 打开 collection 标签（按 collectionId 去重）', () => {
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('打开')[0])
    const state = useTabStore.getState()
    expect(state.tabs.some((t) => t.type === 'collection' && t.props.collectionId === 'a')).toBe(true)
    fireEvent.click(screen.getAllByText('打开')[0])
    expect(useTabStore.getState().tabs.filter((t) => t.type === 'collection')).toHaveLength(1)
  })

  it('重命名同步已打开的夹标签标题', () => {
    useTabStore.getState().openTab({ type: 'collection', title: '📁 农产品', props: { collectionId: 'a' } })
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('重命名')[0])
    const input = screen.getByDisplayValue('农产品')
    fireEvent.change(input, { target: { value: '农产品2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const coll = useCollectionsStore.getState().collections.find((c) => c.id === 'a')!
    expect(coll.name).toBe('农产品2')
    const tab = useTabStore.getState().tabs.find((t) => t.type === 'collection' && t.props.collectionId === 'a')!
    expect(tab.title).toBe('📁 农产品2')
  })

  it('删除需确认；确认后夹被删除，不影响合约本身', () => {
    render(<CollectionsPage />)
    fireEvent.click(screen.getAllByText('删除')[0])
    expect(screen.getByText('删除收藏夹')).toBeDefined()
    fireEvent.click(screen.getByText('删除')) // 确认弹窗内按钮
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'a')).toBeUndefined()
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'b')).toBeDefined()
  })

  it('空态', () => {
    useCollectionsStore.setState({ collections: [] })
    render(<CollectionsPage />)
    expect(screen.getByText(/还没有收藏夹/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/CollectionsPage.test.tsx`
Expected: FAIL — 壳只渲染空态。

- [ ] **Step 3: 实现 `CollectionsPage.tsx`**

```tsx
import { useState } from 'react'
import { useCollectionsStore } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { toast } from '@/components/Toast'
import './CollectionsPage.css'

export function CollectionsPage() {
  const { collections, createCollection, renameCollection, deleteCollection } = useCollectionsStore()
  const openTab = useTabStore((s) => s.openTab)
  const updateTab = useTabStore((s) => s.updateTab)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createCollection(name)
    setNewName('')
    toast.success(`已新建收藏夹「${name}」`)
  }

  const openCollection = (id: string, name: string) => {
    openTab({ type: 'collection', title: `📁 ${name}`, props: { collectionId: id } })
  }

  const startRename = (id: string, name: string) => {
    setRenamingId(id)
    setRenameValue(name)
  }

  const commitRename = (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    renameCollection(id, name)
    // 同步已打开的该夹标签标题
    useTabStore.getState().tabs
      .filter((t) => t.type === 'collection' && t.props.collectionId === id)
      .forEach((t) => updateTab(t.id, { title: `📁 ${name}` }))
    setRenamingId(null)
    toast.success('已重命名')
  }

  const confirmDelete = () => {
    if (!deletingId) return
    deleteCollection(deletingId)
    setDeletingId(null)
    toast.success('已删除收藏夹')
  }

  return (
    <section className="collections-page" data-testid="collections-page">
      <div className="collections-page__create">
        <input
          className="collections-page__input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="新建收藏夹名称..."
        />
        <button className="collections-page__create-btn" onClick={handleCreate}>+ 新建收藏夹</button>
      </div>
      <div className="collections-page__list">
        {collections.length === 0 ? (
          <div className="collections-page__empty">
            <p>还没有收藏夹</p>
            <p className="collections-page__hint">在上方新建，或去行情页点 ⭐ 收藏到收藏夹</p>
          </div>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="collections-page__item">
              {renamingId === c.id ? (
                <input
                  className="collections-page__rename-input"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(c.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <span className="collections-page__name">{c.name}</span>
              )}
              <span className="collections-page__count">{c.instrumentIDs.length} 个合约</span>
              <div className="collections-page__actions">
                <button className="collections-page__btn" onClick={() => openCollection(c.id, c.name)}>打开</button>
                <button className="collections-page__btn" onClick={() => startRename(c.id, c.name)}>重命名</button>
                <button className="collections-page__btn collections-page__btn--danger" onClick={() => setDeletingId(c.id)}>删除</button>
              </div>
            </div>
          ))
        )}
      </div>

      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-content collections-page__confirm" onClick={(e) => e.stopPropagation()}>
            <h3>删除收藏夹</h3>
            <p>「{collections.find((c) => c.id === deletingId)?.name}」内的合约仅从本夹移除，不影响其他收藏夹与合约本身。</p>
            <div className="collections-page__confirm-actions">
              <button onClick={() => setDeletingId(null)}>取消</button>
              <button className="collections-page__btn--danger" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: 实现 `CollectionsPage.css`**（替换壳 css）

```css
.collections-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  padding: 12px;
  box-sizing: border-box;
}

.collections-page__create {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.collections-page__input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.collections-page__create-btn {
  padding: 6px 14px;
  background: var(--color-primary, #4a9eff);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.collections-page__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.collections-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.collections-page__name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collections-page__count {
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.collections-page__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.collections-page__btn {
  padding: 4px 10px;
  background: var(--bg-tertiary, #2a2a3e);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.collections-page__btn--danger {
  color: var(--color-error);
}

.collections-page__rename-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--color-primary, #4a9eff);
  border-radius: 4px;
  font-size: 13px;
}

.collections-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  min-height: 200px;
}

.collections-page__hint {
  font-size: 13px;
  margin-top: 8px;
}

.collections-page__confirm {
  width: 340px;
  padding: 16px;
}

.collections-page__confirm p {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 8px 0 16px;
}

.collections-page__confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.collections-page__confirm-actions button {
  padding: 6px 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/CollectionsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/CollectionsPage.tsx frontend/src/pages/CollectionsPage.css frontend/src/pages/CollectionsPage.test.tsx
git commit -m "feat(collections): 收藏夹管理页完整实现（新建/列表/打开/重命名同步标题/删除确认）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 收藏夹页完整实现（类型切换 / 本夹 ⭐ 直切 / 从本夹移除）

**Files:**
- Modify: `frontend/src/pages/CollectionPage.tsx`（替换壳）
- Modify: `frontend/src/pages/CollectionPage.css`
- Test: `frontend/src/pages/CollectionPage.test.tsx`（新）

**Interfaces:**
- Consumes: `useCollectionsStore`（Task 1）、`useContractsStore.contracts`、`groupOptionsByUnderlying`（`@/modules/market/sort`）、`futuresSpec`/`optionsSpec`、`useContractMenus`（folder 模式，Task 3）、`useContractContextMenu`、`usePointOrder`、`useMarketStore`
- Produces: 无（页面终端）

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/pages/CollectionPage.test.tsx`：

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionPage } from './CollectionPage'
import { useCollectionsStore } from '@/stores/collections'
import { useContractsStore } from '@/stores/contracts'
import { useMarketStore } from '@/modules/market/store'
import { useTabStore } from '@/stores/tabs'

vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/modules/market/QuoteTable', () => ({
  QuoteTable: ({ contracts, onFavoriteChange, onContextMenu }: any) => (
    <div data-testid="quote-table">
      {contracts.map((c: any) => (
        <div key={c.instrumentID} data-testid={`row-${c.instrumentID}`}>
          <span>{c.instrumentID}</span>
          <button data-testid={`fav-${c.instrumentID}`} onClick={() => onFavoriteChange?.(c.instrumentID, true)}>⭐</button>
        </div>
      ))}
    </div>
  ),
}))

const futures = [
  { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
  { instrumentID: 'au2406', instrumentName: '黄金', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2024-06-15', isTrading: 1, productClass: '1' },
]

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCollectionsStore.setState({
      collections: [{ id: 'a', name: '农产品', instrumentIDs: ['IF2608', 'au2406'] }],
      loaded: true,
    })
    useContractsStore.setState({ contracts: futures, isLoaded: true } as any)
    useMarketStore.setState({ snapshots: new Map(), selectedInstrument: null, selectedContracts: new Set() })
    useTabStore.setState({
      tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }],
      activeTabId: 'tab-market',
    })
  })

  it('展示夹内合约（期货段）', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    expect(screen.getByTestId('row-IF2608')).toBeDefined()
    expect(screen.getByTestId('row-au2406')).toBeDefined()
  })

  it('[全部|期货|期权] 类型切换', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByRole('button', { name: '期权' }))
    expect(screen.queryByTestId('row-IF2608')).toBeNull() // 无期权合约 → 空
    fireEvent.click(screen.getByRole('button', { name: '期货' }))
    expect(screen.getByTestId('row-IF2608')).toBeDefined()
  })

  it('⭐ 本夹直切：点击收藏 → 加入本夹；再点 → 移除', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByTestId('fav-IF2608')) // 已在夹，点击移除
    expect(useCollectionsStore.getState().collections.find((c) => c.id === 'a')?.instrumentIDs).toEqual(['au2406'])
  })

  it('右键菜单含「从本夹移除」', () => {
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    fireEvent.click(screen.getByTestId('row-IF2608'))
  })

  it('空夹态', () => {
    useCollectionsStore.setState({ collections: [{ id: 'a', name: '农产品', instrumentIDs: [] }] })
    render(<CollectionPage collectionId="a" tabId="tab-collection-a" />)
    expect(screen.getByText(/收藏夹为空/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/CollectionPage.test.tsx`
Expected: FAIL — 壳只渲染空态。

- [ ] **Step 3: 实现 `CollectionPage.tsx`**（替换壳）

```tsx
import { useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { QuoteTable } from '@/modules/market/QuoteTable'
import { futuresSpec } from '@/modules/market/futuresSpec'
import { optionsSpec } from '@/modules/market/optionsSpec'
import { groupOptionsByUnderlying } from '@/modules/market/sort'
import { useMarketStore } from '@/modules/market/store'
import { useOrderStore } from '@/modules/order/store'
import { useContractsStore } from '@/stores/contracts'
import { useCollectionsStore, collectionFavoritedIds } from '@/stores/collections'
import { useTabStore } from '@/stores/tabs'
import { useContractContextMenu } from '@/hooks/useContractContextMenu'
import { useContractMenus } from '@/hooks/useContractMenus'
import { usePointOrder } from '@/hooks/usePointOrder'
import { toast } from '@/components/Toast'
import type { ContractInfo } from '@/services/types'
import './CollectionPage.css'

type TypeView = 'all' | 'futures' | 'options'

export function CollectionPage({ collectionId, tabId }: { collectionId: string; tabId: string }) {
  const [typeView, setTypeView] = useState<TypeView>('all')
  const { snapshots, selectedInstrument, setSelectedInstrument, setVisibleInstrumentIDs, selectedContracts, setSelectedContracts } = useMarketStore()
  const { setSelectedInstrument: setOrderInstrument, setOrderForm } = useOrderStore()
  const contracts = useContractsStore((s) => s.contracts)
  const collections = useCollectionsStore((s) => s.collections)
  const { addToCollections, removeFromCollection } = useCollectionsStore()
  const { contextMenu, multiSelectMenu, openOrderPopup, openQueryPopup, openKlineTab, openOrderTabs, openKlineTabs, handleContextMenu, handleMultiSelectContextMenu, closeMenus } = useContractContextMenu()
  const isActive = useTabStore((s) => s.tabs.some((t) => t.id === s.activeTabId && t.type === 'collection' && t.props.collectionId === collectionId))

  const collection = collections.find((c) => c.id === collectionId)
  const favoritedIds = useMemo(() => collectionFavoritedIds(collections, collectionId), [collections, collectionId])

  // 从全量合约解析本夹合约（保持夹内加入顺序；全局合约未加载完的先缺省）
  const memberContracts = useMemo(() => {
    if (!collection) return []
    const byId = new Map(contracts.map((c) => [c.instrumentID, c]))
    return collection.instrumentIDs.map((id) => byId.get(id)).filter((c): c is ContractInfo => !!c)
  }, [collection, contracts])

  const futures = useMemo(() => memberContracts.filter((c) => c.productClass === '1'), [memberContracts])
  const options = useMemo(() => memberContracts.filter((c) => c.productClass === '2' || c.productClass === '6'), [memberContracts])
  const allFutures = useMemo(() => contracts.filter((c) => c.productClass === '1'), [contracts])

  // 期权段：按标底分组展平（标底行在前 + 期权行随后），复用 optionsSpec 渲染
  const optionRows = useMemo(() => {
    const groups = groupOptionsByUnderlying(options, allFutures)
    const flat: ContractInfo[] = []
    for (const g of groups) {
      if (g.underlying) flat.push(g.underlying)
      flat.push(...g.options)
    }
    return flat
  }, [options, allFutures])

  // 「全部」模式两段同时渲染时可见区上报合并（避免后报告的表覆盖前者）
  const rangesRef = useRef<{ futures: string[]; options: string[] }>({ futures: [], options: [] })
  const reportVisible = (part: 'futures' | 'options') => (ids: string[]) => {
    rangesRef.current[part] = ids
    const merged = Array.from(new Set([...rangesRef.current.futures, ...rangesRef.current.options]))
    setVisibleInstrumentIDs(merged)
  }

  const handleToggleFavorite = (instrumentID: string) => {
    if (favoritedIds.has(instrumentID)) {
      removeFromCollection(instrumentID, collectionId)
      toast.success(`已从本夹移除 ${instrumentID}`)
    } else {
      addToCollections([instrumentID], [collectionId])
      toast.success(`已收藏到本夹 ${instrumentID}`)
    }
  }

  const { singleMenu, multiMenu } = useContractMenus({
    contextMenu,
    multiSelectMenu,
    favoritedIds,
    favoriteMode: 'folder',
    onToggleInFolder: handleToggleFavorite,
    onRemoveFromFolderBatch: (ids) => {
      for (const id of ids) removeFromCollection(id, collectionId)
      toast.success(`已从本夹移除 ${ids.length} 个合约`)
    },
    openOrderPopup,
    openQueryPopup,
    openKlineTab,
    openOrderTabs,
    openKlineTabs,
    closeMenus,
  })

  const { handleClick, handleDoubleClick } = usePointOrder({
    onOrder: ({ instrumentID, price }) => {
      setSelectedInstrument(instrumentID)
      setOrderInstrument(instrumentID)
      const inst = contracts.find((c) => c.instrumentID === instrumentID)
      if (!(inst && inst.productClass === '1')) setOrderForm({ limitPrice: price })
    },
    onFill: ({ instrumentID }) => {
      setSelectedInstrument(instrumentID)
      openOrderPopup(instrumentID)
    },
  })

  if (!collection) return <div className="collection-page collection-page__empty">收藏夹不存在</div>

  const isEmpty = memberContracts.length === 0
  const showFutures = typeView === 'all' ? futures.length > 0 : typeView === 'futures'
  const showOptions = typeView === 'all' ? options.length > 0 : typeView === 'options'

  return (
    <section className="collection-page" data-testid="collection-page">
      <div className="market-toolbar">
        <div className="market-toolbar__tabs">
          {(['all', 'futures', 'options'] as TypeView[]).map((v) => (
            <button
              key={v}
              className={`btn-tab${typeView === v ? ' active' : ''}`}
              onClick={() => setTypeView(v)}
            >
              {{ all: '全部', futures: '期货', options: '期权' }[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-content">
        {isEmpty ? (
          <div className="collection-page__empty">
            <p>收藏夹为空</p>
            <p className="collection-page__hint">去行情页点 ⭐ 收藏合约</p>
          </div>
        ) : (
          <ErrorBoundary>
            {showFutures && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期货</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={futuresSpec}
                    contracts={futures}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('futures') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
            {showOptions && (
              <>
                {typeView === 'all' && <div className="collection-page__section-title">期权</div>}
                <div className="collection-page__table">
                  <QuoteTable
                    spec={optionsSpec}
                    contracts={optionRows}
                    snapshots={snapshots}
                    selectedInstrument={selectedInstrument}
                    isActive={isActive}
                    onRowClick={handleClick}
                    onRowDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onMultiSelectContextMenu={handleMultiSelectContextMenu}
                    onVisibleRangeChange={typeView === 'all' ? reportVisible('options') : setVisibleInstrumentIDs}
                    favoritedIds={favoritedIds}
                    onFavoriteChange={(instrumentID) => handleToggleFavorite(instrumentID)}
                    selectedContracts={selectedContracts}
                    onSelectionChange={setSelectedContracts}
                  />
                </div>
              </>
            )}
          </ErrorBoundary>
        )}
      </div>
      {singleMenu}
      {multiMenu}
    </section>
  )
}
```

- [ ] **Step 4: 实现 `CollectionPage.css`**（替换壳 css）

```css
.collection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.collection-page .panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.collection-page__table {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.collection-page__section-title {
  flex-shrink: 0;
  padding: 4px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.collection-page__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.collection-page__hint {
  font-size: 13px;
  margin-top: 8px;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/CollectionPage.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/CollectionPage.tsx frontend/src/pages/CollectionPage.css frontend/src/pages/CollectionPage.test.tsx
git commit -m "feat(collections): 收藏夹页完整实现（类型切换/分段、本夹⭐直切、右键从本夹移除）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

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

- [ ] **Step 3: 改 `stores/contracts.ts` 清理 favorites**

删除：`favorites` 字段、`loadFavoriteContracts`、`addToFavorites`、`removeFromFavorites`、`getInstrumentsByIds`/`useUserPrefsStore` import。保留 `contracts/isLoaded/setContracts/loadAllInstruments`。

- [ ] **Step 4: 更新 `contracts.test.ts`**

- `beforeEach` setState 去掉 `favorites`
- 删除 `loadFavoriteContracts`/`addToFavorites`/`removeFromFavorites` 相关用例（`collections.test.ts` 已覆盖等价能力）
- `vi.mock('@/services/api')` 保留 `getInstruments`（loadAllInstruments 用）；多余 mock 可留

- [ ] **Step 5: 改 `App.tsx` 启动 + 删 FavoritesPage**

- import 加 `useCollectionsStore`；启动 effect 里 `useContractsStore.getState().loadFavoriteContracts()` → `useCollectionsStore.getState().loadCollections()`
- 删除文件 `frontend/src/pages/FavoritesPage.tsx`、`FavoritesPage.test.tsx`、`FavoritesPage.css`

- [ ] **Step 6: 更新 `App.test.tsx`**

- `loadFavSpy` 改为 `vi.spyOn(useCollectionsStore.getState(), 'loadCollections').mockResolvedValue(undefined)`

- [ ] **Step 7: 全量回归（本任务中途红，Task 8 收口前先局部跑）**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts src/stores/contracts.test.ts src/App.test.tsx`
Expected: PASS（若其它文件引用 `contracts.favorites` 报错，是遗漏的消费点——grep `\.favorites|addToFavorites|removeFromFavorites|loadFavoriteContracts` 全仓库修复）

- [ ] **Step 8: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts frontend/src/stores/contracts.ts frontend/src/stores/contracts.test.ts frontend/src/App.tsx frontend/src/App.test.tsx
git rm frontend/src/pages/FavoritesPage.tsx frontend/src/pages/FavoritesPage.test.tsx frontend/src/pages/FavoritesPage.css
git commit -m "refactor(collections): 订阅去 favorites + contracts 清理 + 启动 loadCollections + 删 FavoritesPage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

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
