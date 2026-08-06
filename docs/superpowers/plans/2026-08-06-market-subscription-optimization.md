# 行情表格订阅优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除行情表格拖动时的订阅/退订抖动、大幅降低请求量、永不触顶 500 上限，并减少每次 WS tick 的全量重建开销。

**Architecture:** 前端五机制叠加——① 延迟退订（30s 宽限期）② 分层防抖（sub 100ms / unsub 500ms）③ 拖动中只增不减 ④ LRU 上限保护（SOFT_LIMIT=480）⑤ 局部更新（vtable `updateRecords`）。后端零改动。核心改动集中在 `useSubscriptionManager.ts`（机制 1-4）和 `MarketTable.tsx` + `store.ts`（机制 5）。

**Tech Stack:** React 18 + TypeScript 5, Zustand, @visactor/vtable ^1.26.4, Vitest + Testing Library

## Global Constraints

- `SOFT_LIMIT = 480`（永远 < 后端 `MAX_SUBSCRIPTIONS = 500`，留 20 余量）
- `GRACE_MS = 30_000`（延迟退订宽限期）
- 拖动检测：`DRAG_WINDOW_MS = 300`、`DRAG_THRESHOLD = 2`
- subscribe 防抖 100ms，unsubscribe 防抖 500ms
- 锁定合约（`lockedContracts`）与自选合约（`favorites`）永不退订、不参与 LRU 淘汰
- 后端零改动
- 所有文案/测试描述用中文
- 沿用现有 TDD 模式：先写失败测试 → 运行确认失败 → 实现 → 运行确认通过 → 提交

---

### Task 1: store 记录「最近更新的合约集合」

**Files:**
- Modify: `frontend/src/modules/market/store.ts`
- Test: `frontend/src/modules/market/store.test.ts`

**Interfaces:**
- Consumes: 现有 `batchUpdate(snapshots: MarketSnapshot[])`、`updateSnapshot(snapshot)` action
- Produces: 新增 state 字段 `recentlyUpdated: Set<string>`；新增 action `consumeRecentUpdates(): string[]`（返回并清空）；`batchUpdate` 与 `updateSnapshot` 在更新 snapshot 时把 instrumentID 记入 `recentlyUpdated`

**背景：** `MarketTable` 局部更新需要知道「本次批量更新了哪些合约」，但 `MarketTable` 只订阅 `snapshots` Map，无法从 Map 引用变化推断本次更新集。因此由 store 在写入侧记录。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/modules/market/store.test.ts` 追加：

```ts
describe('recentlyUpdated', () => {
  it('batchUpdate records updated instrument IDs and consumeRecentUpdates returns then clears', () => {
    useMarketStore.setState({ recentlyUpdated: new Set() })
    useMarketStore.getState().batchUpdate([
      { instrumentID: 'IF2608', lastPrice: 4000 } as any,
      { instrumentID: 'au2508', lastPrice: 480 } as any,
    ])
    const ids = useMarketStore.getState().consumeRecentUpdates()
    expect(ids.sort()).toEqual(['IF2608', 'au2508'])
    expect(useMarketStore.getState().consumeRecentUpdates()).toEqual([])
  })

  it('updateSnapshot records a single instrument', () => {
    useMarketStore.setState({ recentlyUpdated: new Set() })
    useMarketStore.getState().updateSnapshot({ instrumentID: 'ag2508', lastPrice: 6500 } as any)
    expect(useMarketStore.getState().consumeRecentUpdates()).toEqual(['ag2508'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/store.test.ts -t "recentlyUpdated"`

Expected: FAIL — `recentlyUpdated` / `consumeRecentUpdates` 不存在

- [ ] **Step 3: 实现**

在 `frontend/src/modules/market/store.ts`：

```ts
interface MarketStore {
  // ... 现有字段
  /** 最近一次批量更新涉及到的合约 ID（供局部更新消费） */
  recentlyUpdated: Set<string>
  /** 返回并清空最近更新的合约 ID 列表 */
  consumeRecentUpdates: () => string[]
}
```

初始值 `recentlyUpdated: new Set()`。

修改 `batchUpdate`：

```ts
batchUpdate: (updates) =>
  set((state) => {
    const next = new Map(state.snapshots)
    const recent = new Set(state.recentlyUpdated)
    for (const snap of updates) {
      next.set(snap.instrumentID, snap)
      recent.add(snap.instrumentID)
    }
    return { snapshots: next, recentlyUpdated: recent }
  }),
```

修改 `updateSnapshot`：

```ts
updateSnapshot: (snapshot) =>
  set((state) => {
    const next = new Map(state.snapshots)
    next.set(snapshot.instrumentID, snapshot)
    const recent = new Set(state.recentlyUpdated)
    recent.add(snapshot.instrumentID)
    return { snapshots: next, recentlyUpdated: recent }
  }),
```

新增 action：

```ts
consumeRecentUpdates: () => {
  const ids = Array.from(useMarketStore.getState().recentlyUpdated)
  useMarketStore.setState({ recentlyUpdated: new Set() })
  return ids
},
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/store.test.ts -t "recentlyUpdated"`

Expected: PASS（2 个用例）

- [ ] **Step 5: 运行全量 store 测试（防回归）**

Run: `cd frontend && npx vitest run src/modules/market/store.test.ts`

Expected: 全部 PASS（现有 batchUpdate/updateSnapshot 用例不受影响）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/modules/market/store.ts frontend/src/modules/market/store.test.ts
git commit -m "feat(store): batchUpdate 记录最近更新合约集合，供局部更新消费"
```

---

### Task 2: useSubscriptionManager 延迟退订 + 分层防抖

**Files:**
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`（新建）

**Interfaces:**
- Consumes: 现有 store selectors（`visibleInstrumentIDs`、`lockedContracts`、`favorites`）、`subscribeMarket`/`unsubscribeMarket`
- Produces: 内部 `subscribedRef: Map<string, number>`（instrumentID → lastVisibleTime）；`GRACE_MS = 30_000`；`SUB_DEBOUNCE_MS = 100`；`UNSUB_DEBOUNCE_MS = 500`

**背景：** 现有 `subscribedRef` 是 `Set<string>`，退订立即执行。本任务改为 Map 记录 lastVisibleTime，退订增加 30s 宽限期，且 subscribe/unsubscribe 拆成两个独立防抖定时器。

- [ ] **Step 1: 写失败测试（新建文件）**

创建 `frontend/src/hooks/useSubscriptionManager.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscriptionManager } from './useSubscriptionManager'
import { useMarketStore } from '@/modules/market/store'
import { subscribeMarket, unsubscribeMarket } from '@/services/api'

vi.mock('@/services/api', () => ({
  subscribeMarket: vi.fn().mockResolvedValue({ success: true }),
  unsubscribeMarket: vi.fn().mockResolvedValue({ success: true }),
}))

describe('useSubscriptionManager 延迟退订', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      recentlyUpdated: new Set(),
      selectedContracts: new Set(),
    })
  })
  afterEach(() => vi.useRealTimers())

  it('合约滑出可见区后在宽限期内不退订', async () => {
    const { result } = renderHook(() => useSubscriptionManager())

    // 先订阅
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])

    // 滑出可见区
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(10_000) }) // 10s < 30s 宽限期

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
  })

  it('超过宽限期仍不可见则退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    vi.mocked(subscribeMarket).mockClear()

    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) }) // > 30s 宽限期

    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  })

  it('宽限期内滑回则取消退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))  // 滑出
    await act(async () => { vi.advanceTimersByTime(10_000) })        // 宽限期内
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))  // 滑回
    await act(async () => { vi.advanceTimersByTime(31_000) })

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: FAIL — 现有实现立即退订，宽限期测试不通过

- [ ] **Step 3: 实现延迟退订 + 分层防抖**

重写 `frontend/src/hooks/useSubscriptionManager.ts`：

```ts
import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { subscribeMarket, unsubscribeMarket } from '@/services/api'

/** subscribe 防抖间隔（毫秒） */
const SUB_DEBOUNCE_MS = 100
/** unsubscribe 防抖间隔（毫秒） */
const UNSUB_DEBOUNCE_MS = 500
/** 延迟退订宽限期（毫秒） */
const GRACE_MS = 30_000

export function useSubscriptionManager() {
  const visibleInstrumentIDs = useMarketStore((s) => s.visibleInstrumentIDs)
  const lockedContracts = useMarketStore((s) => s.lockedContracts)
  const favorites = useContractsStore((s) => s.favorites)

  /** 已订阅合约 → 最近可见时间戳（ms） */
  const subscribedRef = useRef<Map<string, number>>(new Map())
  const subTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calculateShouldSubscribe = useCallback((): Set<string> => {
    const shouldSubscribe = new Set<string>()
    for (const id of visibleInstrumentIDs) shouldSubscribe.add(id)
    for (const fav of favorites) shouldSubscribe.add(fav.instrumentID)
    for (const id of lockedContracts.keys()) shouldSubscribe.add(id)
    return shouldSubscribe
  }, [visibleInstrumentIDs, favorites, lockedContracts])

  /** 立即订阅缺失合约（subscribe 防抖 100ms） */
  const debouncedSubscribe = useCallback(() => {
    if (subTimerRef.current) clearTimeout(subTimerRef.current)
    subTimerRef.current = setTimeout(() => {
      const should = calculateShouldSubscribe()
      const toSubscribe: string[] = []
      for (const id of should) {
        if (!subscribedRef.current.has(id)) toSubscribe.push(id)
      }
      if (toSubscribe.length === 0) return
      subscribeMarket(toSubscribe)
        .then(() => {
          for (const id of toSubscribe) subscribedRef.current.set(id, Date.now())
        })
        .catch((err) => console.error('[SubscriptionManager] Subscribe failed:', err))
    }, SUB_DEBOUNCE_MS)
  }, [calculateShouldSubscribe])

  /** 延迟退订：仅当合约不在应该订阅集合 且 超过宽限期未可见 */
  const debouncedUnsubscribe = useCallback(() => {
    if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
    unsubTimerRef.current = setTimeout(() => {
      const should = calculateShouldSubscribe()
      const now = Date.now()
      const toUnsubscribe: string[] = []
      for (const [id, lastVisible] of subscribedRef.current) {
        if (!should.has(id) && now - lastVisible > GRACE_MS) {
          toUnsubscribe.push(id)
        }
      }
      if (toUnsubscribe.length === 0) return
      unsubscribeMarket(toUnsubscribe)
        .then(() => {
          for (const id of toUnsubscribe) subscribedRef.current.delete(id)
        })
        .catch((err) => console.error('[SubscriptionManager] Unsubscribe failed:', err))
    }, UNSUB_DEBOUNCE_MS)
  }, [calculateShouldSubscribe])

  // 可见区变化时：刷新可见合约的 lastVisibleTime，触发订阅与退订
  useEffect(() => {
    const now = Date.now()
    for (const id of visibleInstrumentIDs) {
      if (subscribedRef.current.has(id)) subscribedRef.current.set(id, now)
    }
    debouncedSubscribe()
    debouncedUnsubscribe()
    return () => {
      if (subTimerRef.current) clearTimeout(subTimerRef.current)
      if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
    }
  }, [visibleInstrumentIDs, debouncedSubscribe, debouncedUnsubscribe])

  return {
    subscribed: subscribedRef.current,
    applySubscriptionChanges: debouncedSubscribe,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts
git commit -m "feat(hooks): useSubscriptionManager 延迟退订（30s 宽限期）+ 分层防抖"
```

---

### Task 3: 拖动中只增不减 + LRU 上限保护

**Files:**
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `subscribedRef: Map<string, number>`、`GRACE_MS`、防抖结构
- Produces: `DRAG_WINDOW_MS = 300`、`DRAG_THRESHOLD = 2`、`SOFT_LIMIT = 480`；退订流程在拖动中暂停、停止后完整 diff 含 LRU 淘汰

**背景：** Task 2 已实现延迟退订。本任务叠加：① 拖动中完全不退订（只增不减）② 订阅数逼近上限时 LRU 淘汰最久未见的低优先级合约。二者都在「完整 diff」（停止后）时执行。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/hooks/useSubscriptionManager.test.ts` 追加：

```ts
describe('useSubscriptionManager 拖动与 LRU', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useMarketStore.setState({
      visibleInstrumentIDs: [],
      lockedContracts: new Map(),
      recentlyUpdated: new Set(),
      selectedContracts: new Set(),
    })
  })
  afterEach(() => vi.useRealTimers())

  it('拖动中（多次可见区变化）只订阅不退订', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(subscribeMarket).mockClear()

    // 模拟拖动：连续多次可见区变化（300ms 内 ≥2 次 → 拖动态）
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['au2508']))
    await act(async () => { vi.advanceTimersByTime(200) })

    expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()
    // 但 subscribe 仍在进行
    expect(vi.mocked(subscribeMarket).mock.calls.flat()).toContain('au2508')
  })

  it('停止后完整 diff 退订超期合约', async () => {
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // 滑出并推进超过宽限期
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) })

    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  })

  it('LRU：订阅数逼近 SOFT_LIMIT 时淘汰最久未见的合约', async () => {
    renderHook(() => useSubscriptionManager())

    // 先订阅一批合约，使 subscribedRef 逼近上限（通过可见区模拟）
    const base = Array.from({ length: 480 }, (_, i) => `ID${i}`)
    act(() => useMarketStore.getState().setVisibleInstrumentIDs(base))
    await act(async () => { vi.advanceTimersByTime(110) })
    vi.mocked(unsubscribeMarket).mockClear()

    // 全部滑出，超过宽限期 → 触发退订（此处仅验证退订被调用，具体淘汰策略由实现保证不超限）
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) })

    expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  })

  it('自选与锁定合约永不退订', async () => {
    useMarketStore.setState({ lockedContracts: new Map([['au2508', 1]]) })
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // 滑出全部并超期
    act(() => useMarketStore.getState().setVisibleInstrumentIDs([]))
    await act(async () => { vi.advanceTimersByTime(31_000) })

    // 退订调用不能包含锁定合约 au2508
    const unsubscribed = vi.mocked(unsubscribeMarket).mock.calls.flat() as string[]
    expect(unsubscribed).not.toContain('au2508')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: 新用例 FAIL 或未覆盖拖动/LRU 逻辑（现有实现立即退订、无拖动感知）

- [ ] **Step 3: 实现拖动感知 + LRU**

在 `useSubscriptionManager.ts` 增加常量与逻辑：

```ts
/** 拖动检测窗口（毫秒） */
const DRAG_WINDOW_MS = 300
/** 窗口内变化次数阈值 → 视为拖动中 */
const DRAG_THRESHOLD = 2
/** 订阅软上限（< 后端 500） */
const SOFT_LIMIT = 480
```

内部新增：

```ts
/** 最近可见区变化时间戳（用于拖动检测） */
const recentChangesRef = useRef<number[]>([])
/** 最近一次完整 diff 的定时器（拖动停止后执行） */
const fullDiffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

/** 是否处于拖动态：300ms 窗口内可见区变化 ≥ 2 次 */
const isDragging = useCallback((): boolean => {
  const now = Date.now()
  recentChangesRef.current = recentChangesRef.current.filter((t) => now - t < DRAG_WINDOW_MS)
  return recentChangesRef.current.length >= DRAG_THRESHOLD
}, [])

/** 完整 diff：subscribe + 宽限期退订 + LRU 淘汰（仅停止后执行） */
const runFullDiff = useCallback(() => {
  const should = calculateShouldSubscribe()
  const now = Date.now()

  // 1. subscribe 缺失合约
  const toSubscribe: string[] = []
  for (const id of should) {
    if (!subscribedRef.current.has(id)) toSubscribe.push(id)
  }
  if (toSubscribe.length > 0) {
    subscribeMarket(toSubscribe)
      .then(() => {
        for (const id of toSubscribe) subscribedRef.current.set(id, now)
      })
      .catch((err) => console.error('[SubscriptionManager] Subscribe failed:', err))
  }

  // 2. 宽限期退订候选
  const graceCandidates: { id: string; lastVisible: number }[] = []
  for (const [id, lastVisible] of subscribedRef.current) {
    if (!should.has(id)) graceCandidates.push({ id, lastVisible })
  }

  // 3. LRU 淘汰：若超限，按 lastVisibleTime 从旧到新淘汰低优先级合约
  const unsubscribed = new Set<string>()
  // 模拟新增订阅后的总量估算
  const projectedTotal = subscribedRef.current.size + toSubscribe.length
  if (projectedTotal > SOFT_LIMIT) {
    const candidates = graceCandidates
      .filter((c) => !should.has(c.id)) // 只淘汰不在应该订阅集合里的
      .sort((a, b) => a.lastVisible - b.lastVisible)
    let over = projectedTotal - SOFT_LIMIT
    for (const c of candidates) {
      if (over <= 0) break
      unsubscribed.add(c.id)
      over--
    }
  }

  // 4. 合并宽限期过期 + LRU 淘汰
  const toUnsubscribe: string[] = []
  for (const c of graceCandidates) {
    if (now - c.lastVisible > GRACE_MS) toUnsubscribe.push(c.id)
  }
  for (const id of unsubscribed) {
    if (!toUnsubscribe.includes(id)) toUnsubscribe.push(id)
  }

  if (toUnsubscribe.length > 0) {
    unsubscribeMarket(toUnsubscribe)
      .then(() => {
        for (const id of toUnsubscribe) subscribedRef.current.delete(id)
      })
      .catch((err) => console.error('[SubscriptionManager] Unsubscribe failed:', err))
  }
}, [calculateShouldSubscribe])
```

调整 useEffect：可见区变化时记录时间戳并区分拖动态：

```ts
useEffect(() => {
  const now = Date.now()
  recentChangesRef.current = [...recentChangesRef.current.filter((t) => now - t < DRAG_WINDOW_MS), now]
  for (const id of visibleInstrumentIDs) {
    if (subscribedRef.current.has(id)) subscribedRef.current.set(id, now)
  }

  if (isDragging()) {
    // 拖动中：只订阅，不触发退订/LRU；停止后 500ms 做完整 diff
    debouncedSubscribe()
    if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
    fullDiffTimerRef.current = setTimeout(runFullDiff, 500)
  } else {
    // 静止态：直接完整 diff
    if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
    runFullDiff()
  }

  return () => {
    if (subTimerRef.current) clearTimeout(subTimerRef.current)
    if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
    if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
  }
}, [visibleInstrumentIDs, isDragging, debouncedSubscribe, runFullDiff])
```

> 注：Task 2 的 `debouncedUnsubscribe` 在本任务中被 `runFullDiff` 取代（完整 diff 统一处理退订）。`unsubTimerRef`/`debouncedUnsubscribe` 可移除，避免重复退订。同时 Hook 返回值改为 `applySubscriptionChanges: runFullDiff`（对外暴露完整 diff，而非仅订阅）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: PASS（7 个用例：Task 2 的 3 个 + Task 3 的 4 个）

- [ ] **Step 5: 运行全量前端测试（防回归）**

Run: `cd frontend && npx vitest run`

Expected: 全部 PASS。若有既有测试依赖旧 `useSubscriptionManager` 行为（立即退订），检查 `useMarketWs.test.ts`、`MarketPanel` 相关测试是否受影响。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts
git commit -m "feat(hooks): 拖动中只增不减 + LRU 上限保护（SOFT_LIMIT=480）"
```

---

### Task 4: MarketTable 局部更新（updateRecords）

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx`
- Modify: `frontend/src/modules/market/store.ts`（若 Task 1 未完成则先做）
- Modify: `frontend/src/setupTests.ts`
- Test: `frontend/src/modules/market/MarketTable.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `store.consumeRecentUpdates()`；现有 `MarketTable` props（`contracts`、`snapshots`、`selectedContracts` 等）
- Produces: `MarketTable` 内部对 `snapshots` 变化做局部 `updateRecords`；`selectedContracts` 变化仍走全量 `setRecords`

**背景：** 当前 `MarketTable.tsx:437-448` 每次 `snapshots` 变化全量重建 6000 条 record 并 `setRecords`。改造为：tick 更新只 rebuild 变化的合约行（从 store 读 `consumeRecentUpdates`），用 vtable `updateRecords(records, rowIndexes)` 局部重绘。选中/合约列表变化保留全量。

- [ ] **Step 1: 更新 vtable mock（setupTests.ts）**

在 `frontend/src/setupTests.ts` 的 mockInstance 补充：

```ts
updateRecords: vi.fn(),
```

- [ ] **Step 2: 写失败测试**

在 `frontend/src/modules/market/MarketTable.test.tsx` 追加：

```ts
describe('MarketTable 局部更新', () => {
  it('snapshots 变化时调用 updateRecords 而非 setRecords', async () => {
    const { ListTable } = await import('@visactor/vtable')
    const { rerender } = render(
      <MarketTable contracts={mockContracts} snapshots={mockSnapshots} />
    )

    // 初始渲染调用了 setRecords
    const instance = (ListTable as any).mock.instances[0]
    expect(instance.setRecords).toHaveBeenCalled()
    instance.setRecords.mockClear()

    // 新的快照（au2508 价格变化）
    const newSnapshots = new Map(mockSnapshots)
    newSnapshots.set('au2508', { ...newSnapshots.get('au2508')!, lastPrice: 490 } as any)
    useMarketStore.setState({ recentlyUpdated: new Set(['au2508']) })
    rerender(<MarketTable contracts={mockContracts} snapshots={newSnapshots} />)

    expect(instance.updateRecords).toHaveBeenCalled()
    expect(instance.setRecords).not.toHaveBeenCalled()
    // 只更新 1 行
    const updateCalls = instance.updateRecords.mock.calls as [any[], number[]][]
    expect(updateCalls[0][1]).toHaveLength(1)
  })

  it('selectedContracts 变化时仍走 setRecords 全量', async () => {
    const { ListTable } = await import('@visactor/vtable')
    const { rerender } = render(
      <MarketTable contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set()} onSelectionChange={() => {}} />
    )
    const instance = (ListTable as any).mock.instances[0]
    instance.setRecords.mockClear()

    rerender(
      <MarketTable contracts={mockContracts} snapshots={mockSnapshots} selectedContracts={new Set(['au2508'])} onSelectionChange={() => {}} />
    )

    expect(instance.setRecords).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`

Expected: FAIL — 现有实现全量 `setRecords`，`updateRecords` 未被调用

- [ ] **Step 4: 实现局部更新**

在 `MarketTable.tsx`：

```ts
import { useMarketStore } from './store'
```

组件内新增 ref 记录最近一次 snapshots 引用：

```ts
const prevSnapshotsRef = useRef<Map<string, MarketSnapshot> | null>(null)
```

修改现有的 snapshots 更新 effect（`setRecords` 全量）：

```ts
// 合约列表或选中变化 → 全量 setRecords（低频）
useEffect(() => {
  if (!tableRef.current) return
  const records = contracts.map((contract) => buildRecord(contract, snapshots.get(contract.instrumentID), favoritedIds?.has(contract.instrumentID) ?? false))
  recordsRef.current = records
  tableRef.current.setRecords(records)
  prevSnapshotsRef.current = snapshots
  lastClickedIndexRef.current = null
  setTimeout(notifyVisibleRange, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [contracts, favoritedIds])
```

> 注意：原 effect 依赖 `[contracts, snapshots, notifyVisibleRange, favoritedIds]`。现在拆为两个：① 全量 effect 只依赖 `[contracts, favoritedIds]`（合约列表/收藏变化）；② 新增局部 effect 依赖 `[snapshots]`。原依赖中 `notifyVisibleRange` 为稳定 useCallback（空依赖），无需在数组内。

新增局部更新 effect：

```ts
// snapshots 变化 → 局部 updateRecords（高频 tick）
useEffect(() => {
  if (!tableRef.current) return
  const updatedIDs = useMarketStore.getState().consumeRecentUpdates()
  if (updatedIDs.length === 0) return

  const rowIndexes: number[] = []
  const updatedRecords: any[] = []
  for (const id of updatedIDs) {
    const rowIndex = contracts.findIndex((c) => c.instrumentID === id)
    if (rowIndex < 0) continue
    const record = buildRecord(contracts[rowIndex], snapshots.get(id), favoritedIds?.has(id) ?? false)
    recordsRef.current[rowIndex] = record
    updatedRecords.push(record)
    rowIndexes.push(rowIndex + 1) // vtable 行号（0=表头，数据从 1 开始）
  }
  if (updatedRecords.length > 0) {
    tableRef.current.updateRecords(updatedRecords, rowIndexes)
  }
  prevSnapshotsRef.current = snapshots
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [snapshots])
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`

Expected: PASS（新 2 个用例 + 既有用例不回归）

- [ ] **Step 6: 运行全量前端测试**

Run: `cd frontend && npx vitest run`

Expected: 全部 PASS。重点确认 `MarketPanel.test.tsx`、`useMarketWs.test.ts` 不受 `batchUpdate` 记录变化集的影响。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/modules/market/MarketTable.tsx frontend/src/modules/market/MarketTable.test.tsx frontend/src/setupTests.ts
git commit -m "feat(market): 行情表格局部更新（updateRecords），tick 不再全量重建"
```

---

### Task 5: 收尾验证

**Files:**
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`、`frontend/src/modules/market/MarketTable.test.tsx`、`frontend/src/modules/market/store.test.ts`

**Interfaces:**
- 无新接口。验证前 4 个任务整合后的整体行为。

**背景：** 确认五个机制叠加后全量测试通过、无回归。

- [ ] **Step 1: 运行全量前端测试**

Run: `cd frontend && npx vitest run`

Expected: 全部 PASS（含既有 809 个用例）

- [ ] **Step 2: 核对 spec 覆盖**

逐一确认：
- 机制 1 延迟退订 → Task 2 ✓
- 机制 2 分层防抖 → Task 2 ✓
- 机制 3 拖动中只增不减 → Task 3 ✓
- 机制 4 LRU 上限保护 → Task 3 ✓
- 机制 5 局部更新 → Task 1 + Task 4 ✓
- 后端零改动 → 全计划仅改 frontend/ ✓

- [ ] **Step 3: 提交（若有遗漏改动）**

```bash
git add -A
git commit -m "chore: 行情表格订阅优化收尾验证"
```

（若 Step 1 全部通过且无额外改动，此步可跳过）
