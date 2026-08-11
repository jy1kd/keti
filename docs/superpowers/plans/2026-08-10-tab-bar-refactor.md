# TabBar 标签栏功能重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构顶部 TabBar：`+` 按钮改为悬停弹出选择栏（可停靠打开报单/K线/查询/设置四个标签）；去掉标签溢出的底部滚动条，改用有界滚轮横滚（屏宽+2）+ 最右 `▾` 溢出下拉。

**Architecture:** TabBar 自持有 `+` 选择栏状态与溢出计算。`+` 悬停 → `openTab`（停靠，store 去重/上限兜底）。溢出用纯函数 `computeTabOverflow` 计算隐藏标签集，`ResizeObserver` + tabs 变化重算；`.tab-bar` 拆两段（可滚动区 + `▾` 按钮），滚轮 clamp 到 `MAX_SCROLL = 2×平均标签宽`。

**Tech Stack:** React 18 + TypeScript + Vite；Zustand；vitest + @testing-library/react；jsdom（无原生 ResizeObserver，测试需 stub）。

## Global Constraints

- 分支 `feature/TabBar-refactor`。
- 前端 `frontend/src`，无后端改动。
- `+` 选择栏打开的是**停靠标签页**（`useTabStore.openTab`），不是浮动窗。
- 选择栏 4 项固定：order/kline/query/settings（`📝 报单`/`📈 K线`/`📋 查询`/`⚙ 设置`）。
- 滚轮范围：`MAX_SCROLL = 2 × 平均标签宽`；方向：下滚向右（deltaY 正 → scrollLeft 增）、上滚向左。
- `▾` 有隐藏标签才显示；点击展开隐藏标签列表 → 点击项 `setActiveTab` + 关闭。
- 不改变标签拖拽分离（拖拽=脱离浮动窗）行为、不改变 `MAX_TABS`、不引入新标签类型。
- 保留现有键盘导航（方向键/Home/End，只切 active 不滚屏）。
- GlobalBar 移除 `onAddTab` prop 与 `openSettings`。
- 全量前端测试 + `npm run build` 必须通过。
- 测试环境 jsdom 无 `ResizeObserver`：溢出相关测试需 `globalThis.ResizeObserver` stub（沿用 `KLineChart.test.tsx` 的 mock 模式，见 Task 3）。

---

### Task 1: `computeTabOverflow` 纯函数 + 单测

**Files:**
- Create: `frontend/src/components/TabBar/overflow.ts`
- Test: `frontend/src/components/TabBar/overflow.test.ts`

**Interfaces:**
- Consumes: 无（纯函数，零依赖）。
- Produces: `computeTabOverflow(tabIds: string[], containerWidth: number, tabWidths: number[]) → { hiddenTabIds: string[]; maxScroll: number }`。Task 3 的组件测量后调用它。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/components/TabBar/overflow.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { computeTabOverflow } from './overflow'

describe('computeTabOverflow', () => {
  it('全部标签放得下时不隐藏任何标签', () => {
    const r = computeTabOverflow(['a', 'b', 'c'], 500, [100, 100, 100])
    expect(r.hiddenTabIds).toEqual([])
  })

  it('MAX_SCROLL 为 2 × 平均标签宽', () => {
    const r = computeTabOverflow(['a', 'b', 'c'], 100, [100, 100, 100])
    // 平均宽 100 → MAX_SCROLL 200
    expect(r.maxScroll).toBe(200)
  })

  it('右边缘超出「视口宽 + MAX_SCROLL」的标签视为隐藏', () => {
    // 容器 300，MAX_SCROLL=200，可到达右缘 500。
    // a 右缘100 b 右缘200 c 右缘300 d 右缘400 e 右缘500 f 右缘600 → f 隐藏
    const r = computeTabOverflow(['a','b','c','d','e','f'], 300, [100,100,100,100,100,100])
    expect(r.hiddenTabIds).toEqual(['f'])
  })

  it('空标签列表返回空结果', () => {
    const r = computeTabOverflow([], 300, [])
    expect(r.hiddenTabIds).toEqual([])
    expect(r.maxScroll).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/components/TabBar/overflow.test.ts`
Expected: FAIL（模块 `./overflow` 不存在）。

- [ ] **Step 3: 实现**

创建 `frontend/src/components/TabBar/overflow.ts`：

```ts
/**
 * 计算溢出标签集合与有界滚轮的最大滚动量。
 *
 * 语义（设计文档 §2）：
 * - 滚轮横滚范围限制为「屏宽 + 2 个标签」，即 MAX_SCROLL = 2 × 平均标签宽。
 * - 隐藏判定：标签右边缘 > 视口宽 + MAX_SCROLL → 收进 `▾` 下拉。
 *
 * 纯函数：给定标签顺序、滚动容器可视宽度、各标签宽度，输出隐藏标签 ID 与最大滚动量。
 * tabWidths[i] 与 tabIds[i] 一一对应。
 */
export function computeTabOverflow(
  tabIds: string[],
  containerWidth: number,
  tabWidths: number[],
): { hiddenTabIds: string[]; maxScroll: number } {
  const total = tabWidths.reduce((sum, w) => sum + w, 0)
  const avg = tabWidths.length > 0 ? total / tabWidths.length : 0
  const maxScroll = 2 * avg

  const hiddenTabIds: string[] = []
  let left = 0
  for (let i = 0; i < tabIds.length; i++) {
    const width = tabWidths[i] ?? 0
    const right = left + width
    if (right > containerWidth + maxScroll) {
      hiddenTabIds.push(tabIds[i])
    }
    left += width
  }
  return { hiddenTabIds, maxScroll }
}
```

- [ ] **Step 4: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/components/TabBar/overflow.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/TabBar/overflow.ts frontend/src/components/TabBar/overflow.test.ts
git commit -m "feat(tabbar): computeTabOverflow 纯函数 — 溢出标签判定 + 有界滚轮 maxScroll"
```

---

### Task 2: `+` 悬停选择栏（停靠打开） + GlobalBar 清理

**Files:**
- Modify: `frontend/src/components/TabBar/index.tsx`
- Modify: `frontend/src/components/TabBar/styles.css`
- Modify: `frontend/src/components/TabBar/index.test.tsx`
- Modify: `frontend/src/components/GlobalBar/index.tsx`
- Modify: `frontend/src/components/GlobalBar/index.test.tsx`

**Interfaces:**
- Consumes: `useTabStore.openTab`（签名 `(options: { type: TabType; title: string; props?; closable? }) => boolean`，已存在）。现有 `useTabStore` 的 tabs/activeTabId/setActiveTab/closeTab。
- Produces: `TabBar()`（无 props）。GlobalBar 渲染 `<TabBar />`。

- [ ] **Step 1: 写失败测试（TabBar `+` 选择栏）**

在 `frontend/src/components/TabBar/index.test.tsx` 新增 `describe('+ 新增标签选择栏')`，并把旧 `describe('新增标签按钮')` 中「点击 + 按钮应调用 onAddTab」用例替换为以下悬停语义用例：

```tsx
  describe('+ 新增标签选择栏', () => {
    // React 的 onMouseEnter/onMouseLeave 由 mouseover/mouseout 合成：在 + 按钮上
    // fireEvent.mouseEnter 不冒泡到 wrapper 的 onMouseEnter，故用 mouseOver（会冒泡）打开、
    // 在 wrapper 上 mouseLeave 关闭。已用探针测试验证。
    const hoverOpen = () => fireEvent.mouseOver(screen.getByLabelText('新增标签'))
    const hoverClose = () => {
      const wrap = screen.getByLabelText('新增标签').parentElement!
      fireEvent.mouseLeave(wrap)
    }

    it('悬停 + 显示选择栏（报单/K线/查询/设置）', () => {
      render(<TabBar />)
      hoverOpen()
      expect(screen.getByText('📝 报单')).toBeInTheDocument()
      expect(screen.getByText('📈 K线')).toBeInTheDocument()
      expect(screen.getByText('📋 查询')).toBeInTheDocument()
      expect(screen.getByText('⚙ 设置')).toBeInTheDocument()
    })

    it('移出 + 与选择栏后选择栏关闭', () => {
      render(<TabBar />)
      hoverOpen()
      expect(screen.getByText('📝 报单')).toBeInTheDocument()
      hoverClose()
      expect(screen.queryByText('📝 报单')).toBeNull()
    })

    it('点击「📝 报单」以停靠标签打开', () => {
      const openTab = vi.fn(() => true)
      useTabStore.setState({ ...defaultState, openTab })
      render(<TabBar />)
      hoverOpen()
      fireEvent.click(screen.getByText('📝 报单'))
      expect(openTab).toHaveBeenCalledWith({ type: 'order', title: '📝 报单' })
    })

    it('点击「⚙ 设置」以停靠标签打开', () => {
      const openTab = vi.fn(() => true)
      useTabStore.setState({ ...defaultState, openTab })
      render(<TabBar />)
      hoverOpen()
      fireEvent.click(screen.getByText('⚙ 设置'))
      expect(openTab).toHaveBeenCalledWith({ type: 'settings', title: '⚙ 设置' })
    })

    it('点击选择栏外部关闭', () => {
      render(<TabBar />)
      hoverOpen()
      expect(screen.getByText('📝 报单')).toBeInTheDocument()
      fireEvent.mouseDown(document.body)
      expect(screen.queryByText('📝 报单')).toBeNull()
    })

    it('Escape 关闭选择栏', () => {
      render(<TabBar />)
      hoverOpen()
      expect(screen.getByText('📝 报单')).toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByText('📝 报单')).toBeNull()
    })
  })
```

注意：`defaultState` 在测试文件顶部已定义；若其不含 `openTab`，在 `useTabStore.setState({ ...defaultState, openTab })` 前需确保 `openTab` 键存在（`setState` 会浅合并，`openTab` 来自默认 store 实现即可，测试传入 mock 覆盖）。

- [ ] **Step 2: 写失败测试（GlobalBar 移除 onAddTab）**

修改 `frontend/src/components/GlobalBar/index.test.tsx`：

1. 删除 `vi.mock('@/utils/openFloatingTab', ...)` 块与 `mockOpenFloatingTab` hoisted 声明（GlobalBar 不再使用 openFloatingTab）。
2. 删除用例「点击 + 新增标签按钮打开设置浮动窗」。
3. TabBar mock 改为无 props 渲染：
   ```tsx
   vi.mock('@/components/TabBar', () => ({
     TabBar: () => <div data-testid="tab-bar">TabBar Mock</div>,
   }))
   ```

Run: `cd frontend && npx vitest run src/components/GlobalBar/index.test.tsx`
Expected: FAIL（旧 mock 引用 `onAddTab`/`mockOpenFloatingTab` 未定义，或用例断言空）。

- [ ] **Step 3: 实现 GlobalBar 清理**

将 `frontend/src/components/GlobalBar/index.tsx` 整体替换为：

```tsx
import { TabBar } from '@/components/TabBar'
import './styles.css'

/**
 * GlobalBar — 全局顶栏（仅承载工作区标签）
 *
 * 原「连接状态 + 全局工具」已迁至底部状态栏 BottomBar；
 * 新增标签入口由 TabBar 的 `+` 悬停选择栏承担（停靠打开 order/kline/query/settings）。
 */
export function GlobalBar() {
  return (
    <header className="global-bar">
      <TabBar />
    </header>
  )
}
```

- [ ] **Step 4: 实现 TabBar `+` 选择栏**

修改 `frontend/src/components/TabBar/index.tsx`。**先删除 `TabBarProps` 接口与 `onAddTab` prop**（`TabBar` 签名从 `({ onAddTab })` 改为 `()`），并在组件顶部加：

```tsx
/** `+` 悬停选择栏可打开的停靠标签类型（底部功能栏子集，固定 4 项） */
const ADD_TAB_ITEMS = [
  { type: 'order' as const, icon: '📝', label: '报单', title: '📝 报单' },
  { type: 'kline' as const, icon: '📈', label: 'K线', title: '📈 K线' },
  { type: 'query' as const, icon: '📋', label: '查询', title: '📋 查询' },
  { type: 'settings' as const, icon: '⚙', label: '设置', title: '⚙ 设置' },
]
```

在组件内部新增状态与打开函数：

```tsx
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuWrapRef = useRef<HTMLDivElement>(null)
  const openTab = useTabStore((s) => s.openTab)

  // 选择栏：点击外部 / Escape 关闭
  useEffect(() => {
    if (!addMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (addMenuWrapRef.current && !addMenuWrapRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [addMenuOpen])

  useEffect(() => {
    if (!addMenuOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setAddMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addMenuOpen])

  const handleAddItem = useCallback((item: (typeof ADD_TAB_ITEMS)[number]) => {
    openTab({ type: item.type, title: item.title })
    setAddMenuOpen(false)
  }, [openTab])
```

把 `+` 按钮的 JSX（`.tab-bar__separator` 之后）整体替换为：

```tsx
      {/* `+` 悬停选择栏：停靠打开底部功能栏标签 */}
      <div
        ref={addMenuWrapRef}
        className="tab-bar__add-wrap"
        onMouseEnter={() => setAddMenuOpen(true)}
        onMouseLeave={() => setAddMenuOpen(false)}
      >
        <button
          type="button"
          className={`tab-bar__add${addMenuOpen ? ' tab-bar__add--active' : ''}`}
          aria-label="新增标签"
          title="新增标签"
          aria-expanded={addMenuOpen}
          onClick={() => setAddMenuOpen((v) => !v)}
        >
          +
        </button>
        {addMenuOpen && (
          <div className="tab-bar__add-menu" role="menu" aria-label="新增标签选择">
            {ADD_TAB_ITEMS.map((item) => (
              <button
                key={item.type}
                type="button"
                role="menuitem"
                className="tab-bar__add-menu-item"
                onClick={() => handleAddItem(item)}
              >
                <span className="tab-bar__add-menu-icon">{item.icon}</span>
                <span className="tab-bar__add-menu-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 5: 新增选择栏样式**

在 `frontend/src/components/TabBar/styles.css` 末尾追加：

```css
/* `+` 新增标签选择栏（悬停弹出，锚定 + 正下方、右对齐向左展开） */
.tab-bar__add-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.tab-bar__add--active {
  color: var(--text-primary);
  border-color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
}

.tab-bar__add-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1000;
  min-width: 160px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
}

.tab-bar__add-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary, #ddd);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.tab-bar__add-menu-item:hover {
  background: var(--bg-hover, #3a3a3a);
}

.tab-bar__add-menu-icon {
  font-size: 14px;
  line-height: 1;
}
```

- [ ] **Step 6: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx src/components/GlobalBar/index.test.tsx`
Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/TabBar/ frontend/src/components/GlobalBar/
git commit -m "feat(tabbar): + 悬停选择栏停靠打开报单/K线/查询/设置；GlobalBar 移除 onAddTab"
```

---

### Task 3: 标签溢出 — 有界滚轮 + `▾` 下拉

**Files:**
- Modify: `frontend/src/components/TabBar/index.tsx`
- Modify: `frontend/src/components/TabBar/styles.css`
- Modify: `frontend/src/components/TabBar/index.test.tsx`

**Interfaces:**
- Consumes: `computeTabOverflow`（Task 1，签名见其 Produces）；Task 2 的 TabBar 结构（`+` 选择栏已存在）；现有 `setActiveTab` / `useFloatingWindowStore.windows`（浮动标签从标签栏隐藏）。
- Produces: `.tab-bar` 拆两段结构（`.tab-bar__scroll` 可滚动区 + `.tab-bar__overflow`）；滚轮 handler；`▾` 按钮与其下拉菜单。

- [ ] **Step 1: 写失败测试（ResizeObserver stub + 溢出计算）**

在 `frontend/src/components/TabBar/index.test.tsx` 顶部（`vi.mock` 之后）新增 ResizeObserver stub（沿用 KLineChart.test 模式，改为手动触发回调以便测试控制测量时机）：

```tsx
// jsdom 无 ResizeObserver；stub 记录回调，测试手动触发以控制测量时机
let roCallback: ResizeObserverCallback | null = null
globalThis.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
  roCallback = cb
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }
}) as unknown as typeof ResizeObserver
```

新增 `describe('标签溢出（▾ 下拉）')`：

```tsx
  describe('标签溢出（▾ 下拉）', () => {
    /** 渲染 N 个等宽标签，mock offsetWidth/clientWidth，触发 ResizeObserver 重算 */
    function renderManyTabs(count: number, containerWidth: number, tabWidth: number) {
      useTabStore.setState({
        tabs: Array.from({ length: count }, (_, i) => ({
          id: i === 0 ? 'tab-market' : `tab-${i}`,
          type: (i === 0 ? 'market' : 'settings') as 'market' | 'settings',
          title: i === 0 ? '📊 行情' : `标签 ${i}`,
          props: {},
          closable: i !== 0,
        })),
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const scrollEl = container.querySelector('.tab-bar__scroll') as HTMLElement
      Object.defineProperty(scrollEl, 'clientWidth', { value: containerWidth, configurable: true })
      scrollEl.querySelectorAll('[role="tab"]').forEach((el, i) => {
        Object.defineProperty(el, 'offsetWidth', { value: tabWidth, configurable: true })
      })
      return { container, scrollEl }
    }

    it('有隐藏标签时显示 ▾ 按钮', () => {
      renderManyTabs(8, 300, 100)
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      expect(screen.getByLabelText('溢出标签')).toBeInTheDocument()
    })

    it('无隐藏标签时不显示 ▾ 按钮', () => {
      renderManyTabs(3, 500, 100)
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      expect(screen.queryByLabelText('溢出标签')).toBeNull()
    })

    it('点击 ▾ 展开隐藏标签列表，点击某项 setActiveTab 并关闭', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: Array.from({ length: 8 }, (_, i) => ({
          id: i === 0 ? 'tab-market' : `tab-${i}`,
          type: (i === 0 ? 'market' : 'settings') as 'market' | 'settings',
          title: i === 0 ? '📊 行情' : `标签 ${i}`,
          props: {},
          closable: i !== 0,
        })),
        activeTabId: 'tab-market',
        setActiveTab,
      })
      const { container } = render(<TabBar />)
      const scrollEl = container.querySelector('.tab-bar__scroll') as HTMLElement
      Object.defineProperty(scrollEl, 'clientWidth', { value: 300, configurable: true })
      scrollEl.querySelectorAll('[role="tab"]').forEach((el) => {
        Object.defineProperty(el, 'offsetWidth', { value: 100, configurable: true })
      })
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      fireEvent.click(screen.getByLabelText('溢出标签'))
      // 隐藏标签仍渲染在滚动区（被裁剪），必须限定在菜单内查询，避免「多元素」冲突
      const menu = screen.getByRole('menu', { name: '隐藏标签' })
      expect(within(menu).getByText('标签 7')).toBeInTheDocument()
      fireEvent.click(within(menu).getByText('标签 7'))
      expect(setActiveTab).toHaveBeenCalledWith('tab-7')
      expect(screen.queryByRole('menu', { name: '隐藏标签' })).toBeNull() // 菜单已关闭
    })

    it('滚轮横滚 clamp 到 MAX_SCROLL（2×平均宽），不越界', () => {
      const { container, scrollEl } = renderManyTabs(6, 300, 100)
      Object.defineProperty(scrollEl, 'scrollLeft', { value: 0, writable: true, configurable: true })
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      // 下滚（deltaY 正）→ 向右；maxScroll=200
      fireEvent.wheel(container.querySelector('.tab-bar__scroll')!, { deltaY: 500 })
      expect(scrollEl.scrollLeft).toBe(200)
      // 上滚（deltaY 负）→ 回左，不为负
      fireEvent.wheel(container.querySelector('.tab-bar__scroll')!, { deltaY: -1000 })
      expect(scrollEl.scrollLeft).toBe(0)
    })
  })
```

注意：`act` 与 `within` 需从 `@testing-library/react` 导入（`import { render, screen, fireEvent, act, within } from '@testing-library/react'`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx`
Expected: FAIL（`.tab-bar__scroll` / `▾` / 滚轮逻辑不存在；`offsetWidth` 测量全 0 → 无隐藏 → `queryByLabelText('溢出标签')` 为 null）。

- [ ] **Step 3: 实现 TabBar 溢出结构**

修改 `frontend/src/components/TabBar/index.tsx`：

1. import 增加：
   ```tsx
   import { computeTabOverflow } from './overflow'
   ```

2. 新增状态、refs 与测量逻辑（放在 `addMenuOpen` 状态附近）：

```tsx
  // ── 溢出（▾ 下拉 + 有界滚轮）──
  const [hiddenTabIds, setHiddenTabIds] = useState<string[]>([])
  const [overflowOpen, setOverflowOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const overflowWrapRef = useRef<HTMLDivElement>(null)

  const hiddenTabs = visibleTabs.filter((t) => hiddenTabIds.includes(t.id))
  const hasHidden = hiddenTabs.length > 0

  // 测量：读取容器宽与各标签宽，computeTabOverflow 计算隐藏集
  const measureOverflow = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const tabEls = Array.from(scrollEl.querySelectorAll<HTMLElement>('[role="tab"]'))
    const ids = visibleTabs.map((t) => t.id)
    const widths = tabEls.map((el) => el.offsetWidth)
    const { hiddenTabIds: hidden } = computeTabOverflow(ids, scrollEl.clientWidth, widths)
    setHiddenTabIds(hidden)
  }, [visibleTabs])

  useEffect(() => {
    measureOverflow()
    const scrollEl = scrollRef.current
    if (!scrollEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureOverflow())
    ro.observe(scrollEl)
    return () => ro.disconnect()
  }, [measureOverflow])

  // ▾ 下拉：点击外部 / Escape 关闭
  useEffect(() => {
    if (!overflowOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (overflowWrapRef.current && !overflowWrapRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [overflowOpen])

  useEffect(() => {
    if (!overflowOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overflowOpen])

  // 有界滚轮监听器在 Step 3b 以原生非 passive 形式挂载（React onWheel 为 passive，无法 preventDefault）
```

3. 修改返回 JSX：把 `.tab-bar` 内现有 `{visibleTabs.map(...)}` 标签列表包进 `.tab-bar__scroll`，并在其后面（`separator` 前）插入 `▾`。**注意：不要在 `.tab-bar__scroll` 上挂 React `onWheel`** —— React 将 wheel 注册为 passive 监听器，`e.preventDefault()` 无效；改用下方 Step 3b 的原生非 passive 监听器。

```tsx
  return (
    <div className="tab-bar" role="tablist" aria-label="标签栏" onKeyDown={handleKeyDown}>
      {/* 可滚动标签区：有界滚轮横滚，隐藏滚动条 */}
      <div className="tab-bar__scroll" ref={scrollRef}>
        {visibleTabs.map((tab) => (
          /* —— 现有标签 JSX 原样保留（key/role/aria/onClick/onPointerDown/onContextMenu/onKeyDown/close） —— */
        ))}
      </div>

      {/* ▾ 溢出按钮：有隐藏标签才显示；点击展开隐藏标签列表 */}
      {hasHidden && (
        <div className="tab-bar__overflow" ref={overflowWrapRef}>
          <button
            type="button"
            className={`tab-bar__overflow-btn${overflowOpen ? ' tab-bar__overflow-btn--active' : ''}`}
            aria-label="溢出标签"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((v) => !v)}
          >
            ▾
          </button>
          {overflowOpen && (
            <div className="tab-bar__overflow-menu" role="menu" aria-label="隐藏标签">
              {hiddenTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  className="tab-bar__overflow-item"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setOverflowOpen(false)
                  }}
                >
                  <span className="tab-bar__overflow-icon">{tab.title.split(' ')[0]}</span>
                  <span className="tab-bar__overflow-title">{tab.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tab-bar__separator" />
      {/* —— 以下 `.tab-bar__add-wrap`（`+` 选择栏）与右键菜单 JSX 原样保留 —— */}
    </div>
  )
```

- [ ] **Step 3b: 原生非 passive 滚轮监听器**

React 的 `onWheel` 是 passive 监听器，`preventDefault()` 无效。改为在 `useEffect` 中用原生 `addEventListener('wheel', ..., { passive: false })` 挂到 `.tab-bar__scroll`。在 Step 3 的其余 `useEffect` 之后新增：

```tsx
  // 原生非 passive wheel 监听：React onWheel 为 passive，preventDefault 无效
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const onWheel = (e: WheelEvent) => {
      // 滚轮横滚仅作用于可滚动区内的标签；visibleTabs 与 DOM 顺序一致
      const tabEls = Array.from(scrollEl.querySelectorAll<HTMLElement>('[role="tab"]'))
      const widths = tabEls.map((el) => el.offsetWidth)
      const ids = visibleTabs.map((t) => t.id)
      const { maxScroll } = computeTabOverflow(ids, scrollEl.clientWidth, widths)
      const target = scrollEl.scrollLeft + e.deltaX + e.deltaY
      scrollEl.scrollLeft = Math.max(0, Math.min(target, maxScroll))
      e.preventDefault()
    }
    scrollEl.addEventListener('wheel', onWheel, { passive: false })
    return () => scrollEl.removeEventListener('wheel', onWheel)
  }, [visibleTabs])
```

- [ ] **Step 4: 样式调整**

在 `frontend/src/components/TabBar/styles.css`：

1. 修改 `.tab-bar` 规则：**横向滚动移至 `.tab-bar__scroll`，`.tab-bar` 自身必须允许溢出**（`+` 选择栏与 `▾` 下拉都是 `position:absolute; top:100%`，若 `.tab-bar` 设 `overflow:hidden` 会被裁剪）：

```css
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  height: 36px;
  overflow: visible;   /* 允许 ▾/`+` 下拉溢出显示；滚动由 .tab-bar__scroll 承接 */
}
```

2. 在 `.tab-bar__tab` 规则之前新增可滚动区与 `▾` 样式：

```css
/* 可滚动标签区：有界滚轮横滚，隐藏滚动条 */
.tab-bar__scroll {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.tab-bar__scroll::-webkit-scrollbar {
  display: none;
}

/* ▾ 溢出按钮 + 下拉 */
.tab-bar__overflow {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-right: 2px;
}

.tab-bar__overflow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.tab-bar__overflow-btn:hover,
.tab-bar__overflow-btn--active {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.tab-bar__overflow-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1000;
  min-width: 160px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
}

.tab-bar__overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary, #ddd);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.tab-bar__overflow-item:hover {
  background: var(--bg-hover, #3a3a3a);
}

.tab-bar__overflow-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.tab-bar__overflow-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx`
Expected: 全部通过（含 Task 1 引入的 overflow 依赖、Task 2 的 `+` 用例、本任务溢出用例）。

- [ ] **Step 6: tsc + 全量测试 + build**

```bash
cd frontend && npx tsc --noEmit
npx vitest run
npm run build
```
Expected: 全绿、类型无错误、构建成功。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/TabBar/
git commit -m "feat(tabbar): 标签溢出改有界滚轮横滚 + ▾ 下拉；computeTabOverflow 驱动"
```

---

## Self-Review

**Spec coverage:**
- §1 `+` 选择栏 → Task 2（TabBar 悬停弹层 + GlobalBar 清理）；停靠打开 → `openTab`（非浮动）；4 项映射、Escape/外部关闭、键盘 aria 均覆盖
- §2 溢出 → Task 3：`.tab-bar` 拆两段、有界滚轮（MAX_SCROLL=2×平均宽）、`computeTabOverflow` 纯函数、`▾` 交互、重算时机（tabs + ResizeObserver）
- §3 测试 → Task 1（纯函数）、Task 2（`+` 用例 + GlobalBar）、Task 3（溢出用例 + RO stub + 滚轮 clamp）
- 不做项（持久化/拖拽排序/MAX_TABS/新类型/键盘 ▾ 选择/滚轮平台配置）均未实现

**Placeholder scan:** 无 TBD/TODO；Task 3 Step 3 的标签 JSX 标注「原样保留」——这是从现有文件复制，非占位（Task 3 的 brief 将给出完整文件定位说明）。无「类似 Task N」省略。

**Type consistency:**
- `computeTabOverflow(tabIds, containerWidth, tabWidths) → { hiddenTabIds, maxScroll }`：Task 1 定义，Task 3 两处调用（measureOverflow / 原生 wheel 监听器）签名一致。
- `TabBar()` 无 props：Task 2 删除 `TabBarProps`/`onAddTab`，GlobalBar 改为 `<TabBar />`，测试一致。
- `openTab({ type, title })`：Task 2 用 `item.type`（order/kline/query/settings，`as const` 保证字面量类型）与 `openTab` 期望的 `TabType` 兼容。
- testid 无跨任务依赖；`roCallback` 为 Task 3 测试文件内局部变量。
