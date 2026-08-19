# Settings & Order-Trigger Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the settings page — remove offline features (一键反向/锁仓 hotkeys + 快捷交易 tab), wire the 3 navigation hotkeys to actually open floating windows, and add a new shared "下单触发" (order trigger) setting (单击/双击 + 是否二次确认) applied to the 五档 & 无限 order ladders.

**Architecture:** Two `useHotKeys` instances (App-layer for navigation → open floating windows; OrderPanel-layer for batchCancel). New `OrderTriggerConfig` in the userPrefs store consumed by a new `useOrderTrigger()` hook used by both `MarketDepth.tsx` and `InfiniteLadder.tsx`. Settings page keeps its Tab structure: 快捷键 / 下单触发.

**Tech Stack:** React 18, TypeScript 5, Zustand, Vitest, React Testing Library, @visactor/vtable

## Global Constraints

- Frontend only — no backend changes.
- Keep `QuickTradeConfig` *type* in `types.ts` (still used by OrderPanel/API), but remove `quickTradeConfig` *state* from the store.
- Keep `reversePosition`/`lockPosition` API functions (still used by TradeParams/InfiniteTradeParams). Do NOT remove them.
- Don't touch: OrderPanel/QuickActions reverse-lock buttons, MarketDepth QuickTradeBar (stays single-click + confirm), MarketDepth price-column (fills edit box).
- All tests must pass after each task.

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/src/services/types.ts` |
| Modify | `frontend/src/stores/userPrefs.ts` |
| Create | `frontend/src/hooks/useOrderTrigger.ts` |
| Modify | `frontend/src/hooks/useHotKeys.ts` |
| Create | `frontend/src/hooks/useOrderTrigger.test.ts` |
| Modify | `frontend/src/hooks/useHotKeys.test.ts` |
| Modify | `frontend/src/stores/userPrefs.test.ts` |
| Modify | `frontend/src/components/SettingsPanel/HotKeyTab.tsx` |
| Create | `frontend/src/components/SettingsPanel/OrderTriggerTab.tsx` |
| Create | `frontend/src/components/SettingsPanel/OrderTriggerTab.test.tsx` |
| Delete | `frontend/src/components/SettingsPanel/QuickTradeTab.tsx` |
| Modify | `frontend/src/pages/SettingsPage.tsx` |
| Modify | `frontend/src/pages/SettingsPage.test.tsx` |
| Modify | `frontend/src/components/SettingsPanel/index.tsx` |
| Modify | `frontend/src/components/SettingsPanel/index.test.tsx` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/modules/order/OrderPanel.tsx` |
| Modify | `frontend/src/modules/order/MarketDepth.tsx` |
| Modify | `frontend/src/modules/order/MarketDepth.test.tsx` |
| Modify | `frontend/src/modules/infinite/InfiniteLadder.tsx` |
| Modify | `frontend/src/modules/infinite/InfiniteLadder.test.tsx` |

---

### Task 1: Types — Add OrderTriggerConfig, slim HotKeyConfig

**Files:**
- Modify: `frontend/src/services/types.ts`

**Interfaces:**
- Produces: `OrderTriggerConfig` type; `HotKeyConfig` with 4 fields; `QuickTradeConfig` retained unchanged.

- [ ] **Step 1: Add `OrderTriggerConfig` after the `QuickTradeConfig` definition**

In `frontend/src/services/types.ts` (around lines 333-374), add:

```typescript
/** 盘口下单触发设置（五档/无限下单共用） */
export interface OrderTriggerConfig {
  /** 触发方式：single=单击触发；double=单击预览、双击触发 */
  triggerMode: 'single' | 'double'
  /** 是否二次确认：true=触发后弹确认框；false=触发后直接下单 */
  confirmBeforeOrder: boolean
}
```

- [ ] **Step 2: Slim `HotKeyConfig` to 4 fields**

Replace the existing `HotKeyConfig` interface (currently around lines 333-346) with:

```typescript
export interface HotKeyConfig {
  /** 打开报单（浮动窗） */
  openOrder: string
  /** 打开K线（浮动窗） */
  openKline: string
  /** 打开设置（浮动窗） */
  openSettings: string
  /** 批量撤单 */
  batchCancel: string
}
```

Keep `QuickTradeConfig` untouched.

- [ ] **Step 3: Verify with TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: Type errors will be reported because consumers still reference old fields — this is expected; they are fixed in subsequent tasks. Note which files error for later. (If many errors, that's fine — Task 4 fixes consumers.)

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/services/types.ts
git commit -m "feat(settings): add OrderTriggerConfig type, slim HotKeyConfig to 4 fields"
```

---

### Task 2: Store — Add orderTrigger state, remove quickTradeConfig

**Files:**
- Modify: `frontend/src/stores/userPrefs.ts`
- Modify: `frontend/src/stores/userPrefs.test.ts`

**Interfaces:**
- Consumes: `OrderTriggerConfig`, `HotKeyConfig` from Task 1.
- Produces: `DEFAULT_HOT_KEYS` (4 keys), `DEFAULT_ORDER_TRIGGER`, `orderTrigger` state + `setOrderTrigger` action; `quickTradeConfig`/`DEFAULT_QUICK_TRADE_CONFIG`/`setQuickTradeConfig` removed.

- [ ] **Step 1: Rewrite the store defaults and state**

Replace `DEFAULT_HOT_KEYS` (lines 7-19) with:

```typescript
export const DEFAULT_HOT_KEYS: HotKeyConfig = {
  openOrder: 'o',
  openKline: 'k',
  openSettings: ',',
  batchCancel: 'Escape',
}

export const DEFAULT_ORDER_TRIGGER: OrderTriggerConfig = {
  triggerMode: 'single',
  confirmBeforeOrder: true,
}
```

Delete `DEFAULT_QUICK_TRADE_CONFIG` (lines 21-41) entirely.

Update imports (line 2) — remove `QuickTradeConfig`:

```typescript
import type { HotKeyConfig, OrderTriggerConfig } from '@/services/types'
```

- [ ] **Step 2: Update store interface and implementation**

Replace the `UserPrefsStore` interface (lines 43-53) and `create(...)` body (lines 55-92) with:

```typescript
interface UserPrefsStore {
  collections: Collection[]
  hotKeys: HotKeyConfig
  orderTrigger: OrderTriggerConfig
  setHotKey: (action: string, key: string) => void
  setHotKeys: (hotKeys: HotKeyConfig) => void
  setOrderTrigger: (config: OrderTriggerConfig) => void
  setCollections: (collections: Collection[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useUserPrefsStore = create<UserPrefsStore>((set, get) => ({
  collections: [],
  hotKeys: { ...DEFAULT_HOT_KEYS },
  orderTrigger: { ...DEFAULT_ORDER_TRIGGER },

  setHotKey: (action, key) =>
    set((state) => ({ hotKeys: { ...state.hotKeys, [action]: key } })),
  setHotKeys: (hotKeys) => set({ hotKeys: { ...hotKeys } }),
  setOrderTrigger: (config) => set({ orderTrigger: { ...config } }),
  setCollections: (collections) => set({ collections }),

  saveToLocalStorage: () => {
    const { collections, hotKeys, orderTrigger } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collections, hotKeys, orderTrigger }))
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      let collections: Collection[] = Array.isArray(data.collections) ? data.collections : []
      // 迁移：旧版 selectedContracts（扁平收藏） → 默认收藏夹（仅当无 collections 时）
      const legacy = Array.isArray(data.selectedContracts) ? data.selectedContracts : []
      if (collections.length === 0 && legacy.length > 0) {
        collections = [{ id: 'coll-default', name: '默认收藏夹', instrumentIDs: legacy }]
      }
      set({
        collections,
        hotKeys: data.hotKeys ?? { ...DEFAULT_HOT_KEYS },
        orderTrigger: data.orderTrigger ?? { ...DEFAULT_ORDER_TRIGGER },
      })
    } catch {
      // localStorage 数据损坏时忽略
    }
  },
}))
```

- [ ] **Step 3: Update userPrefs tests**

Rewrite `frontend/src/stores/userPrefs.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from './userPrefs'

const STORAGE_KEY = 'simnow-user-prefs'

describe('useUserPrefsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
  })

  it('初始状态：默认快捷键配置（4 个导航/批量撤单）', () => {
    const { hotKeys } = useUserPrefsStore.getState()
    expect(hotKeys.openOrder).toBe('o')
    expect(hotKeys.openKline).toBe('k')
    expect(hotKeys.openSettings).toBe(',')
    expect(hotKeys.batchCancel).toBe('Escape')
  })

  it('初始状态：默认下单触发 = 单击 + 二次确认', () => {
    const { orderTrigger } = useUserPrefsStore.getState()
    expect(orderTrigger).toEqual({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('setHotKey 更新指定动作的快捷键', () => {
    useUserPrefsStore.getState().setHotKey('openOrder', 'F1')
    expect(useUserPrefsStore.getState().hotKeys.openOrder).toBe('F1')
  })

  it('saveToLocalStorage 持久化到 localStorage', () => {
    useUserPrefsStore.getState().setHotKey('openOrder', 'F1')
    useUserPrefsStore.getState().saveToLocalStorage()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.hotKeys.openOrder).toBe('F1')
  })

  it('setOrderTrigger 更新并持久化', () => {
    useUserPrefsStore.getState().setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    useUserPrefsStore.getState().saveToLocalStorage()
    expect(useUserPrefsStore.getState().orderTrigger).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.orderTrigger).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
  })

  it('loadFromLocalStorage 从 localStorage 恢复状态', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hotKeys: { openOrder: 'F2', openKline: 'k', openSettings: ',', batchCancel: 'Escape' } })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    const state = useUserPrefsStore.getState()
    expect(state.hotKeys.openOrder).toBe('F2')
  })

  it('loadFromLocalStorage localStorage 为空时保持默认值', () => {
    useUserPrefsStore.getState().loadFromLocalStorage()
    const state = useUserPrefsStore.getState()
    expect(state.hotKeys).toEqual(DEFAULT_HOT_KEYS)
    expect(state.orderTrigger).toEqual(DEFAULT_ORDER_TRIGGER)
  })
})

describe('useUserPrefsStore collections', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({ collections: [], hotKeys: { ...DEFAULT_HOT_KEYS }, orderTrigger: { ...DEFAULT_ORDER_TRIGGER } })
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
      JSON.stringify({ selectedContracts: ['au2406', 'rb2406'], hotKeys: { openOrder: 'F2' } })
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

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test -- --run stores/userPrefs.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/stores/userPrefs.ts src/stores/userPrefs.test.ts
git commit -m "feat(settings): add orderTrigger state, remove quickTradeConfig from store"
```

---

### Task 3: useOrderTrigger hook

**Files:**
- Create: `frontend/src/hooks/useOrderTrigger.ts`
- Create: `frontend/src/hooks/useOrderTrigger.test.ts`

**Interfaces:**
- Consumes: `useUserPrefsStore`.
- Produces: `useOrderTrigger(): OrderTriggerConfig` — reactive selector.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useOrderTrigger.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderTrigger } from './useOrderTrigger'
import { useUserPrefsStore, DEFAULT_ORDER_TRIGGER } from '@/stores/userPrefs'

describe('useOrderTrigger', () => {
  beforeEach(() => {
    useUserPrefsStore.setState({ orderTrigger: { ...DEFAULT_ORDER_TRIGGER } })
  })

  it('returns default orderTrigger config', () => {
    const { result } = renderHook(() => useOrderTrigger())
    expect(result.current).toEqual({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('re-renders with updated store value', () => {
    const { result } = renderHook(() => useOrderTrigger())
    useUserPrefsStore.getState().setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    expect(result.current).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run hooks/useOrderTrigger.test.ts`
Expected: FAIL — cannot resolve `./useOrderTrigger`

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useOrderTrigger.ts`:

```typescript
import { useUserPrefsStore } from '@/stores/userPrefs'
import type { OrderTriggerConfig } from '@/services/types'

/** 读取盘口下单触发设置（五档/无限下单共用） */
export function useOrderTrigger(): OrderTriggerConfig {
  return useUserPrefsStore((s) => s.orderTrigger)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run hooks/useOrderTrigger.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/hooks/useOrderTrigger.ts src/hooks/useOrderTrigger.test.ts
git commit -m "feat(settings): add useOrderTrigger hook"
```

---

### Task 4: Clean useHotKeys hook

**Files:**
- Modify: `frontend/src/hooks/useHotKeys.ts`
- Modify: `frontend/src/hooks/useHotKeys.test.ts`

**Interfaces:**
- Consumes: `HotKeyConfig` (4 fields, Task 1).
- Produces: `useHotKeys` interface supporting only `openOrder/openKline/openSettings/batchCancel` actions; OrderPanel/App consumers updated in later tasks.

- [ ] **Step 1: Rewrite `useHotKeys.ts`**

Replace the whole file with:

```typescript
import { useEffect, useMemo } from 'react'
import type { HotKeyConfig } from '../services/types'
import { DEFAULT_HOT_KEYS } from '../stores/userPrefs'

interface UseHotKeysOptions {
  onOpenOrder?: () => void
  onOpenKline?: () => void
  onOpenSettings?: () => void
  onBatchCancel?: () => void
  enabled: boolean
  hotKeys?: HotKeyConfig
}

type ActionKey = 'openOrder' | 'openKline' | 'openSettings' | 'batchCancel'

export function useHotKeys({
  onOpenOrder,
  onOpenKline,
  onOpenSettings,
  onBatchCancel,
  enabled,
  hotKeys,
}: UseHotKeysOptions) {
  // Merge with defaults so partial hotKeys fall back
  const effectiveKeys: HotKeyConfig = useMemo(
    () => (hotKeys ? { ...DEFAULT_HOT_KEYS, ...hotKeys } : DEFAULT_HOT_KEYS),
    [hotKeys]
  )

  // Build key → action mapping from effective keys
  const keyToAction = useMemo(() => {
    const map: Record<string, ActionKey> = {}
    for (const [action, key] of Object.entries(effectiveKeys)) {
      if (key) {
        map[key.toLowerCase()] = action as ActionKey
        map[key.toUpperCase()] = action as ActionKey
        // Also register the raw key so mixed-case keys (e.g. 'Escape',
        // whose KeyboardEvent.key is 'Escape', not 'escape'/'ESCAPE') match.
        map[key] = action as ActionKey
      }
    }
    return map
  }, [effectiveKeys])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Don't fire with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const action = keyToAction[e.key]
      if (!action) return

      e.preventDefault()

      if (action === 'openOrder') onOpenOrder?.()
      if (action === 'openKline') onOpenKline?.()
      if (action === 'openSettings') onOpenSettings?.()
      if (action === 'batchCancel') onBatchCancel?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, keyToAction, onOpenOrder, onOpenKline, onOpenSettings, onBatchCancel])
}
```

- [ ] **Step 2: Rewrite `useHotKeys.test.ts`**

Replace the whole file with:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHotKeys } from './useHotKeys'

const KEYS = { openOrder: 'o', openKline: 'k', openSettings: ',', batchCancel: 'Escape' }

describe('useHotKeys', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function fireKey(key: string, ctrlKey = false) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
  }

  it('calls onOpenOrder when O pressed', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('o'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenKline when K pressed', () => {
    const onOpenKline = vi.fn()
    renderHook(() => useHotKeys({ onOpenKline, enabled: true }))
    act(() => fireKey('k'))
    expect(onOpenKline).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenSettings when , pressed', () => {
    const onOpenSettings = vi.fn()
    renderHook(() => useHotKeys({ onOpenSettings, enabled: true }))
    act(() => fireKey(','))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('calls onBatchCancel when Escape pressed', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('Escape'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults when hotKeys not provided', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('Escape'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom hotKeys mapping when provided', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true, hotKeys: { ...KEYS, openOrder: 'x' } }))
    act(() => fireKey('x'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when disabled', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: false }))
    act(() => fireKey('o'))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })

  it('does NOT fire for unknown keys', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('x'))
    expect(onBatchCancel).not.toHaveBeenCalled()
  })

  it('accepts uppercase keys', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('O'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('does not fire when input element focused', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true })) })
    expect(onOpenOrder).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not fire when Ctrl pressed', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('o', true))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })

  it('cleans up event listener on unmount', () => {
    const onOpenOrder = vi.fn()
    const { unmount } = renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    unmount()
    act(() => fireKey('o'))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- --run hooks/useHotKeys.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/hooks/useHotKeys.ts src/hooks/useHotKeys.test.ts
git commit -m "refactor(settings): slim useHotKeys to 4 navigation/batch-cancel actions"
```

---

### Task 5: Wire navigation hotkeys in App + remove offline 反向/锁仓 from OrderPanel

**Background (scope expansion, user-confirmed):** Task 2 removed `quickTradeConfig` from the store, which broke OrderPanel's 一键反向/锁仓 (reverse/lock) handlers. Since 一键反向/锁仓 are offline features (user confirmed), Task 5 now ALSO removes reverse/lock from OrderPanel + QuickActions entirely, rather than leaving broken code. `reversePosition` stays (used by TradeParams/InfiniteTradeParams flat-net). `lockPosition` becomes dead (only OrderPanel used it) → remove from `api.ts`.

**Files:**
- Modify: `frontend/src/App.tsx` (add navigation useHotKeys)
- Modify: `frontend/src/modules/order/OrderPanel.tsx` (remove reverse/lock; keep batchCancel)
- Modify: `frontend/src/components/QuickActions/index.tsx` (strip reverse/lock → batch-cancel only)
- Modify: `frontend/src/services/api.ts` (remove dead `lockPosition`)
- Modify: `frontend/src/modules/order/AccountBar.tsx:36` (fix stale comment referencing QuickActions 锁仓)
- Modify: `frontend/src/modules/order/OrderPanel.test.tsx` (remove reverse/lock mock refs)
- Modify: `frontend/src/components/QuickActions/index.test.tsx` (rewrite for batch-cancel-only)

**Interfaces:**
- Consumes: `useHotKeys` (Task 4) — props `onOpenOrder/onOpenKline/onOpenSettings/onBatchCancel`; `openOrderFloating/openKlineFloating/openSettingsFloating` (App imports).
- Produces: App-layer nav hotkeys work; OrderPanel clears reverse/lock and keeps batchCancel; QuickActions becomes single batch-cancel button; `lockPosition` removed from api exports.

- [ ] **Step 1: Add navigation useHotKeys in App.tsx**

In `frontend/src/App.tsx`, add imports:

```typescript
import { useHotKeys } from '@/hooks/useHotKeys'
import { useUserPrefsStore } from '@/stores/userPrefs'
```

Inside the `App()` component body (after the existing hooks, e.g. after `useSubscriptionManager()`), add:

```typescript
  // 全局导航快捷键：打开报单/K线/设置浮动窗（快捷键配置在设置页）
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)
  useHotKeys({
    enabled: true,
    hotKeys,
    onOpenOrder: () => openOrderFloating(),
    onOpenKline: () => openKlineFloating(),
    onOpenSettings: () => openSettingsFloating(),
  })
```

- [ ] **Step 2: Remove reverse/lock from OrderPanel.tsx**

In `frontend/src/modules/order/OrderPanel.tsx`:

1. Remove the `quickTradeConfig` selector (line 45): `const quickTradeConfig = useUserPrefsStore((s) => s.quickTradeConfig)`.
2. Remove imports no longer used: `reversePosition, lockPosition` from the `../../services/api` import (line 10); `ConfirmDialog` (line 9); `calcCounterpartyPrice` (line 12, only used by reverse/lock). Keep `useUserPrefsStore` (still reads `hotKeys`).
3. Remove the `ConfirmState` interface (lines 20-25).
4. Remove these useCallback blocks entirely: `buildReverseDetails` (60-87), `buildLockDetails` (89-105), `doReverse` (107-149), `doLock` (151-170), `handleReverse` (172-181), `handleLock` (183-192), `handleConfirmExecute` (194-212).
5. Remove `const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)` (line 30).
6. Replace the `useHotKeys({...})` block (lines 241-255) with:

```typescript
  // ── Hotkeys：仅保留批量撤单（导航快捷键在 App 层统一处理） ──
  useHotKeys({
    enabled: true,
    onBatchCancel: handleBatchCancel,
    hotKeys,
  })
```

7. Replace the `<QuickActions>` render (lines 260-265) — QuickActions no longer takes `onReverse`/`onLock`:

```typescript
      {/* 快捷操作按钮 — 与行情面板的 market-tabs 等高 */}
      <QuickActions instrumentID={orderForm.instrumentID} onBatchCancel={handleBatchCancel} />
```

8. Remove the `{confirmState && (<ConfirmDialog ...>)}` block (lines 305-313).
9. Remove now-unused `setOrderForm` selector (line 42) and `orderForm` if no longer used elsewhere — check: `orderForm` is used at line 248-252 (removed) and line 261 (passes instrumentID). `orderForm.instrumentID` at line 261 keeps `orderForm` used. Verify `setOrderForm` has no other use after removals; if unused, remove its selector too.

- [ ] **Step 3: Strip reverse/lock from QuickActions**

Rewrite `frontend/src/components/QuickActions/index.tsx` to batch-cancel only:

```typescript
import './styles.css'

interface QuickActionsProps {
  instrumentID: string
  onBatchCancel: () => void
}

/** 快捷操作：批量撤单（一键反向/锁仓已下线，2026-08-19） */
export function QuickActions({ instrumentID, onBatchCancel }: QuickActionsProps) {
  const disabled = !instrumentID

  function handleBatchCancel() {
    if (disabled) return
    onBatchCancel()
  }

  return (
    <div className="quick-actions">
      <button
        type="button"
        className="qa-btn qa-batch"
        disabled={disabled}
        onClick={handleBatchCancel}
      >
        批量撤单
      </button>
    </div>
  )
}
```

Update `frontend/src/components/QuickActions/styles.css` if it has reverse/lock-specific rules that are now dead — keep only `qa-btn`/`qa-batch` styling (check the file; if `qa-batch` works standalone, leave layout).

- [ ] **Step 4: Remove dead `lockPosition` from api.ts**

In `frontend/src/services/api.ts`, remove the `lockPosition` function (lines ~345-357) and its JSDoc. Keep `reversePosition` (still used by flat-net).

- [ ] **Step 5: Fix stale AccountBar comment**

In `frontend/src/modules/order/AccountBar.tsx:36`, the comment "锁仓能力保留在报单面板 QuickActions 一键锁仓" is now stale (lock removed). Update it to reflect that 一键锁仓 has been removed (or delete the trailing clause).

- [ ] **Step 6: Update tests**

1. `frontend/src/modules/order/OrderPanel.test.tsx` (lines 16-17): remove the `reversePosition`/`lockPosition` mocks from the `vi.mock('../../services/api', ...)` block. Search the file for any reverse/lock assertions and remove them.
2. Rewrite `frontend/src/components/QuickActions/index.test.tsx` to test only batch-cancel: renders single 批量撤单 button; disabled without instrumentID; calls `onBatchCancel` on click when enabled; not called when disabled. Remove all reverse/lock tests. Example:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickActions } from './index'

describe('QuickActions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function renderQA(props: { instrumentID?: string; onBatchCancel?: () => void } = {}) {
    const onBatchCancel = props.onBatchCancel ?? vi.fn()
    render(<QuickActions instrumentID={props.instrumentID ?? 'IF2608'} onBatchCancel={onBatchCancel} />)
    return { onBatchCancel }
  }

  it('renders single 批量撤单 button', () => {
    renderQA()
    expect(screen.getByText('批量撤单')).toBeInTheDocument()
  })

  it('disabled without instrumentID', () => {
    renderQA({ instrumentID: '' })
    expect(screen.getByText('批量撤单').closest('button')).toBeDisabled()
  })

  it('calls onBatchCancel on click when enabled', () => {
    const { onBatchCancel } = renderQA()
    fireEvent.click(screen.getByText('批量撤单'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onBatchCancel when disabled', () => {
    const { onBatchCancel } = renderQA({ instrumentID: '' })
    fireEvent.click(screen.getByText('批量撤单'))
    expect(onBatchCancel).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Run tests**

Run: `cd frontend && npx vitest run src/App.test.tsx src/modules/order/OrderPanel.test.tsx src/components/QuickActions/index.test.tsx src/services/api.test.ts`
Expected: These files PASS. (Other files like SettingsPage.test, HotKeyTab tests, collections.test remain broken until later tasks — do not fix them here.)

- [ ] **Step 8: Commit**

```bash
cd frontend && git add src/App.tsx src/modules/order/OrderPanel.tsx src/components/QuickActions/index.tsx src/components/QuickActions/styles.css src/services/api.ts src/modules/order/AccountBar.tsx src/modules/order/OrderPanel.test.tsx src/components/QuickActions/index.test.tsx
git commit -m "feat(settings): wire navigation hotkeys in App; remove offline 反向/锁仓 from OrderPanel/QuickActions + dead lockPosition"
```

---

### Task 6: HotKeyTab — show only 4 shortcuts

**Files:**
- Modify: `frontend/src/components/SettingsPanel/HotKeyTab.tsx`

**Interfaces:**
- Consumes: `HotKeyConfig` (4 fields).
- Produces: renders the 4 configurable hotkey rows.

- [ ] **Step 1: Update LABELS**

In `frontend/src/components/SettingsPanel/HotKeyTab.tsx`, replace `LABELS` (lines 12-24):

```typescript
const LABELS: Record<string, string> = {
  openOrder: '打开报单',
  openKline: '打开K线',
  openSettings: '打开设置',
  batchCancel: '批量撤单',
}
```

No other change needed — the component maps `Object.entries(LABELS)` and displays labels + reads `localHotKeys[action]`, which now only reads the 4 existing fields.

- [ ] **Step 2: Run tests (SettingsPage/OrderTrigger next tasks will fix remaining)**

Run: `cd frontend && npm test -- --run components/SettingsPanel/HotKeyTab.test.tsx` (if exists) — otherwise skip; full suite verified at end.
Expected: No failures from remaining old fields (HotKeyTab only iterates LABELS).

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/SettingsPanel/HotKeyTab.tsx
git commit -m "refactor(settings): HotKeyTab shows only 4 navigation/batch-cancel shortcuts"
```

---

### Task 7: New OrderTriggerTab

**Files:**
- Create: `frontend/src/components/SettingsPanel/OrderTriggerTab.tsx`
- Create: `frontend/src/components/SettingsPanel/OrderTriggerTab.test.tsx`

**Interfaces:**
- Consumes: `OrderTriggerConfig`, `DEFAULT_ORDER_TRIGGER`.
- Produces: `OrderTriggerTab({ config, onSave }: { config: OrderTriggerConfig; onSave: (c: OrderTriggerConfig) => void })`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/SettingsPanel/OrderTriggerTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderTriggerTab } from './OrderTriggerTab'
import type { OrderTriggerConfig } from '@/services/types'

const CONFIG: OrderTriggerConfig = { triggerMode: 'single', confirmBeforeOrder: true }

describe('OrderTriggerTab', () => {
  it('renders trigger mode and confirm options with defaults', () => {
    render(<OrderTriggerTab config={CONFIG} onSave={vi.fn()} />)
    expect(screen.getByText('触发方式')).toBeInTheDocument()
    expect(screen.getByText('单次点击触发')).toBeInTheDocument()
    expect(screen.getByText('双击触发')).toBeInTheDocument()
    expect(screen.getByText('下单前确认')).toBeInTheDocument()
  })

  it('selects single mode by default (checked)', () => {
    render(<OrderTriggerTab config={CONFIG} onSave={vi.fn()} />)
    expect(screen.getByLabelText('单次点击触发')).toBeChecked()
  })

  it('saves updated config when save clicked', () => {
    const onSave = vi.fn()
    render(<OrderTriggerTab config={CONFIG} onSave={onSave} />)
    fireEvent.click(screen.getByLabelText('双击触发'))
    fireEvent.click(screen.getByLabelText('下单前确认'))
    fireEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith({ triggerMode: 'double', confirmBeforeOrder: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run components/SettingsPanel/OrderTriggerTab.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement OrderTriggerTab**

Create `frontend/src/components/SettingsPanel/OrderTriggerTab.tsx`:

```typescript
import { useState } from 'react'
import type { OrderTriggerConfig } from '../../services/types'
import { DEFAULT_ORDER_TRIGGER } from '../../stores/userPrefs'

interface OrderTriggerTabProps {
  config: OrderTriggerConfig
  onSave: (config: OrderTriggerConfig) => void
}

export function OrderTriggerTab({ config, onSave }: OrderTriggerTabProps) {
  const [local, setLocal] = useState<OrderTriggerConfig>({ ...config })

  function handleSave() {
    onSave(local)
  }

  function handleReset() {
    setLocal({ ...DEFAULT_ORDER_TRIGGER })
  }

  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-group-header">
          <span className="settings-group-title">盘口下单触发</span>
          <button type="button" className="settings-reset-btn" onClick={handleReset}>
            恢复默认
          </button>
        </div>
        <p className="settings-desc">应用于五档下单与无限下单的盘口档位点击。快捷买卖栏不受此设置影响。</p>

        <div className="settings-row">
          <label className="settings-label">触发方式</label>
          <div className="settings-radio-group">
            <label className="settings-radio">
              <input
                type="radio"
                name="trigger-mode"
                value="single"
                checked={local.triggerMode === 'single'}
                onChange={() => setLocal((p) => ({ ...p, triggerMode: 'single' }))}
              />
              单次点击触发
            </label>
            <label className="settings-radio">
              <input
                type="radio"
                name="trigger-mode"
                value="double"
                checked={local.triggerMode === 'double'}
                onChange={() => setLocal((p) => ({ ...p, triggerMode: 'double' }))}
              />
              双击触发
            </label>
          </div>
        </div>

        {local.triggerMode === 'double' && (
          <div className="settings-hint">双击模式下，单击档位仅预览不报单，快速双击才触发下单。</div>
        )}

        <div className="settings-row">
          <label className="settings-label">二次确认</label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              aria-label="下单前确认"
              checked={local.confirmBeforeOrder}
              onChange={(e) => setLocal((p) => ({ ...p, confirmBeforeOrder: e.target.checked }))}
            />
            下单前弹窗确认
          </label>
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          保存
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the `.settings-desc` style**

In `frontend/src/components/SettingsPanel/styles.css`, append:

```css
.settings-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: #8892a6;
  line-height: 1.6;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test -- --run components/SettingsPanel/OrderTriggerTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/SettingsPanel/OrderTriggerTab.tsx src/components/SettingsPanel/OrderTriggerTab.test.tsx src/components/SettingsPanel/styles.css
git commit -m "feat(settings): add OrderTriggerTab for ladder click/reconfirm preferences"
```

---

### Task 8: SettingsPage — two tabs (快捷键/下单触发), drop 快捷交易

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.test.tsx`
- Modify: `frontend/src/components/SettingsPanel/index.tsx`
- Modify: `frontend/src/components/SettingsPanel/index.test.tsx`
- Delete: `frontend/src/components/SettingsPanel/QuickTradeTab.tsx`

**Interfaces:**
- Consumes: HotKeyTab (Task 6), OrderTriggerTab (Task 7), store (Task 2).
- Produces: Settings page with 快捷键 + 下单触发 tabs; no QuickTrade.

- [ ] **Step 1: Rewrite `SettingsPage.tsx`**

Replace the whole file with:

```typescript
import { useState } from 'react'
import { HotKeyTab } from '../components/SettingsPanel/HotKeyTab'
import { OrderTriggerTab } from '../components/SettingsPanel/OrderTriggerTab'
import { useUserPrefsStore } from '../stores/userPrefs'
import { toast } from '../components/Toast'
import type { HotKeyConfig, OrderTriggerConfig } from '../services/types'
import '../components/SettingsPanel/styles.css'

type SettingsTab = 'hotkey' | 'ordertrigger'

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('hotkey')
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)
  const orderTrigger = useUserPrefsStore((s) => s.orderTrigger)

  function handleSaveHotKeys(newHotKeys: HotKeyConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setHotKeys(newHotKeys)
    prefs.saveToLocalStorage()
    toast.success('快捷键已保存')
  }

  function handleSaveOrderTrigger(config: OrderTriggerConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setOrderTrigger(config)
    prefs.saveToLocalStorage()
    toast.success('下单触发设置已保存')
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-tabs">
        <button
          type="button"
          className={`settings-tab-btn ${tab === 'hotkey' ? 'active' : ''}`}
          onClick={() => setTab('hotkey')}
        >
          快捷键
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${tab === 'ordertrigger' ? 'active' : ''}`}
          onClick={() => setTab('ordertrigger')}
        >
          下单触发
        </button>
      </div>

      <div className="settings-panel-content">
        {tab === 'hotkey' ? (
          <HotKeyTab hotKeys={hotKeys} onSave={handleSaveHotKeys} />
        ) : (
          <OrderTriggerTab config={orderTrigger} onSave={handleSaveOrderTrigger} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `SettingsPage.test.tsx`**

Replace the whole file with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from '@/stores/userPrefs'

vi.mock('@/components/SettingsPanel/HotKeyTab', () => ({
  HotKeyTab: ({ hotKeys, onSave }: any) => (
    <div data-testid="hotkey-tab">
      <span>HotKey Tab</span>
      <button onClick={() => onSave({ ...hotKeys, openOrder: 'x' })}>Save HotKeys</button>
    </div>
  ),
}))

vi.mock('@/components/SettingsPanel/OrderTriggerTab', () => ({
  OrderTriggerTab: ({ config, onSave }: any) => (
    <div data-testid="ordertrigger-tab">
      <span>OrderTrigger Tab</span>
      <button onClick={() => onSave({ ...config })}>Save OrderTrigger</button>
    </div>
  ),
}))

vi.mock('@/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    useUserPrefsStore.setState({
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
    vi.clearAllMocks()
  })

  it('renders two tabs：快捷键 / 下单触发', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('下单触发')).toBeInTheDocument()
    expect(screen.queryByText('快捷交易')).not.toBeInTheDocument()
  })

  it('shows HotKey tab by default', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('hotkey-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('ordertrigger-tab')).not.toBeInTheDocument()
  })

  it('switches to 下单触发 tab', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByTestId('ordertrigger-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('active tab has active class', () => {
    render(<SettingsPage />)
    expect(screen.getByText('快捷键')).toHaveClass('active')
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByText('下单触发')).toHaveClass('active')
  })
})
```

Note: `SettingsPage` renders `.settings-panel-tabs` with two tab buttons and `.settings-panel-content`. No `⚙ 设置` heading exists.

- [ ] **Step 3: Rewrite `SettingsPanel/index.tsx`**

Replace the whole file with:

```typescript
import { useState } from 'react'
import { HotKeyTab } from './HotKeyTab'
import { OrderTriggerTab } from './OrderTriggerTab'
import { useUserPrefsStore } from '../../stores/userPrefs'
import { toast } from '../Toast'
import type { HotKeyConfig, OrderTriggerConfig } from '../../services/types'
import './styles.css'

type SettingsTab = 'hotkey' | 'ordertrigger'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('hotkey')
  const hotKeys = useUserPrefsStore((s) => s.hotKeys)
  const orderTrigger = useUserPrefsStore((s) => s.orderTrigger)

  function handleSaveHotKeys(newHotKeys: HotKeyConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setHotKeys(newHotKeys)
    prefs.saveToLocalStorage()
    toast.success('快捷键已保存')
  }

  function handleSaveOrderTrigger(config: OrderTriggerConfig) {
    const prefs = useUserPrefsStore.getState()
    prefs.setOrderTrigger(config)
    prefs.saveToLocalStorage()
    toast.success('下单触发设置已保存')
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <div className="settings-panel-tabs">
          <button
            type="button"
            className={`settings-tab-btn ${tab === 'hotkey' ? 'active' : ''}`}
            onClick={() => setTab('hotkey')}
          >
            快捷键
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${tab === 'ordertrigger' ? 'active' : ''}`}
            onClick={() => setTab('ordertrigger')}
          >
            下单触发
          </button>
        </div>
        <button type="button" className="settings-close-btn" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="settings-panel-content">
        {tab === 'hotkey' ? (
          <HotKeyTab hotKeys={hotKeys} onSave={handleSaveHotKeys} />
        ) : (
          <OrderTriggerTab config={orderTrigger} onSave={handleSaveOrderTrigger} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `SettingsPanel/index.test.tsx`**

Replace the whole file with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from './index'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from '../../stores/userPrefs'

vi.mock('../Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('./HotKeyTab', () => ({
  HotKeyTab: () => <div data-testid="hotkey-tab">HotKey Tab</div>,
}))

vi.mock('./OrderTriggerTab', () => ({
  OrderTriggerTab: () => <div data-testid="ordertrigger-tab">OrderTrigger Tab</div>,
}))

describe('SettingsPanel', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onClose = vi.fn()
    useUserPrefsStore.setState({
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
  })

  it('renders two tabs：快捷键 / 下单触发', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('下单触发')).toBeInTheDocument()
    expect(screen.queryByText('快捷交易')).not.toBeInTheDocument()
  })

  it('shows HotKey tab by default', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByTestId('hotkey-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('ordertrigger-tab')).not.toBeInTheDocument()
  })

  it('switches to 下单触发 tab', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('下单触发'))
    expect(screen.getByTestId('ordertrigger-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('hotkey-tab')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 5: Delete QuickTradeTab.tsx**

```bash
rm frontend/src/components/SettingsPanel/QuickTradeTab.tsx
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm test -- --run pages/SettingsPage.test.tsx components/SettingsPanel/index.test.tsx`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd frontend && git add -A
git commit -m "refactor(settings): settings page now has 快捷键+下单触发 tabs; delete QuickTradeTab"
```

---

### Task 9: Apply order trigger to MarketDepth ladder

**Files:**
- Modify: `frontend/src/modules/order/MarketDepth.tsx`
- Modify: `frontend/src/modules/order/MarketDepth.test.tsx`

**Interfaces:**
- Consumes: `useOrderTrigger()` (Task 3).
- Produces: ladder cell clicks honor triggerMode + confirmBeforeOrder with a direct-submit path.

**Behavior to implement** (single/double + confirm matrix): see spec.

- [ ] **Step 1: Read the current `openIntent`, `handleConfirm`, and handle-click functions**

Current flow: cell click → `openIntent(...)` sets `intent` → `{intent && <ConfirmDialog>}` → confirm → `handleConfirm` → `submitOrder`.

We add a direct-submit path when `confirmBeforeOrder === false`, and a double-click preview state.

- [ ] **Step 2: Add trigger config + preview state + double-click timing**

Add imports:

```typescript
import { useOrderTrigger } from '../../hooks/useOrderTrigger'
```

Add a small double-click detection helper. Create `frontend/src/hooks/useDoubleClick.ts`:

```typescript
import { useCallback, useRef } from 'react'

/**
 * 双击检测：返回一个 handler，首次调用启动计时；在 interval 内再次调用判定为双击。
 * 返回 { preview: () => void; double: () => void } —— 调用方在 handler 里自己区分。
 */
export function useDoubleClick(interval = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  // 返回一个 wrapAnyClick 函数：无论单击/双击先调用一次，双击由内部回调触发。
  // 但我们不需要 —— 直接在组件里用下面的方式。
  const register = useCallback((onClick: () => void, onDouble: () => void) => {
    return () => {
      if (timerRef.current) {
        // 已有第一次点击在途 → 本次为双击
        clearTimeout(timerRef.current)
        timerRef.current = null
        onDouble()
      } else {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          onClick()
        }, interval)
      }
    }
  }, [interval])

  return { register, reset }
}
```

This helper makes the calling component the owner of preview vs. double semantics. Write a test `frontend/src/hooks/useDoubleClick.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDoubleClick } from './useDoubleClick'

describe('useDoubleClick', () => {
  it('fires onClick after interval when single click', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDoubleClick(300))
    const onClick = vi.fn()
    const onDouble = vi.fn()
    const handler = result.current.register(onClick, onDouble)
    act(() => handler())
    expect(onClick).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDouble).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('fires onDouble instead of onClick on double click', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDoubleClick(300))
    const onClick = vi.fn()
    const onDouble = vi.fn()
    const handler = result.current.register(onClick, onDouble)
    act(() => handler())
    act(() => handler())
    expect(onClick).not.toHaveBeenCalled()
    expect(onDouble).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 3: Wire trigger logic into MarketDepth**

In `MarketDepth.tsx` `MarketDepth` component:

- Read trigger config: `const { triggerMode, confirmBeforeOrder } = useOrderTrigger()`
- Add `const [preview, setPreview] = useState<{ direction: 'buy' | 'sell'; price: number } | null>(null)`
- Add `const { register, reset } = useDoubleClick(300)`

Replace `handleBuyClick` / `handleSellClick` with logic that branches on `triggerMode`:

```typescript
  // 盘口档位点击 → 按触发设置执行（双击模式：单击预览/双击下单；免确认直接下单）
  const executeRowClick = (direction: 'buy' | 'sell', price: number) => {
    const level = direction === 'buy'
      ? myOrders.byPrice.get(price)?.buyVolume ?? 0
      : myOrders.byPrice.get(price)?.sellVolume ?? 0
    if (level > 0) {
      // 本档有我方挂单 → 撤单（行为不变，不受触发设置影响）
      cancelLevel(direction, price)
      return
    }
    if (pendingByPrice.get(price)?.[direction]) return // 报单进行中防叠加

    // 免确认：直接下单（不走确认框）
    if (triggerMode === 'single' && !confirmBeforeOrder) {
      submitIntent(direction, price)
      return
    }
    if (triggerMode === 'single') {
      openIntent(direction, price)
      return
    }
    // double 模式
    if (!confirmBeforeOrder) {
      // 免确认：单击预览、双击直接下单
      setPreview({ direction, price })
      register(() => {}, () => { setPreview(null); submitIntent(direction, price) })()
      return
    }
    // double + 确认：单击预览、双击弹确认框
    setPreview({ direction, price })
    register(() => {}, () => { setPreview(null); openIntent(direction, price) })()
  }
```

Note: the `register` helper returns a fresh handler each render — call it once inside the click function (like above). The preview is cleared by a `useEffect` timeout or on next click.

Add a direct-submit function (mirrors `handleConfirm` without the dialog):

```typescript
  const submitIntent = async (direction: 'buy' | 'sell', price: number) => {
    const id = ++pendingIdRef.current
    const pre = myOrders.byPrice.get(price)
    const baseline = direction === 'buy' ? (pre?.buyVolume ?? 0) : (pre?.sellVolume ?? 0)
    const pe: PendingOrder = { id, direction, price, volume: orderForm.volumeTotalOriginal, status: 'pending', baseline }
    setPending((prev) => [...prev, pe])
    setOrderForm({
      direction: direction as 'buy' | 'sell',
      limitPrice: price,
      volumeTotalOriginal: orderForm.volumeTotalOriginal,
      combOffsetFlag: orderForm.combOffsetFlag,
      timeCondition: orderForm.timeCondition,
    })
    const ok = await submitOrder()
    if (ok) {
      useQueryStore.getState().fetchOrders()
      window.setTimeout(() => setPending((prev) => prev.filter((p) => p.id !== id)), 10_000)
    } else {
      setPending((prev) => prev.filter((p) => p.id !== id))
      setBanner(useOrderStore.getState().lastSubmitError ?? '报单失败')
      window.setTimeout(() => setBanner(null), 4000)
    }
  }
```

Then set `DepthLadder` / `DepthRow` `onBuyClick`/`onSellClick` to `(price) => executeRowClick('buy', price)` / `(price) => executeRowClick('sell', price)`.

Add preview visual: pass a `previewPrice`/`previewDirection` down to `DepthRow` to add a class `depth-row__preview`. This is optional visual styling; keep it minimal:

In `DepthRow`, add optional prop `preview?: boolean` and apply `depth-row--preview` class when `preview` is true.

Add CSS to `MarketDepth.css`:

```css
.depth-row--preview .depth-row__buy,
.depth-row--preview .depth-row__sell {
  box-shadow: inset 0 0 0 2px #f0b90b;
  background: rgba(240, 185, 11, 0.12);
}
```

- [ ] **Step 4: Extend `MarketDepth.test.tsx`**

Add at the top of `frontend/src/modules/order/MarketDepth.test.tsx`, next to the other mocks:

```typescript
import { useInfiniteOrderStore } from './store' // (do not add — only order store needed)
import { useOrderTrigger } from '../../hooks/useOrderTrigger'

vi.mock('../../hooks/useOrderTrigger', () => ({
  useOrderTrigger: vi.fn(),
}))
```

Then add a new describe block at the end of the file (it sets the store's `submitOrder` spy + `orderTrigger` return per `it`):

```typescript
describe('盘口下单触发设置（单击/双击 + 二次确认）', () => {
  const UOT = useOrderTrigger as ReturnType<typeof vi.fn>
  const setOrderTrigger = (v: { triggerMode: 'single' | 'double'; confirmBeforeOrder: boolean }) =>
    UOT.mockReturnValue(v)

  beforeEach(() => {
    vi.clearAllMocks()
    useOrderStore.setState({ submitOrder: realSubmitOrder })
    useOrderStore.setState({
      orderForm: {
        ...DEFAULT_ORDER_FORM,
        instrumentID: 'IF2608',
        exchangeID: 'CFFEX',
        volumeTotalOriginal: 3,
        combOffsetFlag: 'open',
        timeCondition: 'gfd',
      },
    })
    useQueryStore.setState({ orders: [] })
    setOrderTrigger({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('single + 确认：单击档位 → 弹确认框（默认行为，回归保护）', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('bid-1').querySelector('.depth-row__buy')!)
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('single + 免确认：单击档位 → 直接提交，不弹确认框', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'single', confirmBeforeOrder: false })
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('bid-1').querySelector('.depth-row__buy')!)
    await act(async () => {})
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(useOrderStore.getState().orderForm.direction).toBe('buy')
    expect(useOrderStore.getState().orderForm.limitPrice).toBe(4694)
  })

  it('double + 确认：单击档位仅预览（不弹框、不提交），快速双击弹确认框', () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: true })
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    const bid1Buy = screen.getByTestId('bid-1').querySelector('.depth-row__buy')!
    // 第一次点击：仅预览，无确认框
    fireEvent.click(bid1Buy)
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
    // 快速第二次点击（双击窗口内）：弹确认框，仍未提交
    fireEvent.click(bid1Buy)
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('double + 免确认：快速双击直接提交，单击不提交', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    const bid1Buy = screen.getByTestId('bid-1').querySelector('.depth-row__buy')!
    // 单击不提交
    fireEvent.click(bid1Buy)
    expect(submitSpy).not.toHaveBeenCalled()
    // 双击 → 直接提交
    fireEvent.click(bid1Buy)
    await act(async () => {})
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })
})
```

This mirrors the existing harness exactly (render helper, `makeSnapshot`, `useOrderStore` state setup, `confirm-dialog` queries). The double-click window test relies on `fireEvent.click` firing twice synchronously — ensure the `useDoubleClick` implementation treats two rapid calls as a double-click (no timer expiry between them).

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm test -- --run hooks/useDoubleClick.test.ts modules/order/MarketDepth.test.tsx`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/hooks/useDoubleClick.ts src/hooks/useDoubleClick.test.ts src/modules/order/MarketDepth.tsx src/modules/order/MarketDepth.test.tsx src/modules/order/MarketDepth.css
git commit -m "feat(settings): apply order-trigger setting to MarketDepth ladder"
```

**IMPORTANT:** In the MarketDepth component implementation, ensure `useOrderTrigger()` falls back to the store default (`{ triggerMode: 'single', confirmBeforeOrder: true }`) so the existing tests (which render WITHOUT mocking `useOrderTrigger`) keep passing — the store default is single+confirm, matching all existing assertions.

---

### Task 10: Apply order trigger to InfiniteLadder

**Files:**
- Modify: `frontend/src/modules/infinite/InfiniteLadder.tsx`
- Modify: `frontend/src/modules/infinite/InfiniteLadder.test.tsx`

**Interfaces:**
- Consumes: `useOrderTrigger()`, `useDoubleClick()` (Task 3/9).
- Produces: ladder bid/ask cells honor triggerMode + confirm.

- [ ] **Step 1: Wire trigger logic**

Add imports:

```typescript
import { useOrderTrigger } from '@/hooks/useOrderTrigger'
import { useDoubleClick } from '@/hooks/useDoubleClick'
```

In the `InfiniteLadder` component:

- `const { triggerMode, confirmBeforeOrder } = useOrderTrigger()`
- `const [preview, setPreview] = useState<{ direction: 'buy' | 'sell'; price: number } | null>(null)`
- `const { register } = useDoubleClick(300)`

Replace the cell `onClick` handlers. Currently:

```typescript
onClick={() => openIntent('buy', price)}
onClick={() => openIntent('sell', price)}
```

Change to call a single `executeCell(direction, price)`:

```typescript
  const executeCell = (direction: 'buy' | 'sell', price: number) => {
    // 免确认直接下单；否则弹确认框
    if (triggerMode === 'single') {
      if (confirmBeforeOrder) openIntent(direction, price)
      else submitIntent(direction, price)
      return
    }
    // double 模式
    setPreview({ direction, price })
    register(
      () => {}, // single click in double mode → preview only (no order)
      () => { setPreview(null); if (confirmBeforeOrder) openIntent(direction, price); else submitIntent(direction, price) }
    )()
  }
```

Add a direct-submit function:

```typescript
  const submitIntent = async (direction: 'buy' | 'sell', price: number) => {
    const ok = await submitOrder({ direction, price, volume, combOffsetFlag, timeCondition })
    if (ok) {
      useQueryStore.getState().fetchOrders()
    } else {
      setBanner(useInfiniteOrderStore.getState().lastSubmitError ?? '报单失败')
      setTimeout(() => setBanner(null), 4000)
    }
  }
```

Apply preview styling: add a class to `infinite-row` when preview matches (direction+price) — pass `preview` bool down to the row, or compare. Add CSS in `InfiniteLadder.css`.

- [ ] **Step 2: Extend `InfiniteLadder.test.tsx`**

Mock `useOrderTrigger`; add tests for the matrix (single+confirm dialog, double+free direct submit, etc.), adapted to the existing harness.

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- --run modules/infinite/InfiniteLadder.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/modules/infinite/InfiniteLadder.tsx src/modules/infinite/InfiniteLadder.test.tsx src/modules/infinite/InfiniteLadder.css
git commit -m "feat(settings): apply order-trigger setting to InfiniteLadder"
```

---

### Task 11: Full suite verification

**Files:** none (verification only)

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass.

- [ ] **Step 3: Fix any remaining references**

If any file still imports `DEFAULT_QUICK_TRADE_CONFIG`, `QuickTradeTab`, `quickTradeConfig`, or references `hotKeys.buy/sell/cancel/reverse/lock`, fix them (e.g. `collections.test.ts`, `OrderPanel.test.tsx` mocks). Search:

```bash
cd frontend && grep -rn "QuickTradeTab\|quickTradeConfig\|DEFAULT_QUICK_TRADE\|hotKeys.buy\|hotKeys.sell\|hotKeys.cancel\|hotKeys.reverse\|hotKeys.lock" src --include="*.ts" --include="*.tsx"
```

Fix all remaining references, then re-run tests.

- [ ] **Step 4: Final commit if fixes needed**

```bash
cd frontend && git add -A && git commit -m "fix: resolve remaining references from settings cleanup"
```
