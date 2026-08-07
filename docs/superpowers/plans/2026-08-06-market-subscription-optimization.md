# 行情表格订阅优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除行情表格拖动时的订阅/退订抖动、大幅降低请求量、永不触顶 500 上限，并减少每次 WS tick 的全量重建开销。

**Architecture:** 前端六机制叠加——① 延迟退订（30s 宽限期）② 停止后统一完整 diff ③ 拖动中零 HTTP（不订不退）④ LRU 上限保护（SOFT_LIMIT=480）+ 退订先行串行化兜底 ⑤ 局部更新（vtable `updateRecords`）⑥ 快照回填（方案 A）。后端零改动。核心改动集中在 `useSubscriptionManager.ts`（机制 1-4、6）和 `MarketTable.tsx` + `store.ts`（机制 5）。

**Tech Stack:** React 18 + TypeScript 5, Zustand, @visactor/vtable ^1.26.4, Vitest + Testing Library

## Global Constraints

- `SOFT_LIMIT = 480`（永远 < 后端 `MAX_SUBSCRIPTIONS = 500`，留 20 余量）
- `GRACE_MS = 30_000`（延迟退订宽限期）
- 拖动检测：`DRAG_WINDOW_MS = 300`、`DRAG_THRESHOLD = 2`
- 拖动中零 HTTP（不订不退）；订阅只在完整 diff 触发（非拖动变化立即、拖动停止后 500ms）
- 退订先行串行化兜底：`subscribedRef.size + 新增订阅 > SOFT_LIMIT` 时，先 await 退订（后端确认）再订阅
- 锁定合约（`lockedContracts`）与自选合约（`favorites`）永不退订、不参与 LRU 淘汰
- 后端零改动（快照回填复用后端已有 `/api/market/snapshots` 接口与 `_snapshots` 缓存）
- 快照回填（方案 A）：subscribe 成功后立即 `getSnapshots(订阅列表)`，用缓存快照先填表，实时 tick 覆盖；失败静默
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
- 机制 6 快照回填 → Task 6 ✓
- 后端零改动 → 全计划仅改 frontend/ ✓

- [ ] **Step 3: 提交（若有遗漏改动）**

```bash
git add -A
git commit -m "chore: 行情表格订阅优化收尾验证"
```

（若 Step 1 全部通过且无额外改动，此步可跳过）

---

### Task 6: 快照回填（方案 A）

**Files:**
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`

**Interfaces:**
- Consumes: 现有 `subscribeMarket`/`unsubscribeMarket`、`getSnapshots`（`@/services/api`）、`useMarketStore.getState().batchUpdate`
- Produces: subscribe 成功回调内新增「回填缓存快照」动作——对 `toSubscribe` 调 `getSnapshots(toSubscribe)`，返回的 `{ snapshots }` 转 `MarketSnapshot[]` 经 `batchUpdate` 写入 store

**背景：** 订阅停止后要等 CTP 异步回包才有数据，期间表格显示 `--`。方案 A：subscribe 成功后立即 `getSnapshots(订阅列表)`，用后端 `_snapshots` 缓存里已有的最后快照先填表，实时 tick 再覆盖。后端 `_snapshots` 缓存持续存在（订阅/退订不清缓存），任何 tick 过的合约缓存里都有最后价格。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/hooks/useSubscriptionManager.test.ts` 追加：

```ts
describe('useSubscriptionManager 快照回填（方案 A）', () => {
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

  it('订阅成功后调用 getSnapshots 回填缓存快照', async () => {
    const getSnapshotsMock = vi.mocked(getSnapshots)
    getSnapshotsMock.mockResolvedValue({ snapshots: { IF2608: { instrumentID: 'IF2608', lastPrice: 4000 } } } as any)
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    // subscribe 已调用
    expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
    // 回填：getSnapshots 收到订阅的合约
    expect(getSnapshotsMock).toHaveBeenCalledWith(['IF2608'])
    // 快照写入 store
    expect(useMarketStore.getState().snapshots.get('IF2608')?.lastPrice).toBe(4000)
  })

  it('getSnapshots 失败时静默，不抛错', async () => {
    const getSnapshotsMock = vi.mocked(getSnapshots)
    getSnapshotsMock.mockRejectedValue(new Error('network'))
    renderHook(() => useSubscriptionManager())

    act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
    await act(async () => { vi.advanceTimersByTime(110) })

    expect(getSnapshotsMock).toHaveBeenCalled()
    // 不抛错（测试通过即证明静默）
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: FAIL — 当前实现 subscribe 成功后未调用 `getSnapshots`

- [ ] **Step 3: 实现快照回填**

在 `frontend/src/hooks/useSubscriptionManager.ts`：

1. **新增 import**：

```ts
import { subscribeMarket, unsubscribeMarket, getSnapshots } from '@/services/api'
```

2. **新增回填函数**：

```ts
/** 方案 A：订阅成功后立即拉后端缓存快照填表，实时 tick 再覆盖；失败静默 */
const prefetchSnapshots = useCallback((ids: string[]) => {
  if (ids.length === 0) return
  getSnapshots(ids)
    .then(({ snapshots }) => {
      const snaps = Object.values(snapshots)
      if (snaps.length > 0) {
        useMarketStore.getState().batchUpdate(snaps)
      }
    })
    .catch(() => {
      // 静默：缓存回填失败不影响订阅，实时 tick 兜底
    })
}, [])
```

3. **在 subscribe 成功回调里触发**（`debouncedSubscribe` 与 `runFullDiff` 两处的 `.then` 内、`subscribedRef.set` 之后）：

```ts
if (resp?.success) {
  for (const id of toSubscribe) subscribedRef.current.set(id, Date.now())
  prefetchSnapshots(toSubscribe)  // 方案 A：回填缓存快照
  // ... 既有 LRU 逻辑
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: PASS（原 8 个 + 新增 2 个 = 10 个）

- [ ] **Step 5: 运行全量前端测试（防回归）**

Run: `cd frontend && npx vitest run`

Expected: 全部 PASS。确认 `getSnapshots` 的 mock 覆盖不破坏既有 useSubscriptionManager 测试（`@/services/api` 的 mock 需补充 `getSnapshots: vi.fn()`，可放在测试文件顶部 `vi.mock('@/services/api', ...)` 中）。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts
git commit -m "feat(hooks): 订阅成功后回填缓存快照（方案A），减少停止后填表等待"
```

---

### Task 7: 拖动中零 HTTP + 退订先行串行化兜底

**Files:**
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`
- Test: `frontend/src/hooks/useSubscriptionManager.test.ts`

**Interfaces:**
- Consumes: 现有 `subscribedRef: Map<string, number>`、`GRACE_MS`、`DRAG_WINDOW_MS`、`DRAG_THRESHOLD`、`SOFT_LIMIT`、`computeLruEvictions`、`doUnsubscribe`、`prefetchSnapshots`、`subscribeMarket`/`unsubscribeMarket`/`getSnapshots`
- Produces: 拖动中零 HTTP（isDragging 分支不再订阅）；`runFullDiff` 内「退订先行」串行化兜底

**背景：** 修复「拖动进度条到底时底部合约卡旧数据不刷新」的竞态 bug。

根因：拖动中每次可见区变化都订阅（`debouncedSubscribe`），`subscribedRef` 经 LRU 稳定在 480；但 LRU 退订是异步 HTTP、与后续订阅无顺序约束。后端 `subscribe()` 的 500 上限检查是「请求到达时刻」的原子快照，当底部合约的订阅在后端 `_subscriptions` 仍近 500 时到达，即被整批拒绝（`success:false`），不入 `subscribedRef`、不触发 `getSnapshots` 回填，显示旧缓存直到下次 diff 重试成功（几秒后）。

修复：① **拖动中零 HTTP**——用户拖动时不关注快速略过的合约，`isDragging()` 分支不再订阅，只调度 500ms 后的 `runFullDiff`；`subscribedRef` 不再随拖动膨胀，拖到底部只是新增底部窗口，后端名额充足，竞态消失。② **退订先行串行化兜底**——`runFullDiff` 中当 `subscribedRef.size + 新增订阅 > SOFT_LIMIT`（需腾名额）时，先 await 退订（后端确认）再订阅，保证订阅到达时后端已腾空；否则订阅与退订并行（保持现状，不加延迟）。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/hooks/useSubscriptionManager.test.ts`：

**a. 改写「拖动中只订阅不退订」测试为「拖动中零 HTTP」：**

```ts
it('拖动中既不订阅也不退订，停止后才订阅最终可见区', async () => {
  renderHook(() => useSubscriptionManager())

  // 初始静止订阅
  act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
  await act(async () => { vi.advanceTimersByTime(110) })
  vi.mocked(subscribeMarket).mockClear()
  vi.mocked(unsubscribeMarket).mockClear()

  // 模拟快速拖动：300ms 内 ≥2 次变化 → 拖动态，零 HTTP
  act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608', 'au2508']))
  await act(async () => { vi.advanceTimersByTime(200) })
  act(() => useMarketStore.getState().setVisibleInstrumentIDs(['au2508']))
  await act(async () => { vi.advanceTimersByTime(200) })

  // 拖动中零 HTTP：无 subscribe、无 unsubscribe
  expect(vi.mocked(subscribeMarket)).not.toHaveBeenCalled()
  expect(vi.mocked(unsubscribeMarket)).not.toHaveBeenCalled()

  // 停止后 500ms 完整 diff → 订阅最终可见区 au2508
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(vi.mocked(subscribeMarket)).toHaveBeenCalled()
  const subbed = vi.mocked(subscribeMarket).mock.calls.flat(2) as string[]
  expect(subbed).toContain('au2508')
})
```

**b. 新增「退订先行串行化兜底」测试：**

```ts
it('新批次超 SOFT_LIMIT 时退订先行再订阅（串行化兜底）', async () => {
  renderHook(() => useSubscriptionManager())

  // 先把 subscribedRef 灌到 SOFT_LIMIT（480）
  const base = Array.from({ length: 480 }, (_, i) => `ID${i}`)
  act(() => useMarketStore.getState().setVisibleInstrumentIDs(base))
  await act(async () => { vi.advanceTimersByTime(110) })
  vi.mocked(subscribeMarket).mockClear()
  vi.mocked(unsubscribeMarket).mockClear()

  // 全部滑出 + 滑入 3 个新合约 → 480 + 3 > 480 → 需要腾名额
  act(() => useMarketStore.getState().setVisibleInstrumentIDs(['NEW1', 'NEW2', 'NEW3']))
  await act(async () => { vi.advanceTimersByTime(110) })
  await act(async () => { vi.advanceTimersByTime(500) })

  // 退订先行：unsubscribeMarket 先于 subscribeMarket 调用
  expect(vi.mocked(unsubscribeMarket)).toHaveBeenCalled()
  expect(vi.mocked(subscribeMarket)).toHaveBeenCalled()
  const unsubFirst = vi.mocked(unsubscribeMarket).mock.invocationCallOrder[0]
  const subFirst = vi.mocked(subscribeMarket).mock.invocationCallOrder[0]
  expect(subFirst).toBeGreaterThan(unsubFirst)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: FAIL — 现状拖动中会订阅（零 HTTP 断言不通过）；串行化测试中 subscribe 先于 unsubscribe 调用（invocationCallOrder 断言不通过）。

- [ ] **Step 3: 实现**

在 `frontend/src/hooks/useSubscriptionManager.ts`：

1. **删除死代码**：`SUB_DEBOUNCE_MS` 常量、`subTimerRef`、`debouncedSubscribe` 函数（拖动路径不再订阅）。已确认无外部依赖（grep 全仓库仅本文件使用）。

2. **effect 拖动态分支**：去掉 `debouncedSubscribe()` 调用，只保留调度 500ms 后 `runFullDiff`：

```ts
if (isDragging()) {
  // 拖动中零 HTTP：不订阅不退订，只调度停止后的完整 diff
  if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
  fullDiffTimerRef.current = setTimeout(runFullDiff, 500)
} else {
  // 静止态：直接完整 diff
  if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
  runFullDiff()
}
```

effect 依赖数组去掉 `debouncedSubscribe`（→ `[visibleInstrumentIDs, isDragging, runFullDiff]`），cleanup 去掉 `subTimerRef` 清理。

3. **`doUnsubscribe` 改为返回 `Promise<void>`**（成功时从 `subscribedRef` 删除、失败静默），供串行化路径 await 链使用：

```ts
const doUnsubscribe = useCallback((ids: string[]): Promise<void> => {
  if (ids.length === 0) return Promise.resolve()
  return unsubscribeMarket(ids)
    .then((resp) => {
      if (resp?.success) {
        for (const id of ids) subscribedRef.current.delete(id)
      }
    })
    .catch((err) => console.error('[SubscriptionManager] Unsubscribe failed:', err))
}, [])
```

4. **`runFullDiff` 重构**：抽出 `subscribeNow`（success 门控 + 快照回填），新增「退订先行」串行化兜底：

```ts
const runFullDiff = useCallback(() => {
  const should = calculateShouldSubscribe()
  const now = Date.now()

  // 1. 需要订阅的缺失合约
  const toSubscribe: string[] = []
  for (const id of should) {
    if (!subscribedRef.current.has(id)) toSubscribe.push(id)
  }

  // 2. 宽限期退订候选 + 记录最早到期时间（到期重排）
  const graceCandidates: { id: string; lastVisible: number }[] = []
  let nextCheckIn: number | null = null
  for (const [id, lastVisible] of subscribedRef.current) {
    if (should.has(id)) continue
    const elapsed = now - lastVisible
    graceCandidates.push({ id, lastVisible })
    if (elapsed <= GRACE_MS) {
      const remaining = GRACE_MS - elapsed + 1
      if (nextCheckIn === null || remaining < nextCheckIn) nextCheckIn = remaining
    }
  }

  // 3. 合并退订集：宽限期过期 + LRU 上限淘汰
  const toUnsubscribe = new Set<string>()
  for (const c of graceCandidates) {
    if (now - c.lastVisible > GRACE_MS) toUnsubscribe.add(c.id)
  }
  for (const id of computeLruEvictions(should, toSubscribe.length)) {
    toUnsubscribe.add(id)
  }
  const unsubscribeIds = Array.from(toUnsubscribe)

  // 4. 订阅动作（success 门控 + 快照回填），供串行化/并行共用
  const subscribeNow = (ids: string[]) => {
    if (ids.length === 0) return
    subscribeMarket(ids)
      .then((resp) => {
        if (resp?.success) {
          for (const id of ids) subscribedRef.current.set(id, Date.now())
          prefetchSnapshots(ids)
        }
      })
      .catch((err) => console.error('[SubscriptionManager] Subscribe failed:', err))
  }

  // 5. 退订先行（串行化兜底）：新批次会顶到 SOFT_LIMIT 时，
  //    先等退订（后端确认腾出名额）再订阅，规避后端 500 上限原子整批拒绝；
  //    平时（无需腾名额）订阅与退订并行，不加延迟
  const needRoom = subscribedRef.current.size + toSubscribe.length > SOFT_LIMIT
  if (needRoom && unsubscribeIds.length > 0) {
    doUnsubscribe(unsubscribeIds).then(() => subscribeNow(toSubscribe))
  } else {
    subscribeNow(toSubscribe)
    if (unsubscribeIds.length > 0) doUnsubscribe(unsubscribeIds)
  }

  // 6. 宽限期尚未到期的合约：等到期后再检查一次（到期重排链）
  if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
  unsubTimerRef.current = nextCheckIn !== null
    ? setTimeout(() => runFullDiffRef.current(), nextCheckIn)
    : null
}, [calculateShouldSubscribe, computeLruEvictions, doUnsubscribe, prefetchSnapshots])
```

> 说明：第 6 步改为「有 nextCheckIn 则调度、无则清空」，避免滑回可见的合约留下陈旧 timer。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/hooks/useSubscriptionManager.test.ts`

Expected: PASS（改写 1 个 + 新增 1 个 + 既有全部通过，共 11 个）

- [ ] **Step 5: 运行全量前端测试（防回归）**

Run: `cd frontend && npx vitest run`

Expected: 全部 PASS。确认无其他文件依赖 `debouncedSubscribe`/`SUB_DEBOUNCE_MS`（已 grep 确认仅本文件使用）。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts
git commit -m "fix(hooks): 拖动中零 HTTP + 退订先行串行化兜底，修复拖动到底不刷新"
```
