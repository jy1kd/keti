# 弹窗与标签页丝滑转换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 OrderPopup/QueryPopup 可通过 ⤢ 放大按钮转为标签页，任意可关闭标签可通过拖拽（标签栏或页面标题栏）转为悬浮弹窗，转换过程用 FLIP 动画平滑衔接，内容实例全程保活。

**Architecture:** 统一「内容宿主」模型——标签只存在 `docked`/`floating` 两态，内容仅在 TabContent 渲染一次；浮动面板通过 `position: fixed` 位移到浮动窗口壳上（无 Portal、无重挂载）。新增 `floatingWindows` store 管理窗口几何态，`utils/flip` 做 FLIP 动画，`utils/detachDrag` 做两种拖拽手势，`FloatingWindow` 只画 chrome 壳。

**Tech Stack:** React 18 + TypeScript 5 + Zustand 4 + vitest + @testing-library/react，无新依赖。

## Global Constraints

- 测试在 `frontend/` 目录执行：`npx vitest run <路径> -v`（全量 `npm test`）。
- 新增 store/工具放 `frontend/src/stores/`、`frontend/src/utils/`；`@` 别名指向 `frontend/src`。
- **不得新增任何 npm 依赖。**
- 代码注释使用中文，风格与现有代码一致。
- 测试显式 `import { describe, it, expect, vi, beforeEach } from 'vitest'`（现有惯例，即使 vitest `globals: true`）。
- 拖拽阈值统一 `6px`；`position: fixed` 依赖祖先无 `transform`（已核实 `.app`/`.tab-content` 无 transform）。

---

### Task 1: `query` 标签类型

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Modify: `frontend/src/components/TabContent/index.tsx`
- Test: `frontend/src/stores/tabs.test.ts`
- Test: `frontend/src/components/TabContent/index.test.tsx`

**Interfaces:**
- Produces: `TabType` 新增 `'query'`；`TAB_TYPES` 含 `'query'`；`TabContent.renderTabContent` 新增 `case 'query'`。

- [ ] **Step 1: 更新 tabs store —— 新增 `query` 类型**

在 `stores/tabs.ts` 的 `TabType` 联合类型中加入 `'query'`，并在 `TAB_TYPES` 数组中追加：

```ts
export type TabType =
  | 'market'
  | 'favorites'
  | 'order'
  | 'kline'
  | 'options'
  | 'ipc-monitor'
  | 'settings'
  | 'query'          // 新增：查询（全局账户查询，放大自 QueryPopup）

export const TAB_TYPES: TabType[] = [
  'market',
  'favorites',
  'order',
  'kline',
  'options',
  'ipc-monitor',
  'settings',
  'query',
]
```

- [ ] **Step 2: TabContent 渲染 `query` 标签**

在 `components/TabContent/index.tsx` 顶部加入 `QueryPanel` 导入，并在 `renderTabContent` 的 switch 中新增分支：

```tsx
import { QueryPanel } from '@/modules/query/QueryPanel'
// ...
  case 'query':
    return <QueryPanel />
```

- [ ] **Step 3: 更新 tabs.test.ts 的 TAB_TYPES 断言**

在 `stores/tabs.test.ts` 的 `'应定义所有标签页类型'` 用例中，把 `toEqual([...])` 数组追加 `'query'`：

```ts
expect(TAB_TYPES).toEqual([
  'market',
  'favorites',
  'order',
  'kline',
  'options',
  'ipc-monitor',
  'settings',
  'query',
])
```

- [ ] **Step 4: 更新 TabContent.test.tsx —— 增加 QueryPanel mock 与用例**

在 `components/TabContent/index.test.tsx` 顶部 mock 区（现有 `vi.mock('@/modules/market/MarketPanel', ...)` 之后）加入：

```tsx
vi.mock('@/modules/query/QueryPanel', () => ({
  QueryPanel: () => <div data-testid="query-panel">查询面板 Mock</div>,
}))
```

并在 `'标签类型渲染'` 的 `it.each` 表追加一行：

```tsx
['query', '查询面板 Mock'],
```

- [ ] **Step 5: 运行测试验证**

```bash
npx vitest run src/stores/tabs.test.ts src/components/TabContent/index.test.tsx -v
```

Expected: 全部 PASS（含新增 `query` 断言与用例）。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/tabs.ts frontend/src/components/TabContent/index.tsx frontend/src/stores/tabs.test.ts frontend/src/components/TabContent/index.test.tsx
git commit -m "feat(tabs): 新增 query 标签类型，TabContent 渲染 QueryPanel"
```

---

### Task 2: `floatingWindows` store

**Files:**
- Create: `frontend/src/stores/floatingWindows.ts`
- Test: `frontend/src/stores/floatingWindows.test.ts`

**Interfaces:**
- Consumes: `useTabStore`（`detach` 守卫固定标签，需要 `closable`）。
- Produces:
  - `export const FLOATING_CHROME_H = 32`
  - `export function defaultFloatingSize(): { w: number; h: number }`
  - `export interface FloatingRect { x: number; y: number; w: number; h: number; z: number }`
  - `export const useFloatingWindowStore`，含 `windows: Record<string, FloatingRect>`、`detach(tabId, rect): boolean`、`dock(tabId)`、`move(tabId, pos)`、`resize(tabId, size)`、`focus(tabId)`。

- [ ] **Step 1: 写失败测试 `floatingWindows.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useFloatingWindowStore, FLOATING_CHROME_H, defaultFloatingSize } from './floatingWindows'
import { useTabStore } from './tabs'

describe('useFloatingWindowStore', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
    })
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('FLOATING_CHROME_H 应为 32', () => {
    expect(FLOATING_CHROME_H).toBe(32)
  })

  it('detach 可关闭标签：登记窗口并分配 z', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    expect(ok).toBe(true)
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w).toEqual({ x: 10, y: 20, w: 400, h: 300, z: 1401 })
  })

  it('detach 固定标签（market）：拒绝返回 false', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-market', { x: 0, y: 0, w: 400, h: 300 })
    expect(ok).toBe(false)
    expect(useFloatingWindowStore.getState().windows['tab-market']).toBeUndefined()
  })

  it('detach 不存在的标签：返回 false', () => {
    const ok = useFloatingWindowStore.getState().detach('tab-nope', { x: 0, y: 0, w: 400, h: 300 })
    expect(ok).toBe(false)
  })

  it('dock 移除窗口登记', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().dock('tab-settings')
    expect(useFloatingWindowStore.getState().windows).toEqual({})
  })

  it('move 更新坐标', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().move('tab-settings', { x: 50, y: 60 })
    expect(useFloatingWindowStore.getState().windows['tab-settings'].x).toBe(50)
    expect(useFloatingWindowStore.getState().windows['tab-settings'].y).toBe(60)
  })

  it('resize 更新宽高', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().resize('tab-settings', { w: 600, h: 400 })
    expect(useFloatingWindowStore.getState().windows['tab-settings'].w).toBe(600)
    expect(useFloatingWindowStore.getState().windows['tab-settings'].h).toBe(400)
  })

  it('focus 递增 z', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    const before = useFloatingWindowStore.getState().windows['tab-settings'].z
    useFloatingWindowStore.getState().focus('tab-settings')
    const after = useFloatingWindowStore.getState().windows['tab-settings'].z
    expect(after).toBe(before + 1)
  })

  it('defaultFloatingSize 返回钳制到视口的尺寸', () => {
    const s = defaultFloatingSize()
    expect(s.w).toBeGreaterThan(0)
    expect(s.h).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/stores/floatingWindows.test.ts -v
```

Expected: FAIL —— `Cannot find module './floatingWindows'`。

- [ ] **Step 3: 实现 `floatingWindows.ts`**

```ts
import { create } from 'zustand'
import { useTabStore } from './tabs'

/** 浮动窗口顶部标题条高度（px），TabContent 浮动面板需下移该高度 */
export const FLOATING_CHROME_H = 32

/** 拖出标签时的默认窗口尺寸（钳制到视口） */
export function defaultFloatingSize(): { w: number; h: number } {
  const w = Math.round(Math.min(900, window.innerWidth * 0.9))
  const h = Math.round(Math.min(620, window.innerHeight * 0.8))
  return { w: Math.max(320, w), h: Math.max(200, h) }
}

export interface FloatingRect {
  x: number
  y: number
  w: number
  h: number
  z: number
}

interface FloatingWindowStore {
  /** 悬浮窗口：tabId → 几何信息 */
  windows: Record<string, FloatingRect>
  /** 悬浮一个标签；固定标签（closable:false）拒绝。返回是否成功 */
  detach: (tabId: string, rect: { x: number; y: number; w: number; h: number }) => boolean
  /** 停靠回标签栏（移除窗口登记） */
  dock: (tabId: string) => void
  /** 拖标题条移动窗口 */
  move: (tabId: string, pos: { x: number; y: number }) => void
  /** 右下角缩放窗口 */
  resize: (tabId: string, size: { w: number; h: number }) => void
  /** 点击窗口置顶（z 递增） */
  focus: (tabId: string) => void
}

let zCounter = 1400

export const useFloatingWindowStore = create<FloatingWindowStore>((set) => ({
  windows: {},
  detach: (tabId, rect) => {
    const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
    if (!tab || !tab.closable) return false
    zCounter += 1
    set((s) => ({ windows: { ...s.windows, [tabId]: { ...rect, z: zCounter } } }))
    return true
  },
  dock: (tabId) => {
    set((s) => {
      const { [tabId]: _removed, ...rest } = s.windows
      return { windows: rest }
    })
  },
  move: (tabId, pos) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      return { windows: { ...s.windows, [tabId]: { ...cur, x: pos.x, y: pos.y } } }
    })
  },
  resize: (tabId, size) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      return { windows: { ...s.windows, [tabId]: { ...cur, w: size.w, h: size.h } } }
    })
  },
  focus: (tabId) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      zCounter += 1
      return { windows: { ...s.windows, [tabId]: { ...cur, z: zCounter } } }
    })
  },
}))
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/stores/floatingWindows.test.ts -v
```

Expected: PASS（10 个用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/floatingWindows.ts frontend/src/stores/floatingWindows.test.ts
git commit -m "feat(stores): floatingWindows 窗口几何 store（detach/dock/move/resize/focus）"
```

---

### Task 3: TabContent 浮动面板渲染

**Files:**
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/components/TabContent/styles.css`
- Test: `frontend/src/components/TabContent/index.test.tsx`

**Interfaces:**
- Consumes: `useFloatingWindowStore`, `FLOATING_CHROME_H`（Task 2）；`useTabStore`。
- Produces: 浮动面板具有 `tab-content__panel--floating` 类、`position: fixed` 内联样式、`onPointerDown` 聚焦；供 Task 6（FloatingWindow 壳）与 Task 8（拖拽委托）使用。

- [ ] **Step 1: 写失败测试（浮动渲染）**

在 `components/TabContent/index.test.tsx` 中追加以下 `describe`：

```tsx
import { useFloatingWindowStore } from '@/stores/floatingWindows'

describe('浮动面板', () => {
  beforeEach(() => {
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('浮动标签面板应固定定位并可见（即使非活跃）', () => {
    useTabStore.setState({
      tabs: [MARKET_TAB, SETTINGS_TAB],
      activeTabId: MARKET_TAB.id,
    })
    useFloatingWindowStore.setState({
      windows: { 'tab-settings': { x: 10, y: 20, w: 400, h: 300, z: 1401 } },
    })
    render(<TabContent />)
    const panel = getAllPanels()[1] // [market, settings]，settings 在下标 1
    expect(panel).toHaveClass('tab-content__panel--floating')
    expect(panel).toHaveStyle({ position: 'fixed', left: '10px', top: '52px', width: '400px', height: '268px' })
    expect(panel).toHaveAttribute('aria-hidden', 'false')
  })

  it('停靠（dock）后浮动面板恢复内联样式', () => {
    useTabStore.setState({
      tabs: [MARKET_TAB, SETTINGS_TAB],
      activeTabId: MARKET_TAB.id,
    })
    useFloatingWindowStore.setState({
      windows: { 'tab-settings': { x: 10, y: 20, w: 400, h: 300, z: 1401 } },
    })
    const { rerender } = render(<TabContent />)
    useFloatingWindowStore.getState().dock('tab-settings')
    rerender(<TabContent />)
    const panel = getAllPanels()[1]
    expect(panel).not.toHaveClass('tab-content__panel--floating')
    expect(panel).toHaveStyle({ display: 'none' }) // 非活跃且已停靠
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/components/TabContent/index.test.tsx -v
```

Expected: 新增用例 FAIL（缺少浮动渲染逻辑）。

- [ ] **Step 3: 实现 TabContent 浮动渲染**

修改 `components/TabContent/index.tsx`：

```tsx
import { useTabStore, type Tab } from '@/stores/tabs'
import { useFloatingWindowStore, FLOATING_CHROME_H } from '@/stores/floatingWindows'
// ...其余 import 不变

export function TabContent() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const windows = useFloatingWindowStore((s) => s.windows)

  return (
    <div className="tab-content">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const floating = windows[tab.id]
        return (
          <div
            key={tab.id}
            role="tabpanel"
            aria-labelledby={tab.id}
            aria-hidden={floating ? false : !isActive}
            className={`tab-content__panel${floating ? ' tab-content__panel--floating' : ''}`}
            onPointerDown={() => {
              // 浮动面板点击置顶；拖拽委托见 Task 8
              if (floating) useFloatingWindowStore.getState().focus(tab.id)
            }}
            style={{
              display: floating ? 'block' : isActive ? 'block' : 'none',
              ...(floating && {
                position: 'fixed',
                left: floating.x,
                top: floating.y + FLOATING_CHROME_H,
                width: floating.w,
                height: floating.h - FLOATING_CHROME_H,
                zIndex: floating.z,
              }),
            }}
          >
            {renderTabContent(tab)}
          </div>
        )
      })}
    </div>
  )
}
```

在 `components/TabContent/styles.css` 追加：

```css
/* ── 浮动面板（与 FloatingWindow chrome 构成窗口整体） ── */
.tab-content__panel--floating {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  box-sizing: border-box;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/components/TabContent/index.test.tsx -v
```

Expected: 全部 PASS（含新增 2 个浮动用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TabContent/index.tsx frontend/src/components/TabContent/styles.css frontend/src/components/TabContent/index.test.tsx
git commit -m "feat(TabContent): 浮动面板 position:fixed 位移渲染，实例保活"
```

---

### Task 4: FLIP 动画工具 `utils/flip`

**Files:**
- Create: `frontend/src/utils/flip.ts`
- Test: `frontend/src/utils/flip.test.ts`

**Interfaces:**
- Produces:
  - `export interface FlipRect { left: number; top: number; width: number; height: number }`
  - `export function getRect(el: HTMLElement): FlipRect`
  - `export function computeFlipDeltas(from: FlipRect, to: FlipRect): { dx: number; dy: number; sx: number; sy: number }`
  - `export function flipToRect(el: HTMLElement, from: FlipRect, to: FlipRect, opts?: { duration?: number; onDone?: () => void }): void`
  - `export function getTabPanelRect(tabId: string): FlipRect | null`

- [ ] **Step 1: 写失败测试 `flip.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { computeFlipDeltas, flipToRect, getTabPanelRect, type FlipRect } from './flip'

const A: FlipRect = { left: 100, top: 50, width: 200, height: 150 }
const B: FlipRect = { left: 300, top: 200, width: 400, height: 300 }

describe('utils/flip', () => {
  it('computeFlipDeltas 计算反向位移与缩放', () => {
    const d = computeFlipDeltas(A, B)
    expect(d.dx).toBe(100 - 300)   // -200
    expect(d.dy).toBe(50 - 200)    // -150
    expect(d.sx).toBe(200 / 400)   // 0.5
    expect(d.sy).toBe(150 / 300)   // 0.5
  })

  it('computeFlipDeltas 对零尺寸目标返回 scale 1', () => {
    const d = computeFlipDeltas(A, { left: 0, top: 0, width: 0, height: 0 })
    expect(d.sx).toBe(1)
    expect(d.sy).toBe(1)
  })

  it('flipToRect 先施加反向 transform，再过渡到恒等，结束后清理并回调', () => {
    const el = document.createElement('div')
    const onDone = vi.fn()
    flipToRect(el, A, B, { onDone })
    expect(el.style.transform).toBe('translate(0px, 0px) scale(1, 1)')
    expect(el.style.transition).toContain('transform')
    el.dispatchEvent(new Event('transitionend'))
    expect(el.style.transform).toBe('')
    expect(el.style.transition).toBe('')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('getTabPanelRect 按 aria-labelledby 查询面板矩形', () => {
    const panel = document.createElement('div')
    panel.setAttribute('aria-labelledby', 'tab-order-IF2608')
    document.body.appendChild(panel)
    const r = getTabPanelRect('tab-order-IF2608')
    expect(r).not.toBeNull()
    expect(r).toHaveProperty('left')
    document.body.removeChild(panel)
  })

  it('getTabPanelRect 找不到时返回 null', () => {
    expect(getTabPanelRect('tab-missing')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/utils/flip.test.ts -v
```

Expected: FAIL —— `Cannot find module './flip'`。

- [ ] **Step 3: 实现 `utils/flip.ts`**

```ts
export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

/** 计算元素当前视口矩形 */
export function getRect(el: HTMLElement): FlipRect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** FLIP 反向变换参数：目标尺寸为 0 时 scale 取 1，避免除零 */
export function computeFlipDeltas(from: FlipRect, to: FlipRect) {
  return {
    dx: from.left - to.left,
    dy: from.top - to.top,
    sx: to.width > 0 ? from.width / to.width : 1,
    sy: to.height > 0 ? from.height / to.height : 1,
  }
}

/**
 * 对元素执行 FLIP 动画：元素已处于 to 位置，先施加 from→to 的反向 transform，
 * 强制 reflow 后过渡到恒等变换，动画结束清除内联样式并回调 onDone。
 */
export function flipToRect(
  el: HTMLElement,
  from: FlipRect,
  to: FlipRect,
  opts: { duration?: number; onDone?: () => void } = {},
): void {
  const { dx, dy, sx, sy } = computeFlipDeltas(from, to)
  el.style.transition = 'none'
  el.style.transformOrigin = '0 0'
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  void el.offsetWidth // 强制 reflow
  el.style.transition = `transform ${opts.duration ?? 220}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
  el.style.transform = 'translate(0, 0) scale(1, 1)'
  el.addEventListener(
    'transitionend',
    () => {
      el.style.transition = ''
      el.style.transformOrigin = ''
      el.style.transform = ''
      opts.onDone?.()
    },
    { once: true },
  )
}

/** 按 aria-labelledby 查找标签面板并返回其矩形；未渲染时返回 null */
export function getTabPanelRect(tabId: string): FlipRect | null {
  const panel = document.querySelector<HTMLElement>(`[aria-labelledby="${tabId}"]`)
  return panel ? getRect(panel) : null
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/utils/flip.test.ts -v
```

Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/flip.ts frontend/src/utils/flip.test.ts
git commit -m "feat(utils): FLIP 位移动画工具 flipToRect + getTabPanelRect"
```

---

### Task 5: 拖拽脱离工具 `utils/detachDrag`

**Files:**
- Create: `frontend/src/utils/detachDrag.ts`
- Test: `frontend/src/utils/detachDrag.test.ts`

**Interfaces:**
- Consumes: `useTabStore`、`useFloatingWindowStore`、`defaultFloatingSize`（Task 2）。
- Produces:
  - `export interface DetachDragParams`（`event: PointerEvent`、`sourceEl: HTMLElement`、`canDetach: () => boolean`、`ghostKind?: 'pill' | 'content'`、`getContentNode?: () => HTMLElement | null`、`threshold?: number`、`onDetaching?: () => void`、`onDetach: (pos: { x: number; y: number }) => void`）
  - `export function detachTabAt(tabId: string, pos: { x: number; y: number }): boolean`
  - `export function startDetachDrag(p: DetachDragParams): void`

- [ ] **Step 1: 写失败测试 `detachDrag.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { detachTabAt, startDetachDrag } from './detachDrag'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

describe('utils/detachDrag', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
    })
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('detachTabAt 可关闭标签：登记窗口并切活跃到 market', () => {
    const ok = detachTabAt('tab-settings', { x: 200, y: 150 })
    expect(ok).toBe(true)
    expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeDefined()
  })

  it('detachTabAt 固定标签：返回 false', () => {
    expect(detachTabAt('tab-market', { x: 0, y: 0 })).toBe(false)
  })

  it('detachTabAt 拖离活跃标签后活跃切回 market', () => {
    useTabStore.getState().setActiveTab('tab-settings')
    detachTabAt('tab-settings', { x: 200, y: 150 })
    expect(useTabStore.getState().activeTabId).toBe('tab-market')
  })

  it('startDetachDrag 未超阈值：不脱离、不产生 ghost、不回调', () => {
    const onDetach = vi.fn()
    const onDetaching = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetaching,
      onDetach,
    })
    fireEvent.pointerMove(window, { clientX: 14, clientY: 12 }) // 位移 < 6px
    fireEvent.pointerUp(window, { clientX: 14, clientY: 12 })
    expect(onDetaching).not.toHaveBeenCalled()
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })

  it('startDetachDrag 超阈值：触发 onDetaching、产生 ghost、松手回调并清理', () => {
    const onDetach = vi.fn()
    const onDetaching = vi.fn()
    const source = document.createElement('div')
    source.style.width = '100px'
    source.style.height = '30px'
    document.body.appendChild(source)
    startDetachDrag({
      event: new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetaching,
      onDetach,
    })
    fireEvent.pointerMove(window, { clientX: 60, clientY: 80 }) // 位移 > 6px
    expect(onDetaching).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[style*="position: fixed"]')).not.toBeNull()
    fireEvent.pointerUp(window, { clientX: 60, clientY: 80 })
    expect(onDetach).toHaveBeenCalledWith({ x: 60, y: 80 })
    // ghost 已清理
    expect(document.querySelectorAll('[style*="position: fixed"]')).toHaveLength(0)
    document.body.removeChild(source)
  })

  it('startDetachDrag 拖拽中途 canDetach 变 false：取消', () => {
    const onDetach = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: new PointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }),
      sourceEl: source,
      canDetach: () => false,
      onDetach,
    })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 })
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })

  it('startDetachDrag 中途 pointercancel：取消并清理，不回调', () => {
    const onDetach = vi.fn()
    const source = document.createElement('div')
    document.body.appendChild(source)
    startDetachDrag({
      event: new PointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }),
      sourceEl: source,
      canDetach: () => true,
      onDetach,
    })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(window)
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 })
    expect(onDetach).not.toHaveBeenCalled()
    document.body.removeChild(source)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/utils/detachDrag.test.ts -v
```

Expected: FAIL —— `Cannot find module './detachDrag'`。

- [ ] **Step 3: 实现 `utils/detachDrag.ts`**

```ts
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore, defaultFloatingSize } from '@/stores/floatingWindows'

export interface DetachDragParams {
  /** 底层 PointerEvent（React 事件用 e.nativeEvent 传入） */
  event: PointerEvent
  /** 拖拽起点元素（标签或面板），pill ghost 直接克隆它 */
  sourceEl: HTMLElement
  /** 是否允许拖出 */
  canDetach: () => boolean
  /** ghost 类型：'pill' 克隆 sourceEl；'content' 克隆 getContentNode() */
  ghostKind?: 'pill' | 'content'
  /** content ghost 的克隆源（整个面板） */
  getContentNode?: () => HTMLElement | null
  /** 拖拽阈值（px），超过才进入脱离状态 */
  threshold?: number
  /** 进入脱离状态时回调（用于抑制随后的 click） */
  onDetaching?: () => void
  /** 松手时回调（光标 client 坐标） */
  onDetach: (pos: { x: number; y: number }) => void
}

/** 将标签在光标位置脱离为浮动窗口；固定标签返回 false；若拖离的是活跃标签自动切回 market */
export function detachTabAt(tabId: string, pos: { x: number; y: number }): boolean {
  const state = useTabStore.getState()
  const tab = state.tabs.find((t) => t.id === tabId)
  if (!tab || !tab.closable) return false
  const { w, h } = defaultFloatingSize()
  const x = Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w))
  const y = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - 40))
  const ok = useFloatingWindowStore.getState().detach(tabId, { x, y, w, h })
  if (ok && state.activeTabId === tabId) {
    const market = state.tabs.find((t) => t.type === 'market')
    if (market) useTabStore.getState().setActiveTab(market.id)
  }
  return ok
}

/** 开始一次拖拽脱离手势；内部管理 window pointermove/pointerup 与 ghost 生命周期 */
export function startDetachDrag(p: DetachDragParams): void {
  const threshold = p.threshold ?? 6
  const startX = p.event.clientX
  const startY = p.event.clientY
  let detached = false
  let ghost: HTMLElement | null = null

  const removeGhost = () => {
    ghost?.remove()
    ghost = null
  }
  const cleanup = () => {
    removeGhost()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cleanup)
    window.removeEventListener('keydown', onKeyDown)
  }
  // Esc / pointercancel 取消拖拽（spec §9）
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup()
  }
  const createGhost = () => {
    const node = p.ghostKind === 'content' ? (p.getContentNode?.() ?? p.sourceEl) : p.sourceEl
    const clone = node.cloneNode(true) as HTMLElement
    const r = node.getBoundingClientRect()
    clone.style.position = 'fixed'
    clone.style.left = `${r.left}px`
    clone.style.top = `${r.top}px`
    clone.style.width = `${r.width}px`
    clone.style.margin = '0'
    clone.style.pointerEvents = 'none'
    clone.style.zIndex = '2000'
    document.body.appendChild(clone)
    ghost = clone
  }
  const onMove = (ev: PointerEvent) => {
    if (!p.canDetach()) {
      cleanup()
      return
    }
    if (!detached) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return
      detached = true
      p.onDetaching?.()
      createGhost()
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX - ghost.offsetWidth / 2}px`
      ghost.style.top = `${ev.clientY - ghost.offsetHeight / 2}px`
    }
  }
  const onUp = (ev: PointerEvent) => {
    if (detached) p.onDetach({ x: ev.clientX, y: ev.clientY })
    cleanup()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cleanup)
  window.addEventListener('keydown', onKeyDown)
  p.event.preventDefault()
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/utils/detachDrag.test.ts -v
```

Expected: PASS（5 个用例）。若 jsdom 不支持 `fireEvent.pointerMove(window, ...)` 派发 PointerEvent，将测试改为 `fireEvent(window, new MouseEvent('pointermove', { clientX, clientY, bubbles: true }))`。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/detachDrag.ts frontend/src/utils/detachDrag.test.ts
git commit -m "feat(utils): 拖拽脱离工具 startDetachDrag + detachTabAt"
```

---

### Task 6: FloatingWindow chrome 壳 + App 接线

**Files:**
- Create: `frontend/src/components/FloatingWindow/index.tsx`
- Create: `frontend/src/components/FloatingWindow/styles.css`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/FloatingWindow/index.test.tsx`

**Interfaces:**
- Consumes: `useFloatingWindowStore`（Task 2）、`useTabStore`、`ResizeHandle`。
- Produces: `export function FloatingWindows()` 容器（遍历 windows 渲染壳，清理已关闭标签残留）；`FloatingWindow` 提供 `⇩` 停靠、`×` 关闭、拖标题条移动、右下角缩放。

- [ ] **Step 1: 写失败测试 `FloatingWindow/index.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingWindows } from './index'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useTabStore } from '@/stores/tabs'

// Mock 面板内容：浮动面板由 TabContent 渲染，此处只测 chrome 壳
vi.mock('@/components/ResizeHandle', () => ({
  ResizeHandle: ({ onPointerDown, 'aria-label': label }: { onPointerDown?: (e: React.PointerEvent) => void; 'aria-label'?: string }) => (
    <div data-testid="resize-handle" aria-label={label} onPointerDown={onPointerDown} />
  ),
}))

const tabs = [
  { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
  { id: 'tab-settings', type: 'settings' as const, title: '⚙ 设置', props: {}, closable: true },
]

describe('FloatingWindows', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs, activeTabId: 'tab-market' })
    useFloatingWindowStore.setState({ windows: {} })
  })

  it('无浮动窗口时不渲染', () => {
    const { container } = render(<FloatingWindows />)
    expect(container.firstChild).toBeNull()
  })

  it('为浮动标签渲染 chrome 壳（标题 + 操作按钮）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    expect(screen.getByText('⚙ 设置')).toBeInTheDocument()
    expect(screen.getByLabelText('停靠到标签栏')).toBeInTheDocument()
    expect(screen.getByLabelText('关闭标签')).toBeInTheDocument()
  })

  it('点击 ⇩ 停靠按钮应移除窗口登记', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.click(screen.getByLabelText('停靠到标签栏'))
    expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeUndefined()
  })

  it('点击 × 关闭按钮应 closeTab', () => {
    const closeTab = vi.fn()
    useTabStore.setState({ tabs, activeTabId: 'tab-market', closeTab })
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.click(screen.getByLabelText('关闭标签'))
    expect(closeTab).toHaveBeenCalledWith('tab-settings')
  })

  it('拖标题条应 move 窗口', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.pointerDown(screen.getByText('⚙ 设置'), { clientX: 100, clientY: 100, button: 0 })
    fireEvent.pointerMove(window, { clientX: 160, clientY: 130 })
    fireEvent.pointerUp(window, { clientX: 160, clientY: 130 })
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(70)
    expect(w.y).toBe(50)
  })

  it('拖右下角缩放柄应 resize 窗口', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent.pointerDown(screen.getByTestId('resize-handle'), { clientX: 400, clientY: 320, button: 0 })
    fireEvent.pointerMove(window, { clientX: 500, clientY: 400 })
    fireEvent.pointerUp(window, { clientX: 500, clientY: 400 })
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.w).toBe(500)
    expect(w.h).toBe(380)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/components/FloatingWindow/index.test.tsx -v
```

Expected: FAIL —— `Cannot find module './index'`。

- [ ] **Step 3: 实现 `FloatingWindow/index.tsx`**

```tsx
import { useCallback, useRef, useEffect } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { ResizeHandle } from '@/components/ResizeHandle'
import './styles.css'

interface FloatingWindowProps {
  tabId: string
}

/**
 * FloatingWindow — 浮动窗口 chrome 壳（不含业务内容）
 *
 * 业务内容由 TabContent 以 position:fixed 位移盖在壳上；壳只画标题条
 * （拖拽移动 / ⇩ 停靠 / × 关闭）与右下角缩放柄。
 */
function FloatingWindow({ tabId }: FloatingWindowProps) {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === tabId))
  const rect = useFloatingWindowStore((s) => s.windows[tabId])
  const move = useFloatingWindowStore((s) => s.move)
  const resize = useFloatingWindowStore((s) => s.resize)
  const dock = useFloatingWindowStore((s) => s.dock)
  const focus = useFloatingWindowStore((s) => s.focus)
  const closeTab = useTabStore((s) => s.closeTab)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const handleChromePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      if (!rect) return
      focus(tabId)
      dragStartRef.current = { x: e.clientX, y: e.clientY, ox: rect.x, oy: rect.y }
      const onMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return
        const nx = Math.min(Math.max(0, dragStartRef.current.ox + ev.clientX - dragStartRef.current.x), window.innerWidth - 40)
        const ny = Math.min(Math.max(0, dragStartRef.current.oy + ev.clientY - dragStartRef.current.y), window.innerHeight - 40)
        move(tabId, { x: nx, y: ny })
      }
      const onUp = () => {
        dragStartRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [tabId, rect, focus, move],
  )

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      if (!rect) return
      focus(tabId)
      const startX = e.clientX
      const startY = e.clientY
      const ow = rect.w
      const oh = rect.h
      const onMove = (ev: PointerEvent) => {
        const w = Math.max(320, ow + (ev.clientX - startX))
        const h = Math.max(200, oh + (ev.clientY - startY))
        resize(tabId, { w, h })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [tabId, rect, focus, resize],
  )

  if (!tab || !rect) return null

  return (
    <>
      <div
        className="floating-window__chrome"
        style={{ left: rect.x, top: rect.y, width: rect.w, zIndex: rect.z - 1 }}
        data-testid={`floating-window-${tabId}`}
        onPointerDown={handleChromePointerDown}
      >
        <span className="floating-window__title">{tab.title}</span>
        <div className="floating-window__actions">
          <button
            type="button"
            className="floating-window__btn"
            aria-label="停靠到标签栏"
            title="停靠到标签栏"
            onClick={() => dock(tabId)}
          >
            ⇩
          </button>
          <button
            type="button"
            className="floating-window__btn"
            aria-label="关闭标签"
            title="关闭"
            onClick={() => closeTab(tabId)}
          >
            ×
          </button>
        </div>
      </div>
      <ResizeHandle
        className="floating-window__resize"
        direction="horizontal"
        aria-label="调整窗口大小"
        style={{ left: rect.x + rect.w - 12, top: rect.y + rect.h - 12, zIndex: rect.z + 1 }}
        onPointerDown={handleResizePointerDown}
      />
    </>
  )
}

/** 浮动窗口容器：遍历 windows 渲染壳，并清理已关闭标签的残留登记 */
export function FloatingWindows() {
  const windows = useFloatingWindowStore((s) => s.windows)
  const tabs = useTabStore((s) => s.tabs)

  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id))
    const { windows: w, dock } = useFloatingWindowStore.getState()
    Object.keys(w).forEach((id) => {
      if (!ids.has(id)) dock(id)
    })
  }, [tabs])

  const floatingTabIds = Object.keys(windows).filter((id) => tabs.some((t) => t.id === id))
  if (floatingTabIds.length === 0) return null
  return (
    <>
      {floatingTabIds.map((tabId) => (
        <FloatingWindow key={tabId} tabId={tabId} />
      ))}
    </>
  )
}
```

`FloatingWindow/styles.css`：

```css
/* ── FloatingWindow chrome 壳（业务内容由 TabContent 位移覆盖） ── */

.floating-window__chrome {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  cursor: move;
  user-select: none;
}

.floating-window__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.floating-window__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.floating-window__btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.floating-window__btn:hover {
  background: var(--accent-dim);
  color: var(--accent);
}

.floating-window__resize {
  position: fixed;
}
```

- [ ] **Step 4: App.tsx 接线**

在 `App.tsx` 顶部 import 区加入：

```tsx
import { FloatingWindows } from '@/components/FloatingWindow'
```

在 `<QueryPopup />` 之后（`</div>` 之前）渲染：

```tsx
      {/* 浮动标签窗口（chrome 壳；内容由 TabContent 位移覆盖） */}
      <FloatingWindows />
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run src/components/FloatingWindow/index.test.tsx src/App.test.tsx -v
```

Expected: 全部 PASS。若 `App.test.tsx` 因 FloatingWindows 引入新依赖报错，为其追加 `vi.mock('@/components/FloatingWindow', () => ({ FloatingWindows: () => null }))`。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FloatingWindow/index.tsx frontend/src/components/FloatingWindow/styles.css frontend/src/components/FloatingWindow/index.test.tsx frontend/src/App.tsx
git commit -m "feat(FloatingWindow): chrome 壳 + FloatingWindows 容器 + App 接线"
```

---

### Task 7: TabBar 标签拖拽脱离 + 浮动标签隐藏

**Files:**
- Modify: `frontend/src/components/TabBar/index.tsx`
- Test: `frontend/src/components/TabBar/index.test.tsx`

**Interfaces:**
- Consumes: `startDetachDrag`、`detachTabAt`（Task 5）、`useFloatingWindowStore`（Task 2）。
- Produces: 可关闭标签支持拖离（药丸 ghost），浮动标签从标签栏隐藏，拖离后抑制随后的 click（避免误切标签）。

- [ ] **Step 1: 写失败测试**

在 `components/TabBar/index.test.tsx` 顶部加入对 `@/utils/detachDrag` 的 mock 与 spy。**注意：`@/stores/floatingWindows` 走真实 store**（TabBar 用 `windows` 隐藏浮动标签），只 mock detachDrag：

```tsx
const detachMock = vi.hoisted(() => ({
  startDetachDrag: vi.fn(),
  detachTabAt: vi.fn(),
}))

vi.mock('@/utils/detachDrag', () => detachMock)
```

在 import 区加入：

```tsx
import { useFloatingWindowStore } from '@/stores/floatingWindows'
```

在 `describe('TabBar')` 的 `beforeEach` 中加入：

```tsx
  detachMock.startDetachDrag.mockReset()
  detachMock.detachTabAt.mockReset()
  useFloatingWindowStore.setState({ windows: {} })
  useTabStore.setState(defaultState)
```

新增测试块：

```tsx
describe('拖拽脱离', () => {
  it('可关闭标签按下时调用 startDetachDrag（pill ghost）', () => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
    })
    render(<TabBar />)
    fireEvent.pointerDown(screen.getByText('⚙ 设置'), { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).toHaveBeenCalledTimes(1)
    const params = detachMock.startDetachDrag.mock.calls[0][0]
    expect(params.ghostKind).toBe('pill')
    expect(params.canDetach()).toBe(true)
  })

  it('固定标签不调用 startDetachDrag', () => {
    render(<TabBar />)
    fireEvent.pointerDown(screen.getByText('📊 行情'), { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
  })

  it('拖离后抑制随后的 click（不切换标签）', () => {
    const setActiveTab = vi.fn()
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
      setActiveTab,
    })
    render(<TabBar />)
    fireEvent.pointerDown(screen.getByText('⚙ 设置'), { clientX: 10, clientY: 10, button: 0 })
    const params = detachMock.startDetachDrag.mock.calls[0][0]
    params.onDetaching?.() // 模拟拖拽超阈值
    fireEvent.click(screen.getByText('⚙ 设置'))
    expect(setActiveTab).not.toHaveBeenCalled()
    // 下一次正常点击应恢复
    fireEvent.click(screen.getByText('⚙ 设置'))
    expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
  })

  it('浮动标签应从标签栏隐藏', () => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-market',
    })
    useFloatingWindowStore.setState({
      windows: { 'tab-settings': { x: 0, y: 0, w: 400, h: 300, z: 1401 } },
    })
    render(<TabBar />)
    expect(screen.queryByText('⚙ 设置')).toBeNull()
    expect(screen.getByText('📊 行情')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/components/TabBar/index.test.tsx -v
```

Expected: 新增用例 FAIL。

- [ ] **Step 3: 实现 TabBar 修改**

在 `components/TabBar/index.tsx`：

- import 区追加：

```tsx
import { startDetachDrag, detachTabAt } from '@/utils/detachDrag'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import type { Tab } from '@/stores/tabs'
```

- 组件内加入：

```tsx
  const windows = useFloatingWindowStore((s) => s.windows)
  const suppressClickRef = useRef(false)

  // 标签栏拖拽脱离（药丸 ghost）；阈值由 startDetachDrag 内部判定
  const handleTabPointerDown = useCallback((e: React.PointerEvent, tab: Tab) => {
    if (e.button !== 0 || !tab.closable) return
    startDetachDrag({
      event: e.nativeEvent,
      sourceEl: e.currentTarget,
      canDetach: () => tab.closable,
      ghostKind: 'pill',
      onDetaching: () => { suppressClickRef.current = true },
      onDetach: (pos) => detachTabAt(tab.id, pos),
    })
  }, [])
```

- 键盘导航与渲染改用 `visibleTabs`（排除浮动标签）：

```tsx
  const visibleTabs = tabs.filter((t) => !windows[t.id])
```

把 `handleKeyDown` 中所有 `tabs` 引用替换为 `visibleTabs`；渲染 `tabs.map(...)` 改为 `visibleTabs.map(...)`。

- 标签 onClick 加入抑制判断：

```tsx
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            setActiveTab(tab.id)
          }}
```

- 标签元素加入 `onPointerDown`：

```tsx
          onPointerDown={(e) => handleTabPointerDown(e, tab)}
```

> 注意：`Tab` 类型需从 `@/stores/tabs` 显式导入（`import type { Tab }`），`handleKeyDown` 依赖数组改为 `[visibleTabs, activeTabId, setActiveTab]`。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/components/TabBar/index.test.tsx -v
```

Expected: 全部 PASS（原有用例 + 新增 4 个）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TabBar/index.tsx frontend/src/components/TabBar/index.test.tsx
git commit -m "feat(TabBar): 标签拖拽脱离 + 浮动标签隐藏 + 拖后抑制点击"
```

---

### Task 8: 页面标题栏 `data-drag-handle` + TabContent 拖拽委托

**Files:**
- Modify: `frontend/src/components/TabContent/index.tsx`
- Modify: `frontend/src/components/TabContent/styles.css`
- Modify: `frontend/src/pages/OrderPage.tsx`
- Modify: `frontend/src/modules/market/MarketPanel.tsx`
- Modify: `frontend/src/pages/FavoritesPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/IPCMonitorPage.tsx`
- Modify: `frontend/src/modules/query/QueryPanel.tsx`
- Modify: `frontend/src/pages/KLinePage.tsx`
- Test: `frontend/src/components/TabContent/index.test.tsx`
- Test: `frontend/src/pages/__tests__/OrderPage.test.tsx`

**Interfaces:**
- Consumes: `startDetachDrag`、`detachTabAt`（Task 5）。
- Produces: 每个可关闭标签面板内，命中 `[data-drag-handle]`（且非按钮/输入框）的 pointerdown 触发内容 ghost 拖拽脱离；各页头部带 `data-drag-handle` 属性。

- [ ] **Step 1: 写失败测试（TabContent 委托）**

在 `components/TabContent/index.test.tsx` 顶部加 detachDrag mock：

```tsx
const detachMock = vi.hoisted(() => ({ startDetachDrag: vi.fn(), detachTabAt: vi.fn() }))
vi.mock('@/utils/detachDrag', () => detachMock)
```

在 `describe('TabContent')` 的 `beforeEach` 中重置并设置浮动 store：

```tsx
  beforeEach(() => {
    detachMock.startDetachDrag.mockReset()
    useFloatingWindowStore.setState({ windows: {} })
    useTabStore.setState({ tabs: [MARKET_TAB], activeTabId: MARKET_TAB.id })
  })
```

新增测试块：

```tsx
describe('页面标题栏拖拽委托', () => {
  it('命中 [data-drag-handle] 且可关闭时调用 startDetachDrag（content ghost）', () => {
    useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
    render(<TabContent />)
    const panel = getAllPanels()[1] // [market, settings]
    const handle = document.createElement('div')
    handle.setAttribute('data-drag-handle', '')
    panel.appendChild(handle)
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).toHaveBeenCalledTimes(1)
    const params = detachMock.startDetachDrag.mock.calls[0][0]
    expect(params.ghostKind).toBe('content')
    expect(params.canDetach()).toBe(true)
  })

  it('命中按钮时不调用 startDetachDrag', () => {
    useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
    render(<TabContent />)
    const panel = getAllPanels()[1]
    const btn = document.createElement('button')
    btn.setAttribute('data-drag-handle', '')
    panel.appendChild(btn)
    fireEvent.pointerDown(btn, { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
  })

  it('固定标签（market）不调用 startDetachDrag', () => {
    render(<TabContent />)
    const panel = getAllPanels()[0]
    const handle = document.createElement('div')
    handle.setAttribute('data-drag-handle', '')
    panel.appendChild(handle)
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
  })

  it('非 [data-drag-handle] 区域不调用 startDetachDrag', () => {
    useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
    render(<TabContent />)
    const panel = getAllPanels()[1]
    fireEvent.pointerDown(panel, { clientX: 10, clientY: 10, button: 0 })
    expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
  })
})
```

> 注：现有 import 为 `import { render, screen } from '@testing-library/react'`，需补 `fireEvent`：`import { render, screen, fireEvent } from '@testing-library/react'`。

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/components/TabContent/index.test.tsx -v
```

Expected: 新增用例 FAIL（委托逻辑未实现）。

- [ ] **Step 3: 实现 TabContent 委托 + 样式**

在 `components/TabContent/index.tsx`：

```tsx
import { startDetachDrag, detachTabAt } from '@/utils/detachDrag'
// ...
            onPointerDown={(e) => {
              if (floating) {
                useFloatingWindowStore.getState().focus(tab.id)
                return
              }
              if (!tab.closable) return
              const target = e.target as HTMLElement
              if (target.closest('button, input, select, a, [data-no-drag]')) return
              if (!target.closest('[data-drag-handle]')) return
              startDetachDrag({
                event: e.nativeEvent,
                sourceEl: e.currentTarget,
                canDetach: () => tab.closable,
                ghostKind: 'content',
                getContentNode: () => e.currentTarget,
                onDetach: (pos) => detachTabAt(tab.id, pos),
              })
            }}
```

在 `styles.css` 追加：

```css
/* ── 页面标题栏拖拽句柄（转换为浮动弹窗的手势区） ── */
[data-drag-handle] {
  cursor: grab;
  user-select: none;
}

[data-drag-handle]:active {
  cursor: grabbing;
}
```

- [ ] **Step 4: 为各页头部加 `data-drag-handle` 属性**

1. `pages/OrderPage.tsx` —— 第 67 行附近标题栏：`<div className="order-page__title-bar">` → `<div className="order-page__title-bar" data-drag-handle>`。
2. `modules/market/MarketPanel.tsx` —— 两处 `<div className="market-tabs">` → 加 `data-drag-handle`。
3. `pages/FavoritesPage.tsx` —— 两处 `<div className="favorites-page__header">` → 加 `data-drag-handle`。
4. `pages/SettingsPage.tsx` —— `<div className="settings-page__header">` → 加 `data-drag-handle`。
5. `pages/IPCMonitorPage.tsx` —— `<div className="ipc-monitor-page__header">` → 加 `data-drag-handle`。
6. `modules/query/QueryPanel.tsx` —— `<div className="panel-header">` → 加 `data-drag-handle`。
7. `pages/KLinePage.tsx` —— 因图表交互密集，**加一条专用拖条**而非整块内容：

```tsx
      {instrumentID && (
        <div className="kline-page__content">
          <div className="kline-page__drag" data-drag-handle title="拖动此栏可将标签转为弹窗">
            📈 拖动此栏可转弹窗
          </div>
          <KLineChart
            instrument={instrumentID}
            name={contract?.instrumentName}
            latestPrice={latestPrice}
            klineData={data}
            period={currentPeriod}
            onPeriodChange={setPeriod}
          />
        </div>
      )}
```

`KLinePage.css` 追加：

```css
.kline-page__drag {
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
}
```

- [ ] **Step 5: 页面句柄存在性测试**

在 `pages/__tests__/OrderPage.test.tsx` 追加一条断言（沿用该文件既有 mock 结构）：

```tsx
it('标题栏应带 data-drag-handle（可拖为弹窗）', () => {
  const { container } = render(<OrderPage instrumentID="IF2608" />)
  const bar = container.querySelector('.order-page__title-bar')
  expect(bar).toHaveAttribute('data-drag-handle')
})
```

- [ ] **Step 6: 运行测试确认通过**

```bash
npx vitest run src/components/TabContent/index.test.tsx src/pages/__tests__/OrderPage.test.tsx -v
```

Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/TabContent/index.tsx frontend/src/components/TabContent/styles.css frontend/src/pages/OrderPage.tsx frontend/src/modules/market/MarketPanel.tsx frontend/src/pages/FavoritesPage.tsx frontend/src/pages/SettingsPage.tsx frontend/src/pages/IPCMonitorPage.tsx frontend/src/modules/query/QueryPanel.tsx frontend/src/pages/KLinePage.tsx frontend/src/pages/KLinePage.css frontend/src/components/TabContent/index.test.tsx frontend/src/pages/__tests__/OrderPage.test.tsx
git commit -m "feat(detach): 页面标题栏 data-drag-handle + TabContent 拖拽委托"
```

---

### Task 9: 弹窗 ⤢ 放大按钮（OrderPopup + QueryPopup）

**Files:**
- Modify: `frontend/src/modules/order/OrderPopup.tsx`
- Modify: `frontend/src/modules/order/OrderPopup.css`
- Modify: `frontend/src/modules/query/QueryPopup.tsx`
- Modify: `frontend/src/modules/query/QueryPopup.css`
- Test: `frontend/src/modules/order/OrderPopup.test.tsx`
- Test: `frontend/src/modules/query/QueryPopup.test.tsx`

**Interfaces:**
- Consumes: `useTabStore.openTab`（Task 1 `query` 类型）、`getRect`/`flipToRect`/`getTabPanelRect`（Task 4）、`toast`、`flushSync`。
- Produces: 两个弹窗标题栏出现 `⤢` 按钮（aria-label `放大为标签页`）；点击 → 打开/激活对应标签 → FLIP 弹窗到面板 → 关闭弹窗；标签满 15 时 toast 提示并保持弹窗。

- [ ] **Step 1: 写失败测试（OrderPopup）**

在 `modules/order/OrderPopup.test.tsx` 顶部加入 mock：

```tsx
// Mock FLIP 工具：jsdom 无真实布局，同步触发 onDone
vi.mock('@/utils/flip', () => ({
  getRect: () => ({ left: 0, top: 0, width: 740, height: 500 }),
  flipToRect: (_el: HTMLElement, _from: unknown, _to: unknown, opts: { onDone?: () => void } = {}) => {
    opts.onDone?.()
  },
  getTabPanelRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
}))
import { useTabStore } from '@/stores/tabs'
```

新增测试块：

```tsx
describe('⤢ 放大为标签页', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
  })

  it('应渲染放大按钮', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(screen.getByLabelText('放大为标签页')).toBeInTheDocument()
  })

  it('点击放大应打开 order 标签并关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    const { tabs, activeTabId } = useTabStore.getState()
    expect(tabs.some((t) => t.type === 'order' && t.props.instrumentID === 'IF2608')).toBe(true)
    expect(activeTabId).toBe('tab-order-IF2608')
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('标签页达上限时 toast 提示且弹窗保持', () => {
    const { openTab } = useTabStore.getState()
    // 占满 15 个
    for (let i = 0; i < 14; i++) {
      openTab({ type: 'order', title: `合约${i}`, props: { instrumentID: `c${i}` } })
    }
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2608') // 弹窗保持
  })
})
```

- [ ] **Step 2: 写失败测试（QueryPopup）**

在 `modules/query/QueryPopup.test.tsx` 顶部加同样的 `@/utils/flip` mock 与 `useTabStore` import，新增：

```tsx
describe('⤢ 放大为标签页', () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
  })

  it('应渲染放大按钮', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    expect(screen.getByLabelText('放大为标签页')).toBeInTheDocument()
  })

  it('点击放大应打开 query 标签并关闭弹窗', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent.click(screen.getByLabelText('放大为标签页'))
    const { tabs, activeTabId } = useTabStore.getState()
    expect(tabs.some((t) => t.type === 'query')).toBe(true)
    expect(activeTabId).toBe('tab-query')
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })
})
```

- [ ] **Step 3: 运行确认失败**

```bash
npx vitest run src/modules/order/OrderPopup.test.tsx src/modules/query/QueryPopup.test.tsx -v
```

Expected: 新增用例 FAIL（`getByLabelText('放大为标签页')` 找不到）。

- [ ] **Step 4: 实现 OrderPopup ⤢**

在 `modules/order/OrderPopup.tsx`：

- import 区追加：

```tsx
import { flushSync } from 'react-dom'
import { useTabStore } from '@/stores/tabs'
import { getRect, flipToRect, getTabPanelRect } from '@/utils/flip'
import { toast } from '@/components/Toast'
```

- 组件内加处理函数：

```tsx
  // ── 放大为标签页 ──
  const handleMaximize = useCallback(() => {
    if (!instrumentID) return
    const popupEl = popupRef.current
    if (!popupEl) {
      closePopup()
      return
    }
    const from = getRect(popupEl)
    flushSync(() => {
      useTabStore.getState().openTab({
        type: 'order',
        title: `📝 报单-${instrumentID}`,
        props: { instrumentID },
      })
    })
    const to = getTabPanelRect(`tab-order-${instrumentID}`)
    if (!to) {
      closePopup()
      return
    }
    flipToRect(popupEl, from, to, { onDone: () => closePopup() })
  }, [instrumentID, closePopup])
```

- `handleMaximize` 用 `useCallback` 包裹（`useCallback` 已在现有 import 中）。标题栏在标题与 × 之间插入按钮：

```tsx
        <button
          type="button"
          className="order-popup__max"
          onClick={handleMaximize}
          aria-label="放大为标签页"
          title="放大为标签页"
        >
          ⤢
        </button>
```

- 处理「标签满 15」：`openTab` 返回 `false` 时 toast。将 `flushSync` 内改为捕获返回值：

```tsx
    let opened = false
    flushSync(() => {
      opened = useTabStore.getState().openTab({
        type: 'order',
        title: `📝 报单-${instrumentID}`,
        props: { instrumentID },
      })
    })
    if (!opened) {
      toast.error('标签页数量已达上限（15），请先关闭部分标签页')
      return
    }
```

`modules/order/OrderPopup.css` 追加（与 `__close` 同款）：

```css
.order-popup__max {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.order-popup__max:hover {
  background: var(--accent-dim);
  color: var(--accent);
}
```

> 标题栏容器是 `display:flex; justify-content: space-between`，插入该按钮后，把标题区包一层 flex（或让按钮排到最右、× 之前）。具体做法：将标题与按钮放入同一 flex 分组。

- [ ] **Step 5: 实现 QueryPopup ⤢**

在 `modules/query/QueryPopup.tsx` 做同样改动：

- import：`flushSync`、`useTabStore`、`getRect`/`flipToRect`/`getTabPanelRect`、`toast`。
- 处理函数（`query` 为全局，无 instrumentID）：

```tsx
  // ── 放大为标签页 ──
  const handleMaximize = useCallback(() => {
    const popupEl = popupRef.current
    if (!popupEl) {
      close()
      return
    }
    const from = getRect(popupEl)
    let opened = false
    flushSync(() => {
      opened = useTabStore.getState().openTab({ type: 'query', title: '📋 查询' })
    })
    if (!opened) {
      toast.error('标签页数量已达上限（15），请先关闭部分标签页')
      return
    }
    const to = getTabPanelRect('tab-query')
    if (!to) {
      close()
      return
    }
    flipToRect(popupEl, from, to, { onDone: () => close() })
  }, [close])
```

- 标题栏加按钮（`aria-label="放大为标签页"`），`QueryPopup.css` 加 `.query-popup__max`（同款样式）。

- [ ] **Step 6: 运行测试确认通过**

```bash
npx vitest run src/modules/order/OrderPopup.test.tsx src/modules/query/QueryPopup.test.tsx -v
```

Expected: 全部 PASS（含原有用例 + 新增）。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/order/OrderPopup.tsx frontend/src/modules/order/OrderPopup.css frontend/src/modules/query/QueryPopup.tsx frontend/src/modules/query/QueryPopup.css frontend/src/modules/order/OrderPopup.test.tsx frontend/src/modules/query/QueryPopup.test.tsx
git commit -m "feat(popup): 弹窗 ⤢ 放大按钮，FLIP 转标签页 + 上限 toast"
```

---

## 收尾验证

所有任务完成后：

- [ ] **全量回归**：`cd frontend && npm test`（Expected: 全部 PASS，现有 469 + 新增用例全绿）
- [ ] **类型检查**：`cd frontend && npm run build`（Expected: tsc 无错误）
- [ ] **Lint**：`cd frontend && npm run lint`（Expected: 0 warnings）
- [ ] **人工验证**（`npm run dev`）：
  - 弹窗 ⤢ → 标签页（FLIP 动画）
  - 标签栏拖标签 → 悬浮窗
  - 页面标题栏拖 → 悬浮窗
  - 浮动窗 ⇩ 停靠、× 关闭、拖标题移动、拖角缩放
  - market 固定标签不可拖出
  - 查询弹窗 ⤢ → `query` 标签渲染 QueryPanel
