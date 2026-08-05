# 弹窗自由调整大小 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有可做标签页⇄弹窗转换的弹窗（FloatingWindow / QueryPopup / OrderPopup）支持从任意边/角自由调整大小。

**Architecture:** 一个统一的缩放数学入口 `utils/resizeDrag.ts`（纯函数 `computeResizeRect` + 指针手势 `startResizeDrag`），一个支持 8 方向的通用手柄组件 `ResizeHandle`，各处接线复用：FloatingWindow 挂 8 个 fixed 手柄写 store；QueryPopup/OrderPopup 挂内部绝对定位手柄写局部 state。

**Tech Stack:** React 18 + TypeScript 5 + Vitest + @testing-library/react + Zustand。

**Spec:** `docs/superpowers/specs/2026-08-05-popup-free-resize-design.md`

## Global Constraints

- 最小尺寸：FloatingWindow `320×200`；QueryPopup `480×320`；OrderPopup `680×400`。
- 尺寸不持久化：QueryPopup/OrderPopup 每次打开回到默认尺寸；FloatingWindow 尺寸随 store 会话内有效。
- 不引入第三方库、不用 CSS `resize`；沿用 `utils/detachDrag.ts` 的手写指针事件模式。
- 指针事件用 `PointerEvent`；`Esc` / `pointercancel` 中途取消并清理监听。
- `ResizeDirection` 类型定义在 `utils/resizeDrag.ts`，`ResizeHandle` 从它导入。
- 现有前端测试须保持全绿（`cd frontend && npm test`）。
- 提交信息遵循仓库惯例（`feat:` / `fix:` / `test:` / `docs:` 前缀）。

---

### Task 1: `utils/resizeDrag.ts` — 统一缩放数学 + 指针手势

**Files:**
- Create: `frontend/src/utils/resizeDrag.ts`
- Test: `frontend/src/utils/resizeDrag.test.ts`

**Interfaces:**
- Produces:
  - `export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'horizontal' | 'vertical'`（`horizontal`/`vertical` 为 Task 4 前的兼容别名，Task 4 移除）
  - `export const RESIZE_DIRECTIONS: ResizeDirection[]`（仅 8 个真实方向）
  - `export interface ResizeRect { x: number; y: number; w: number; h: number }`
  - `export interface ResizeBounds { minW?: number; minH?: number; viewportW?: number; viewportH?: number }`
  - `export interface ResizeDragParams { event: PointerEvent; dir: ResizeDirection; rect: ResizeRect; minW?: number; minH?: number; onResize: (r: ResizeRect) => void }`
  - `export function computeResizeRect(dir, rect, dx, dy, bounds?): ResizeRect`
  - `export function startResizeDrag(p: ResizeDragParams): () => void`（返回清理函数）

- [ ] **Step 1: 写失败测试**

Create `frontend/src/utils/resizeDrag.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { computeResizeRect, startResizeDrag } from './resizeDrag'

const RECT = { x: 100, y: 50, w: 400, h: 300 }
const BOUNDS = { minW: 320, minH: 200, viewportW: 1024, viewportH: 768 }

function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('computeResizeRect', () => {
  it('e: 只改宽度', () => {
    expect(computeResizeRect('e', RECT, 50, 0, BOUNDS)).toEqual({ x: 100, y: 50, w: 450, h: 300 })
  })

  it('s: 只改高度', () => {
    expect(computeResizeRect('s', RECT, 0, 60, BOUNDS)).toEqual({ x: 100, y: 50, w: 400, h: 360 })
  })

  it('se: 同时改宽高', () => {
    expect(computeResizeRect('se', RECT, 50, 60, BOUNDS)).toEqual({ x: 100, y: 50, w: 450, h: 360 })
  })

  it('w: 左缘跟随光标，右缘锚定', () => {
    expect(computeResizeRect('w', RECT, 30, 0, BOUNDS)).toEqual({ x: 130, y: 50, w: 370, h: 300 })
  })

  it('w: 顶到 minW 时右缘锚定，x 不再右移', () => {
    const r = computeResizeRect('w', RECT, 200, 0, BOUNDS)
    expect(r.w).toBe(320)
    expect(r.x).toBe(180)
  })

  it('n: 上缘跟随光标，下缘锚定', () => {
    expect(computeResizeRect('n', RECT, 0, 40, BOUNDS)).toEqual({ x: 100, y: 90, w: 400, h: 260 })
  })

  it('nw: 左/上同时调整，锚定右下', () => {
    expect(computeResizeRect('nw', RECT, 30, 40, BOUNDS)).toEqual({ x: 130, y: 90, w: 370, h: 260 })
  })

  it('e: 宽度不超过视口右沿', () => {
    const r = computeResizeRect('e', { x: 700, y: 50, w: 100, h: 300 }, 500, 0, BOUNDS)
    expect(r.w).toBe(324) // 1024 - 700
  })

  it('w: 左缘不越出视口（x ≥ 0）', () => {
    const r = computeResizeRect('w', { x: 100, y: 50, w: 400, h: 300 }, -500, 0, BOUNDS)
    expect(r.x).toBe(0)
    expect(r.w).toBe(500)
  })

  it('未传视口时退化为不限制上限', () => {
    const r = computeResizeRect('e', RECT, 5000, 0)
    expect(r.w).toBe(5400)
  })
})

describe('startResizeDrag', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pointermove 按方向回调 onResize，pointerup 后清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'se',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 150, clientY: 110 }))
    expect(onResize).toHaveBeenLastCalledWith({ x: 100, y: 50, w: 450, h: 360 })

    fireEvent(window, pointerEvent('pointerup', { clientX: 150, clientY: 110 }))
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 200 }))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('Esc 取消并清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'e',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointermove', { clientX: 150, clientY: 50 }))
    expect(onResize).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 50 }))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('pointercancel 取消并清理监听', () => {
    const onResize = vi.fn()
    startResizeDrag({
      event: pointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, bubbles: true }),
      dir: 'e',
      rect: RECT,
      onResize,
    })
    fireEvent(window, pointerEvent('pointercancel', { clientX: 100, clientY: 50 }))
    onResize.mockClear()
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 50 }))
    expect(onResize).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/utils/resizeDrag.test.ts`
Expected: FAIL — `Cannot find module './resizeDrag'`.

- [ ] **Step 3: 写实现**

Create `frontend/src/utils/resizeDrag.ts`:

```ts
/** 缩放方向：8 个边/角 + 兼容别名（Task 4 迁移 FloatingWindow 后移除别名） */
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'horizontal' | 'vertical'

/** 真实可用的 8 个方向（FloatingWindow / QueryPopup / OrderPopup 共用） */
export const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export interface ResizeRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ResizeBounds {
  minW?: number
  minH?: number
  /** 视口宽；不传则不做视口上限（最小尺寸仍生效） */
  viewportW?: number
  viewportH?: number
}

export interface ResizeDragParams {
  /** 底层 PointerEvent（React 事件用 e.nativeEvent 传入） */
  event: PointerEvent
  /** 缩放方向 */
  dir: ResizeDirection
  /** 起始矩形（拖动期间锚定，避免累积漂移） */
  rect: ResizeRect
  minW?: number
  minH?: number
  /** 每次移动回调（已钳制） */
  onResize: (r: ResizeRect) => void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * 纯函数：给定起始矩形与光标增量，计算缩放后的矩形（含最小/视口钳制）。
 * 含 w/n 的方向锚定对侧边缘（右缘/下缘），顶到最小值时窗口不跳。
 */
export function computeResizeRect(
  dir: ResizeDirection,
  rect: ResizeRect,
  dx: number,
  dy: number,
  bounds: ResizeBounds = {},
): ResizeRect {
  const { x: ox, y: oy, w: ow, h: oh } = rect
  const minW = bounds.minW ?? 320
  const minH = bounds.minH ?? 200
  const vw = bounds.viewportW ?? Infinity
  const vh = bounds.viewportH ?? Infinity

  let x = ox
  let y = oy
  let w = ow
  let h = oh

  if (dir.includes('e')) w = ow + dx
  if (dir.includes('s')) h = oh + dy

  if (dir.includes('w')) {
    const right = ox + ow
    w = clamp(ow - dx, minW, Math.max(minW, right))
    x = right - w
  } else {
    w = clamp(w, minW, Math.max(minW, vw - ox))
  }

  if (dir.includes('n')) {
    const bottom = oy + oh
    h = clamp(oh - dy, minH, Math.max(minH, bottom))
    y = bottom - h
  } else {
    h = clamp(h, minH, Math.max(minH, vh - oy))
  }

  return { x, y, w, h }
}

/** 开始一次缩放手势；返回清理函数（卸载时调用可移除残留监听） */
export function startResizeDrag(p: ResizeDragParams): () => void {
  const bounds: ResizeBounds = {
    minW: p.minW,
    minH: p.minH,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
  }
  const startX = p.event.clientX
  const startY = p.event.clientY

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup()
  }
  const onMove = (ev: PointerEvent) => {
    p.onResize(computeResizeRect(p.dir, p.rect, ev.clientX - startX, ev.clientY - startY, bounds))
  }
  const onUp = () => {
    cleanup()
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cleanup)
    window.removeEventListener('keydown', onKeyDown)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cleanup)
  window.addEventListener('keydown', onKeyDown)
  p.event.preventDefault()

  return cleanup
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/utils/resizeDrag.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/resizeDrag.ts frontend/src/utils/resizeDrag.test.ts
git commit -m "feat(resize): 新增统一缩放数学与手势 startResizeDrag"
```

---

### Task 2: `ResizeHandle` 支持 8 方向

**Files:**
- Modify: `frontend/src/components/ResizeHandle/index.tsx`
- Modify: `frontend/src/assets/styles/global.css:304-329`（追加 8 向样式）
- Modify: `frontend/src/components/ResizeHandle/index.test.tsx`
- Test: `frontend/src/components/ResizeHandle/style.test.tsx`（不变，仍绿）

**Interfaces:**
- Consumes: `ResizeDirection`, `RESIZE_DIRECTIONS` from `@/utils/resizeDrag`
- Produces: `ResizeHandle` — `direction?: ResizeDirection`（默认 `'se'`）；`className` 形如 `resize-handle resize-handle--{dir}`

- [ ] **Step 1: 写失败测试（断言默认方向改为 se）**

Replace `frontend/src/components/ResizeHandle/index.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResizeHandle } from './index'
import { RESIZE_DIRECTIONS } from '@/utils/resizeDrag'

describe('ResizeHandle', () => {
  it('renders with se direction by default', () => {
    render(<ResizeHandle data-testid="handle" />)
    expect(screen.getByTestId('handle').className).toContain('resize-handle--se')
  })

  it.each(RESIZE_DIRECTIONS)('renders direction class for %s', (dir) => {
    render(<ResizeHandle direction={dir} data-testid={`handle-${dir}`} />)
    expect(screen.getByTestId(`handle-${dir}`).className).toContain(`resize-handle--${dir}`)
  })

  it('renders drag indicator', () => {
    render(<ResizeHandle data-testid="handle" />)
    expect(screen.getByTestId('handle').querySelector('.resize-handle__indicator')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/components/ResizeHandle/index.test.tsx`
Expected: FAIL — 默认 class 是 `resize-handle--horizontal`，断言要 `--se`。

- [ ] **Step 3: 改组件 + 追加 CSS**

Replace `frontend/src/components/ResizeHandle/index.tsx` with:

```tsx
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { ResizeDirection } from '@/utils/resizeDrag'

interface ResizeHandleProps extends HTMLAttributes<HTMLDivElement> {
  direction?: ResizeDirection
}

export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ direction = 'se', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`resize-handle resize-handle--${direction} ${className}`}
        {...props}
      >
        <div className="resize-handle__indicator" />
      </div>
    )
  }
)

ResizeHandle.displayName = 'ResizeHandle'
```

In `frontend/src/assets/styles/global.css`, **append**（在现有 `--horizontal`/`--vertical` 规则之后、Task 4 再删除旧规则）:

```css
.resize-handle--n,
.resize-handle--s {
  height: 6px;
  cursor: row-resize;
}

.resize-handle--e,
.resize-handle--w {
  width: 6px;
  cursor: col-resize;
}

.resize-handle--ne,
.resize-handle--sw {
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.resize-handle--nw,
.resize-handle--se {
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.resize-handle--n .resize-handle__indicator,
.resize-handle--s .resize-handle__indicator {
  width: 24px;
  height: 2px;
}

.resize-handle--e .resize-handle__indicator,
.resize-handle--w .resize-handle__indicator {
  width: 2px;
  height: 24px;
}

/* 四角不显示指示条，仅靠 hover 背景高亮提示可拖区 */
.resize-handle--ne .resize-handle__indicator,
.resize-handle--nw .resize-handle__indicator,
.resize-handle--se .resize-handle__indicator,
.resize-handle--sw .resize-handle__indicator {
  display: none;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/components/ResizeHandle/index.test.tsx src/components/ResizeHandle/style.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/ResizeHandle/index.tsx frontend/src/assets/styles/global.css frontend/src/components/ResizeHandle/index.test.tsx
git commit -m "feat(resize): ResizeHandle 支持 8 方向"
```

---

### Task 3: `floatingWindows` store — resize 支持完整矩形

**Files:**
- Modify: `frontend/src/stores/floatingWindows.ts:64-70`
- Modify: `frontend/src/stores/floatingWindows.test.ts:62-67,80`

**Interfaces:**
- Consumes: 无
- Produces: `resize(tabId: string, rect: { x: number; y: number; w: number; h: number }): void`（从左边/上边缩放时同步移动窗口）

- [ ] **Step 1: 更新测试为完整矩形**

In `frontend/src/stores/floatingWindows.test.ts`:

```ts
  it('resize 更新宽高', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 0, y: 0, w: 400, h: 300 })
    useFloatingWindowStore.getState().resize('tab-settings', { x: 0, y: 0, w: 600, h: 400 })
    expect(useFloatingWindowStore.getState().windows['tab-settings'].w).toBe(600)
    expect(useFloatingWindowStore.getState().windows['tab-settings'].h).toBe(400)
  })

  it('resize 支持移动（从左边/上边缩放）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    useFloatingWindowStore.getState().resize('tab-settings', { x: 40, y: 60, w: 370, h: 260 })
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(40)
    expect(w.y).toBe(60)
    expect(w.w).toBe(370)
    expect(w.h).toBe(260)
  })
```

And the no-op 断言（第 80 行附近）改为传完整矩形：

```ts
      useFloatingWindowStore.getState().resize('tab-nope', { x: 0, y: 0, w: 400, h: 300 })
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/stores/floatingWindows.test.ts`
Expected: FAIL — `resize` 尚不接受 `x`/`y`（类型/运行时 no-op，x/y 断言失败）。

- [ ] **Step 3: 改 store**

Replace `floatingWindows.ts` 中的 `resize` 方法（第 64-70 行）为：

```ts
  /** 缩放窗口（含移动，从任意边/角调整） */
  resize: (tabId, rect) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      return { windows: { ...s.windows, [tabId]: { ...cur, x: rect.x, y: rect.y, w: rect.w, h: rect.h } } }
    })
  },
```

同步更新接口注释（第 31 行）：

```ts
  /** 缩放窗口（含移动，从任意边/角调整） */
  resize: (tabId: string, rect: { x: number; y: number; w: number; h: number }) => void
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/stores/floatingWindows.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/stores/floatingWindows.ts frontend/src/stores/floatingWindows.test.ts
git commit -m "feat(resize): floatingWindows.resize 接受完整矩形（支持从边/角缩放）"
```

---

### Task 4: `FloatingWindow` 挂 8 个缩放手柄

**Files:**
- Modify: `frontend/src/components/FloatingWindow/index.tsx`
- Modify: `frontend/src/components/FloatingWindow/index.test.tsx`
- Modify: `frontend/src/utils/resizeDrag.ts`（移除 `'horizontal' | 'vertical'` 别名）
- Modify: `frontend/src/assets/styles/global.css`（删除 `--horizontal`/`--vertical` 旧规则）

**Interfaces:**
- Consumes: `startResizeDrag`, `RESIZE_DIRECTIONS`, `ResizeDirection` from `@/utils/resizeDrag`; `resize(tabId, rect)` from store
- Produces: FloatingWindow 渲染 8 个 `position: fixed` 手柄（边 6px 条带 / 角 12×12），每手柄 `aria-label="调整窗口大小 {dir}"`

- [ ] **Step 1: 更新测试（mock 改为按方向渲染 + 各方向缩放断言）**

Replace `frontend/src/components/FloatingWindow/index.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingWindows } from './index'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useTabStore } from '@/stores/tabs'

// Mock 面板内容：浮动面板由 TabContent 渲染，此处只测 chrome 壳
// ResizeHandle 按 direction 渲染可定位的测试柄
vi.mock('@/components/ResizeHandle', () => ({
  ResizeHandle: ({
    direction,
    onPointerDown,
    'aria-label': label,
  }: {
    direction: string
    onPointerDown?: (e: React.PointerEvent) => void
    'aria-label'?: string
  }) => <div data-testid={`resize-handle-${direction}`} aria-label={label} onPointerDown={onPointerDown} />,
}))

/** jsdom 24 不提供 PointerEvent 构造器；用 MouseEvent 保留 clientX/clientY/button */
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

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
    fireEvent(screen.getByText('⚙ 设置'), pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 160, clientY: 130 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 160, clientY: 130 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(70)
    expect(w.y).toBe(50)
  })

  it('渲染 8 个方向缩放手柄', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByTestId(`resize-handle-${dir}`)).toBeInTheDocument()
    })
  })

  it('拖 se 角应同时改 w/h', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-se'), pointerEvent('pointerdown', { clientX: 400, clientY: 320, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 400 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 400 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.w).toBe(500)
    expect(w.h).toBe(380)
  })

  it('拖 w 边应同时改 x 与 w（右缘锚定）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 100, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-w'), pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 60, clientY: 100 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 60, clientY: 100 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(60)
    expect(w.w).toBe(440)
  })

  it('拖 n 边应同时改 y 与 h（下缘锚定）', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 100, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-n'), pointerEvent('pointerdown', { clientX: 200, clientY: 20, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: -10 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 200, clientY: -10 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.y).toBe(0)
    expect(w.h).toBe(320)
  })

  it('拖 e 边只改 w，不移动 x', () => {
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<FloatingWindows />)
    fireEvent(screen.getByTestId('resize-handle-e'), pointerEvent('pointerdown', { clientX: 410, clientY: 100, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 460, clientY: 100 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 460, clientY: 100 }))
    const w = useFloatingWindowStore.getState().windows['tab-settings']
    expect(w.x).toBe(10)
    expect(w.w).toBe(450)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/components/FloatingWindow/index.test.tsx`
Expected: FAIL — 新 mock 期待 `data-testid="resize-handle-{dir}"`，旧组件只渲染一个无 direction 的柄。

- [ ] **Step 3: 改 FloatingWindow 组件**

Replace `frontend/src/components/FloatingWindow/index.tsx` with:

```tsx
import { useCallback, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { ResizeHandle } from '@/components/ResizeHandle'
import { startResizeDrag, RESIZE_DIRECTIONS, type ResizeDirection } from '@/utils/resizeDrag'
import './styles.css'

interface FloatingWindowProps {
  tabId: string
}

const MIN_W = 320
const MIN_H = 200

/** 每个方向手柄的 fixed 定位（相对窗口 rect） */
function handleStyle(rect: { x: number; y: number; w: number; h: number }, dir: ResizeDirection, z: number): CSSProperties {
  switch (dir) {
    case 'n': return { left: rect.x, top: rect.y - 3, width: rect.w, height: 6, zIndex: z }
    case 's': return { left: rect.x, top: rect.y + rect.h - 3, width: rect.w, height: 6, zIndex: z }
    case 'e': return { left: rect.x + rect.w - 3, top: rect.y, width: 6, height: rect.h, zIndex: z }
    case 'w': return { left: rect.x - 3, top: rect.y, width: 6, height: rect.h, zIndex: z }
    case 'ne': return { left: rect.x + rect.w - 6, top: rect.y - 6, width: 12, height: 12, zIndex: z }
    case 'nw': return { left: rect.x - 6, top: rect.y - 6, width: 12, height: 12, zIndex: z }
    case 'se': return { left: rect.x + rect.w - 6, top: rect.y + rect.h - 6, width: 12, height: 12, zIndex: z }
    case 'sw': return { left: rect.x - 6, top: rect.y + rect.h - 6, width: 12, height: 12, zIndex: z }
    default: return {}
  }
}

/**
 * FloatingWindow — 浮动窗口 chrome 壳（不含业务内容）
 *
 * 业务内容由 TabContent 以 position:fixed 位移盖在壳上；壳只画标题条
 * （拖拽移动 / ⇩ 停靠 / × 关闭）与 8 个方向缩放手柄。
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
  const activeTeardownRef = useRef<(() => void) | null>(null)

  // 卸载时清理任何活跃的拖拽/缩放 window 监听器
  useEffect(() => {
    return () => {
      activeTeardownRef.current?.()
    }
  }, [])

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
        activeTeardownRef.current?.()
      }
      activeTeardownRef.current = () => {
        dragStartRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        activeTeardownRef.current = null
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [tabId, rect, focus, move],
  )

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDirection) => {
      if (e.button !== 0) return
      e.stopPropagation()
      if (!rect) return
      focus(tabId)
      activeTeardownRef.current = startResizeDrag({
        event: e.nativeEvent,
        dir,
        rect,
        minW: MIN_W,
        minH: MIN_H,
        onResize: (r) => resize(tabId, r),
      })
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
      {RESIZE_DIRECTIONS.map((dir) => (
        <ResizeHandle
          key={dir}
          direction={dir}
          className="floating-window__resize"
          aria-label={`调整窗口大小 ${dir}`}
          style={handleStyle(rect, dir, rect.z + 1)}
          onPointerDown={(e) => handleResizePointerDown(e, dir)}
        />
      ))}
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

- [ ] **Step 4: 移除已无用的 horizontal/vertical 别名与样式**

In `frontend/src/utils/resizeDrag.ts`, change the type line:

```ts
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
```

（删除注释里的别名说明，保留其余不变。）

In `frontend/src/assets/styles/global.css`, **delete** 这两段旧规则（按内容定位，Task 2 已追加新规则，行号已偏移）：

```css
.resize-handle--horizontal {
  width: 6px;
  cursor: col-resize;
}

.resize-handle--vertical {
  height: 6px;
  cursor: row-resize;
}
```

以及：

```css
.resize-handle--horizontal .resize-handle__indicator {
  width: 2px;
  height: 24px;
}

.resize-handle--vertical .resize-handle__indicator {
  width: 24px;
  height: 2px;
}
```

- [ ] **Step 5: 运行测试 + 类型检查验证通过**

Run: `cd frontend && npx vitest run src/components/FloatingWindow/index.test.tsx src/utils/resizeDrag.test.ts src/components/ResizeHandle/index.test.tsx`
Expected: PASS。

Run: `cd frontend && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/FloatingWindow/index.tsx frontend/src/components/FloatingWindow/index.test.tsx frontend/src/utils/resizeDrag.ts frontend/src/assets/styles/global.css
git commit -m "feat(resize): FloatingWindow 支持 8 方向缩放，移除 horizontal/vertical 旧样式"
```

---

### Task 5: `QueryPopup` 支持缩放（创建共享 `usePopupResize` hook）

**Files:**
- Create: `frontend/src/hooks/usePopupResize.ts`
- Modify: `frontend/src/modules/query/QueryPopup.tsx`
- Modify: `frontend/src/modules/query/QueryPopup.css`
- Modify: `frontend/src/modules/query/QueryPopup.test.tsx`

**Interfaces:**
- Consumes: `startResizeDrag`, `RESIZE_DIRECTIONS`, `ResizeDirection` from `@/utils/resizeDrag`; `ResizeHandle` from `@/components/ResizeHandle`
- Produces:
  - `usePopupResize({ popupRef, minW, minH })` → `{ position, setPosition, size, handleResizePointerDown }`（Task 6 复用）
  - `PopupResizeHandles({ onPointerDown })` — 渲染 8 个手柄，`aria-label="调整弹窗大小 {dir}"`
  - `innerResizeHandleStyle(dir)` — 弹窗内部手柄绝对定位
  - 弹窗内 `.query-popup__handles` 覆盖层（`pointer-events: none`，子手柄 `auto`）

- [ ] **Step 1: 写失败测试**

Append 到 `frontend/src/modules/query/QueryPopup.test.tsx`（新增 `pointerEvent` helper 与缩放手柄测试块）:

```tsx
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('缩放调整大小', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 无真实布局：物化 getBoundingClientRect 为 880×620 居中矩形
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 72, top: 74, width: 880, height: 620,
      right: 952, bottom: 694,
    } as DOMRect)
  })

  it('渲染 8 个方向缩放手柄', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByLabelText(`调整弹窗大小 ${dir}`)).toBeInTheDocument()
    })
  })

  it('拖 e 手柄：更新宽度并物化位置', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 952, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 1000, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 1000, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('928px')
    expect(dialog.style.left).toBe('72px') // 居中态已物化为绝对定位
  })

  it('拖 w 手柄：左缘跟随、右缘锚定（x 与宽同时变）', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 w'), pointerEvent('pointerdown', { clientX: 72, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 40, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 40, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.left).toBe('40px')
    expect(dialog.style.width).toBe('912px')
  })

  it('缩到小于最小宽度时钳制到 480', () => {
    useQueryPopupStore.setState({ isOpen: true })
    render(<QueryPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 952, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('480px')
  })
})
```

（保留原有两个 `describe` 不动；`vi` / `fireEvent` / `render` / `screen` 已在上方导入。）

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/modules/query/QueryPopup.test.tsx`
Expected: FAIL — 弹窗还没有手柄（`getByLabelText('调整弹窗大小 …')` 找不到）。

- [ ] **Step 3: 创建共享 hook + 改 QueryPopup 组件**

Create `frontend/src/hooks/usePopupResize.ts`:

```tsx
import { useCallback, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { ResizeHandle } from '@/components/ResizeHandle'
import { startResizeDrag, RESIZE_DIRECTIONS, type ResizeDirection } from '@/utils/resizeDrag'

/** 弹窗内部手柄的绝对定位（贴内沿，overflow:hidden 不出界） */
export function innerResizeHandleStyle(dir: ResizeDirection): CSSProperties {
  switch (dir) {
    case 'n': return { top: 0, left: 0, right: 0, height: 6 }
    case 's': return { bottom: 0, left: 0, right: 0, height: 6 }
    case 'e': return { right: 0, top: 0, bottom: 0, width: 6 }
    case 'w': return { left: 0, top: 0, bottom: 0, width: 6 }
    case 'nw': return { left: 0, top: 0, width: 12, height: 12 }
    case 'ne': return { right: 0, top: 0, width: 12, height: 12 }
    case 'sw': return { left: 0, bottom: 0, width: 12, height: 12 }
    case 'se': return { right: 0, bottom: 0, width: 12, height: 12 }
    default: return {}
  }
}

/** 弹窗 8 方向缩放手柄组（放入各弹窗自己的 handles 覆盖层） */
export function PopupResizeHandles({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent, dir: ResizeDirection) => void
}) {
  return (
    <>
      {RESIZE_DIRECTIONS.map((dir) => (
        <ResizeHandle
          key={dir}
          direction={dir}
          aria-label={`调整弹窗大小 ${dir}`}
          style={innerResizeHandleStyle(dir)}
          onPointerDown={(e) => onPointerDown(e, dir)}
        />
      ))}
    </>
  )
}

export interface UsePopupResizeOptions {
  popupRef: RefObject<HTMLDivElement | null>
  minW: number
  minH: number
}

/**
 * 弹窗自由缩放：管理 position/size 局部 state，物化居中态为绝对定位，
 * 并接入 8 方向缩放手势（QueryPopup / OrderPopup 共用）。
 */
export function usePopupResize({ popupRef, minW, minH }: UsePopupResizeOptions): {
  position: { x: number; y: number } | null
  setPosition: (p: { x: number; y: number } | null) => void
  size: { w: number; h: number } | null
  handleResizePointerDown: (e: React.PointerEvent, dir: ResizeDirection) => void
} {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDirection) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const el = popupRef.current
      if (!el) return
      // 物化当前实际矩形：居中态（transform）不提供真实 left/top，先转绝对定位避免跳动
      const r = el.getBoundingClientRect()
      const rect = { x: r.left, y: r.top, w: r.width, h: r.height }
      setPosition({ x: r.left, y: r.top })
      setSize({ w: r.width, h: r.height })
      startResizeDrag({
        event: e.nativeEvent,
        dir,
        rect,
        minW,
        minH,
        onResize: (next) => {
          setPosition({ x: next.x, y: next.y })
          setSize({ w: next.w, h: next.h })
        },
      })
    },
    [popupRef, minW, minH],
  )

  return { position, setPosition, size, handleResizePointerDown }
}
```

Replace `frontend/src/modules/query/QueryPopup.tsx` with:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useQueryPopupStore } from './popupStore'
import { useTabStore } from '@/stores/tabs'
import { getRect, flipToRect, getTabPanelRect } from '@/utils/flip'
import { toast } from '@/components/Toast'
import { usePopupResize, PopupResizeHandles } from '@/hooks/usePopupResize'
import { QueryPanel } from './QueryPanel'
import './QueryPopup.css'

const MIN_W = 480
const MIN_H = 320

/**
 * QueryPopup — 悬浮查询弹窗（非模态）
 *
 * 浮于标签页之上，行情保持可见、可交互。
 * 标题栏可拖拽移动；× / ESC 关闭；8 方向自由缩放；主体为查询面板（QueryPanel）。
 */
export function QueryPopup() {
  const isOpen = useQueryPopupStore((s) => s.isOpen)
  const close = useQueryPopupStore((s) => s.close)

  const popupRef = useRef<HTMLDivElement | null>(null)

  // ── 自由缩放 + 位置（共享 hook：物化居中态 + 8 方向手势，重开回到默认尺寸）──
  const { position, setPosition, size, handleResizePointerDown } = usePopupResize({
    popupRef,
    minW: MIN_W,
    minH: MIN_H,
  })

  // ── 拖拽移动 ──
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const el = popupRef.current
      if (!el || e.button !== 0) return
      const rect = el.getBoundingClientRect()
      dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const x = Math.min(Math.max(0, ev.clientX - dragRef.current.dx), window.innerWidth - 40)
        const y = Math.min(Math.max(0, ev.clientY - dragRef.current.dy), window.innerHeight - 40)
        setPosition({ x, y })
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [setPosition],
  )

  // ── ESC 关闭 ──
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

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
    flipToRect(popupEl, from, to, { direction: 'forward', onDone: () => close() })
  }, [close])

  if (!isOpen) return null

  const popupStyle: CSSProperties = {
    ...(position
      ? { left: position.x, top: position.y }
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
    ...(size ? { width: size.w, height: size.h } : {}),
  }

  return (
    <div
      ref={popupRef}
      className="query-popup"
      role="dialog"
      aria-label="查询"
      style={popupStyle}
    >
      <div className="query-popup__header" onMouseDown={handleHeaderMouseDown}>
        <span className="query-popup__header-left">
          <span className="query-popup__title">📋 查询</span>
          <button
            type="button"
            className="query-popup__max"
            onClick={handleMaximize}
            aria-label="放大为标签页"
            title="放大为标签页"
          >
            ⤢
          </button>
        </span>
        <button
          type="button"
          className="query-popup__close"
          onClick={close}
          aria-label="关闭查询弹窗"
          title="关闭 (Esc)"
        >
          ×
        </button>
      </div>
      <div className="query-popup__body">
        <QueryPanel />
      </div>
      <div className="query-popup__handles">
        <PopupResizeHandles onPointerDown={handleResizePointerDown} />
      </div>
    </div>
  )
}
```

Append to `frontend/src/modules/query/QueryPopup.css`:

```css
/* ── 8 方向缩放手柄（内部覆盖层，不拦截非手柄区域的点击） ── */

.query-popup__handles {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}

.query-popup__handles .resize-handle {
  position: absolute;
  pointer-events: auto;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/modules/query/QueryPopup.test.tsx`
Expected: PASS（原有用例 + 4 个新增缩放用例）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/usePopupResize.ts frontend/src/modules/query/QueryPopup.tsx frontend/src/modules/query/QueryPopup.css frontend/src/modules/query/QueryPopup.test.tsx
git commit -m "feat(resize): QueryPopup 支持 8 方向自由缩放（共享 usePopupResize hook）"
```

---

### Task 6: `OrderPopup` 支持缩放

**Files:**
- Modify: `frontend/src/modules/order/OrderPopup.tsx`
- Modify: `frontend/src/modules/order/OrderPopup.css`
- Modify: `frontend/src/modules/order/OrderPopup.test.tsx`

**Interfaces:**
- Consumes: `usePopupResize`, `PopupResizeHandles` from `@/hooks/usePopupResize`（Task 5 创建）；`MIN_W = 680` / `MIN_H = 400`

- [ ] **Step 1: 写失败测试**

Append 到 `frontend/src/modules/order/OrderPopup.test.tsx`:

```tsx
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

describe('缩放调整大小', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 无真实布局：物化 getBoundingClientRect 为 740×500 居中矩形
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 142, top: 134, width: 740, height: 500,
      right: 882, bottom: 634,
    } as DOMRect)
  })

  it('渲染 8 个方向缩放手柄', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    ;['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
      expect(screen.getByLabelText(`调整弹窗大小 ${dir}`)).toBeInTheDocument()
    })
  })

  it('拖 e 手柄：更新宽度并物化位置', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 882, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 920, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 920, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('778px')
    expect(dialog.style.left).toBe('142px')
  })

  it('缩到小于最小宽度时钳制到 680', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent(screen.getByLabelText('调整弹窗大小 e'), pointerEvent('pointerdown', { clientX: 882, clientY: 300, button: 0, bubbles: true }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 500, clientY: 300 }))
    fireEvent(window, pointerEvent('pointerup', { clientX: 500, clientY: 300 }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.width).toBe('680px')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd frontend && npx vitest run src/modules/order/OrderPopup.test.tsx`
Expected: FAIL — 弹窗还没有手柄。

- [ ] **Step 3: 改 OrderPopup 组件**

在 `frontend/src/modules/order/OrderPopup.tsx`（复用 Task 5 的共享 hook）：

1. 顶部 import 追加两行（在 `import { OrderForm } from './OrderForm'` 之前）：

```tsx
import { usePopupResize, PopupResizeHandles } from '@/hooks/usePopupResize'
```

2. 文件顶部（import 之后）新增常量：

```tsx
const MIN_W = 680
const MIN_H = 400
```

3. 删除本地 `position` state 声明（`const [position, setPosition] = useState<{ x: number; y: number } | null>(null)` 这一行），改为从共享 hook 取位置与尺寸：

```tsx
  // ── 自由缩放 + 位置（共享 hook：物化居中态 + 8 方向手势，重开回到默认尺寸）──
  const { position, setPosition, size, handleResizePointerDown } = usePopupResize({
    popupRef,
    minW: MIN_W,
    minH: MIN_H,
  })
```

（`popupRef` 为组件内已有声明，勿重复声明；`useState` 若因此不再使用，需从 `import { useCallback, useEffect, useRef, useState } from 'react'` 中移除 `useState`，避免未使用变量 lint。）

4. `handleHeaderMouseDown` 的 `useCallback` 依赖数组由 `[]` 改为 `[setPosition]`（`setPosition` 现来自 hook）。

5. `popupStyle` 追加尺寸：

```tsx
  const popupStyle: CSSProperties = {
    ...(position
      ? { left: position.x, top: position.y }
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
    ...(size ? { width: size.w, height: size.h } : {}),
  }
```

6. 在 `</div>`（`.order-popup__body` 之后、容器闭合前）追加手柄覆盖层：

```tsx
      <div className="order-popup__handles">
        <PopupResizeHandles onPointerDown={handleResizePointerDown} />
      </div>
```

Append to `frontend/src/modules/order/OrderPopup.css`:

```css
/* ── 8 方向缩放手柄（内部覆盖层，不拦截非手柄区域的点击） ── */

.order-popup__handles {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}

.order-popup__handles .resize-handle {
  position: absolute;
  pointer-events: auto;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd frontend && npx vitest run src/modules/order/OrderPopup.test.tsx`
Expected: PASS（原有用例 + 3 个新增缩放用例）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/order/OrderPopup.tsx frontend/src/modules/order/OrderPopup.css frontend/src/modules/order/OrderPopup.test.tsx
git commit -m "feat(resize): OrderPopup 支持 8 方向自由缩放"
```

---

### Task 7: 全量回归 + 类型 + 构建

**Files:**
- 无代码改动（仅验证）

- [ ] **Step 1: 全量单测**

Run: `cd frontend && npm test`
Expected: 全绿（原有 469 + 本次新增 ≈ 30）。

- [ ] **Step 2: 类型检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 构建**

Run: `cd frontend && npm run build`
Expected: `tsc && vite build` 成功。

- [ ] **Step 4: 收尾说明**

若有失败，先在 TaskList 记下问题并回到对应 Task 修复；全部通过后，向用户汇报并建议人工验证：
- 打开报单/查询弹窗，拖动各边/角缩放，验证最小尺寸与视口钳制
- 脱出标签成浮动窗口，验证 8 方向缩放与停靠/关闭
