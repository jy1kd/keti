# TabBar 右键菜单 + 行情标签固定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 TabBar 标签右键菜单从「在新窗口打开」改为 5 项（关闭/关闭其他/关闭所有/固定/窗口化）；行情标签页（初始页）固定在左侧、不随滚轮移动、无右键、无图标、不可关闭。

**Architecture:** tabs store 增加 `pinned?: boolean` 字段与 `closeOthers`/`closeAll`/`togglePin` action；TabBar 将 `type==='market'` 标签从可滚动区剥离为独立的 `.tab-bar__market`（滚动区只含 `scrollTabs`，`pinned` 靠左排序）；右键菜单替换为 5 项，窗口化复用现有 `detachTabAt`。分支合并由用户手动执行，全程只做常规提交。

**Tech Stack:** React 18 + TypeScript + Vite；Zustand；vitest + @testing-library/react。

## Global Constraints

- 分支 `feature/TobBar-right`。
- 前端 `frontend/src`，无后端改动。
- **用户手动合并分支：绝不执行 `git merge` / `git rebase` / `git push` / 删除分支**，只做 `git add` + `git commit`。
- `pinned?: boolean` 可选字段（缺省 = 未固定），避免 70 处测试夹具大面积改动；`closable:false` 标签不可固定（togglePin 拒绝）。
- 行情标签（`type==='market'`）：固定左侧、不随滚轮、无右键菜单、无 ×/📌 图标、不可固定/不可关闭。
- 固定标签：置左（滚动区排序）+ 关闭其他/关闭所有跳过；但可通过右键「关闭」单独关闭；可窗口化。
- `closeTab` 行为不变（`closable:false` 拒绝；`pinned` 标签 `closable:true` 故可关闭）。
- 全量前端测试 + `npm run build` 必须通过。
- 不做浏览器式固定收缩图标、不做固定标签拖拽排序、不改 `MAX_TABS`、不改 `+` 菜单/▾/有界滚轮（数据源改 `scrollTabs` 即可）。

---

### Task 1: tabs store — pinned 字段 + closeOthers/closeAll/togglePin

**Files:**
- Modify: `frontend/src/stores/tabs.ts`
- Test: `frontend/src/stores/tabs.test.ts`

**Interfaces:**
- Consumes: 现有 `Tab` 接口、`TabStore`、`PINNED_TAB_TYPE='market'`、`DEFAULT_TAB`。
- Produces: `Tab.pinned?: boolean`；`closeOthers(tabId: string): void`；`closeAll(): void`；`togglePin(tabId: string): void`。Task 2/3 的 TabBar 消费这些 action。

- [ ] **Step 1: 写失败测试（closeOthers/closeAll/togglePin）**

在 `frontend/src/stores/tabs.test.ts` 末尾新增 `describe('closeOthers / closeAll / togglePin')`：

```ts
describe('closeOthers / closeAll / togglePin', () => {
  function seed() {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-order', type: 'order', title: '📝 报单', props: {}, closable: true, pinned: true },
        { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
        { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
      ],
      activeTabId: 'tab-kline',
    })
  }

  it('closeOthers 关闭除指定标签外的所有可关闭非固定标签，activeTabId 保持', () => {
    seed()
    useTabStore.getState().closeOthers('tab-kline')
    const { tabs, activeTabId } = useTabStore.getState()
    // 保留 market（closable:false）+ order（pinned）+ kline（目标）
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order', 'tab-kline'])
    expect(activeTabId).toBe('tab-kline')
  })

  it('closeOthers 对固定目标标签同样跳过其他固定标签', () => {
    seed()
    useTabStore.getState().closeOthers('tab-order') // 目标是固定标签
    const { tabs } = useTabStore.getState()
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order'])
  })

  it('closeAll 关闭所有可关闭非固定标签，activeTabId 指向剩余第一个', () => {
    seed()
    useTabStore.getState().closeAll()
    const { tabs, activeTabId } = useTabStore.getState()
    // 保留 market（closable:false）+ order（pinned）
    expect(tabs.map((t) => t.id)).toEqual(['tab-market', 'tab-order'])
    expect(activeTabId).toBe('tab-market')
  })

  it('closeAll 后活跃标签被关闭时，activeTabId 落到剩余第一个', () => {
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
      ],
      activeTabId: 'tab-kline',
    })
    useTabStore.getState().closeAll()
    expect(useTabStore.getState().activeTabId).toBe('tab-market')
  })

  it('togglePin 切换 pinned；closable:false 标签拒绝固定', () => {
    seed()
    useTabStore.getState().togglePin('tab-kline')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-kline')!.pinned).toBe(true)
    useTabStore.getState().togglePin('tab-kline')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-kline')!.pinned).toBe(false)
    // market 不可固定
    useTabStore.getState().togglePin('tab-market')
    expect(useTabStore.getState().tabs.find((t) => t.id === 'tab-market')!.pinned).toBeUndefined()
  })

  it('openTab 新标签默认 pinned:false', () => {
    useTabStore.setState({ tabs: [], activeTabId: '' })
    useTabStore.getState().openTab({ type: 'kline', title: '📈 K线' })
    expect(useTabStore.getState().tabs[0].pinned).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts`
Expected: FAIL（`closeOthers` / `closeAll` / `togglePin` 未定义；`Tab` 无 `pinned`）。

- [ ] **Step 3: 实现 store**

修改 `frontend/src/stores/tabs.ts`：

1. `Tab` 接口增加 `pinned?: boolean`（在 `closable` 之后）：

```ts
export interface Tab {
  id: string
  type: TabType
  title: string
  props: Record<string, unknown>
  closable: boolean
  /** 固定标签：滚动区置左 + 关闭其他/关闭所有跳过。缺省 = 未固定 */
  pinned?: boolean
}
```

2. `TabStore` 接口新增三个 action 声明：

```ts
  /** 关闭除指定标签外的所有可关闭非固定标签；activeTabId 保持 */
  closeOthers: (tabId: string) => void
  /** 关闭所有可关闭非固定标签；activeTabId 指向剩余第一个 */
  closeAll: () => void
  /** 切换固定状态；closable:false 标签（行情/初始页）拒绝 */
  togglePin: (tabId: string) => void
```

3. `openTab` 的 `newTab` 增加 `pinned: false`：

```ts
      const newTab: Tab = {
        id: tabId,
        type,
        title,
        props,
        closable,
        pinned: false,
      }
```

4. store 实现末尾（`closeTab` 之后）新增三个 action：

```ts
  closeOthers: (tabId) => {
    set((state) => {
      const target = state.tabs.find((t) => t.id === tabId)
      if (!target) return state
      // 保留：目标 + 不可关闭（closable:false）+ 固定标签
      const keep = state.tabs.filter((t) => !t.closable || t.pinned || t.id === tabId)
      if (keep.length === state.tabs.length) return state
      return { tabs: keep, activeTabId: tabId }
    })
  },

  closeAll: () => {
    set((state) => {
      const keep = state.tabs.filter((t) => !t.closable || t.pinned)
      if (keep.length === state.tabs.length) return state
      const activeSurvives = keep.some((t) => t.id === state.activeTabId)
      const newActiveId = activeSurvives ? state.activeTabId : (keep[0]?.id ?? state.activeTabId)
      return { tabs: keep, activeTabId: newActiveId }
    })
  },

  togglePin: (tabId) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab || !tab.closable) return state
      return {
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
      }
    })
  },
```

- [ ] **Step 4: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts`
Expected: PASS。

- [ ] **Step 5: tsc 检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/stores/tabs.test.ts
git commit -m "feat(tabs): Tab 增加 pinned 字段 + closeOthers/closeAll/togglePin"
```

---

### Task 2: TabBar 布局 — 行情标签固定左侧（scrollTabs）+ GlobalBar 去 padding

**Files:**
- Modify: `frontend/src/components/TabBar/index.tsx`
- Modify: `frontend/src/components/TabBar/styles.css`
- Modify: `frontend/src/components/TabBar/index.test.tsx`
- Modify: `frontend/src/components/GlobalBar/styles.css`

**Interfaces:**
- Consumes: Task 1 的 `Tab.pinned`；现有 `useTabStore.tabs/activeTabId/setActiveTab/closeTab`、`useFloatingWindowStore.windows`、`computeTabOverflow`、`startDetachDrag/detachTabAt`。
- Produces: `scrollTabs`（可滚动区标签，pinned 靠左，market 排除）；`.tab-bar__market` 独立元素。Task 3 在既有结构上加右键菜单。

- [ ] **Step 1: 写失败测试（行情标签固定 + scrollTabs 排序）**

在 `frontend/src/components/TabBar/index.test.tsx` 新增：

```tsx
  describe('行情标签固定左侧', () => {
    it('行情标签渲染在可滚动区之外（.tab-bar__market 存在且不在 .tab-bar__scroll 内）', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const marketEl = container.querySelector('.tab-bar__market')
      expect(marketEl).toBeInTheDocument()
      expect(marketEl?.textContent).toContain('📊 行情')
      // 不在可滚动区内
      expect(container.querySelector('.tab-bar__scroll')?.querySelector('.tab-bar__market')).toBeNull()
      expect(container.querySelector('.tab-bar__scroll')?.querySelectorAll('[role="tab"]')).toHaveLength(1) // 只有 K线
    })

    it('行情标签不显示关闭按钮与置顶图标', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
        ],
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const marketEl = container.querySelector('.tab-bar__market')!
      expect(marketEl.querySelector('[aria-label="关闭标签"]')).toBeNull()
      expect(marketEl.querySelector('.tab-bar__pin')).toBeNull()
    })
  })

  describe('固定标签排序', () => {
    it('pinned 标签在可滚动区内排在最左', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-a', type: 'kline', title: '📈 A', props: {}, closable: true },
          { id: 'tab-b', type: 'kline', title: '📈 B', props: {}, closable: true, pinned: true },
        ],
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const scrollTabs = Array.from(container.querySelectorAll('.tab-bar__scroll [role="tab"]'))
      const order = scrollTabs.map((el) => el.getAttribute('data-tab-id'))
      expect(order).toEqual(['tab-b', 'tab-a']) // pinned 在前
    })
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx -t "行情标签固定左侧|固定标签排序"`
Expected: FAIL（无 `.tab-bar__market`；scroll 区含 market）。

- [ ] **Step 3: 实现 TabBar 布局拆分**

修改 `frontend/src/components/TabBar/index.tsx`：

1. 在 `visibleTabs` 之后新增 `marketTab` 与 `scrollTabs`：

```tsx
  // 排除已拖入浮动窗口的标签（浮动标签从标签栏隐藏）
  const visibleTabs = useMemo(() => tabs.filter((t) => !windows[t.id]), [tabs, windows])

  // 行情标签（初始页）：固定在左侧、可滚动区之外；不参与滚轮/溢出/隐藏
  const marketTab = visibleTabs.find((t) => t.type === 'market')

  // 可滚动区标签：排除行情标签；pinned 靠左排序
  const scrollTabs = useMemo(() => {
    const rest = visibleTabs.filter((t) => t.type !== 'market')
    return [...rest.filter((t) => t.pinned), ...rest.filter((t) => !t.pinned)]
  }, [visibleTabs])
```

2. 将所有使用 `visibleTabs` 的测量/滚轮/溢出/键盘逻辑改为 `scrollTabs`：
   - `hiddenTabs = scrollTabs.filter((t) => hiddenTabIds.includes(t.id))`
   - `measureOverflow` 里 `ids = scrollTabs.map((t) => t.id)`
   - wheel handler 里 `ids = scrollTabs.map((t) => t.id)`
   - `handleOverflowItemClick` 里 `ids = scrollTabs.map((t) => t.id)`
   - `handleKeyDown` 里 `currentIndex = scrollTabs.findIndex(...)`，`visibleTabs[nextIndex].id` → `scrollTabs[nextIndex].id`，`nextIndex = (currentIndex + 1) % scrollTabs.length` 等

3. 修改返回 JSX：`.tab-bar` 内、`.tab-bar__scroll` **之前**插入行情标签；`.tab-bar__scroll` 内的 `{visibleTabs.map(...)}` 改为 `{scrollTabs.map(...)}`：

```tsx
  return (
    <div className="tab-bar" role="tablist" aria-label="标签栏" onKeyDown={handleKeyDown}>
      {/* 行情标签（初始页）：固定左侧、不随滚轮、无右键、无图标 */}
      {marketTab && (
        <div
          key={marketTab.id}
          role="tab"
          data-tab-id={marketTab.id}
          tabIndex={0}
          aria-selected={marketTab.id === activeTabId}
          className={`tab-bar__market tab-bar__tab${marketTab.id === activeTabId ? ' tab-bar__tab--active' : ''}`}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            setActiveTab(marketTab.id)
          }}
          onContextMenu={(e) => e.preventDefault()} // 行情标签无右键菜单
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveTab(marketTab.id)
            }
          }}
        >
          <span className="tab-bar__title">{marketTab.title}</span>
        </div>
      )}

      {/* 可滚动标签区：有界滚轮横滚，隐藏滚动条 */}
      <div className="tab-bar__scroll" ref={scrollRef}>
      {scrollTabs.map((tab) => (
        /* —— 现有标签 JSX 原样保留（key/role/aria/onClick/onPointerDown/onContextMenu/onKeyDown/close/--hidden/--grow 逻辑），
           仅把 visibleTabs 改为 scrollTabs —— */
      ))}
      </div>

      {/* —— 以下 ▾ / separator / `+` / 右键菜单 JSX 原样保留 —— */}
    </div>
  )
```

注意：`hiddenTabIds` 现在只含 `scrollTabs` 的 id（行情标签 id 永不在其中，其 `--hidden`/`--grow` 类不适用）。`tab-bar__tab--grow` 逻辑保持 `!hiddenTabIds.includes(tab.id) && hasHidden`（针对 scrollTabs）。

- [ ] **Step 4: 样式调整**

`frontend/src/components/TabBar/styles.css` 新增：

```css
/* 行情标签（初始页）：固定在左侧、可滚动区之外；少量左呼吸替代原 GlobalBar 16px 外层 */
.tab-bar__market {
  flex-shrink: 0;
  padding-left: 8px;
  cursor: default;
}
```

`frontend/src/components/GlobalBar/styles.css`：`.global-bar` 的 `padding-left: 16px` → `0`。

- [ ] **Step 5: 更新既有溢出测试**

`frontend/src/components/TabBar/index.test.tsx` 的 `renderManyTabs` 助手改为：第一个标签为 market（进 `.tab-bar__market`），后续 `count` 个 settings 标签进滚动区：

```tsx
    function renderManyTabs(count: number, containerWidth: number, tabWidth: number) {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          ...Array.from({ length: count }, (_, i) => ({
            id: `tab-${i + 1}`,
            type: 'settings' as const,
            title: `标签 ${i + 1}`,
            props: {},
            closable: true,
          })),
        ],
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const scrollEl = container.querySelector('.tab-bar__scroll') as HTMLElement
      Object.defineProperty(scrollEl, 'clientWidth', { value: containerWidth, configurable: true })
      scrollEl.querySelectorAll('[role="tab"]').forEach((el) => {
        Object.defineProperty(el, 'offsetWidth', { value: tabWidth, configurable: true })
      })
      return { container, scrollEl }
    }
```

溢出用例（「有隐藏标签时显示 ▾」「点击 ▾ 展开隐藏标签列表」「滚轮 clamp」等）的滚动区标签索引不变（`tab-1..tab-count` 对应 DOM 顺序），断言继续成立。检查「点击 ▾ 展开隐藏标签列表」用例：其内部手动构造 8 个标签，改为 `market + 8 个 settings`（`tab-1..tab-8`），隐藏的为 `tab-6/7/8`（右缘 600/700/800 > 500），点击 `within(menu).getByText('标签 7')` → `setActiveTab('tab-7')` 仍成立。

- [ ] **Step 6: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx src/components/GlobalBar/index.test.tsx`
Expected: 全部通过。

- [ ] **Step 7: tsc 检查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 8: 提交**

```bash
git add frontend/src/components/TabBar/ frontend/src/components/GlobalBar/styles.css
git commit -m "feat(tabbar): 行情标签固定左侧（可滚动区外、不随滚轮）；scrollTabs 排序（pinned 靠左）；GlobalBar 去左 padding"
```

---

### Task 3: 右键菜单 5 项（关闭/关闭其他/关闭所有/固定/窗口化）

**Files:**
- Modify: `frontend/src/components/TabBar/index.tsx`
- Modify: `frontend/src/components/TabBar/styles.css`
- Modify: `frontend/src/components/TabBar/index.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `closeOthers`/`closeAll`/`togglePin`；Task 2 的 `scrollTabs`/`.tab-bar__market`；现有 `closeTab`、`detachTabAt`、`defaultFloatingSize`。
- Produces: 右键菜单 5 项；`handleOpenInNewWindow` 与 `isElectron` import 删除。

- [ ] **Step 1: 写失败测试（右键菜单 5 项）**

在 `frontend/src/components/TabBar/index.test.tsx` 新增 `describe('右键菜单')`：

```tsx
  describe('右键菜单', () => {
    const ctxTabs = [
      { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      { id: 'tab-kline', type: 'kline', title: '📈 K线', props: {}, closable: true },
      { id: 'tab-order', type: 'order', title: '📝 报单', props: {}, closable: true, pinned: true },
    ]

    function renderWithCtx(tabId: string) {
      useTabStore.setState({ tabs: ctxTabs, activeTabId: tabId })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText(ctxTabs.find((t) => t.id === tabId)!.title))
    }

    it('右键非固定标签显示 5 项菜单', () => {
      renderWithCtx('tab-kline')
      expect(screen.getByText('关闭')).toBeInTheDocument()
      expect(screen.getByText('关闭其他')).toBeInTheDocument()
      expect(screen.getByText('关闭所有')).toBeInTheDocument()
      expect(screen.getByText('📌 固定')).toBeInTheDocument()
      expect(screen.getByText('窗口化')).toBeInTheDocument()
    })

    it('右键固定标签显示「取消固定」', () => {
      renderWithCtx('tab-order')
      fireEvent.contextMenu(screen.getByText('📝 报单'))
      expect(screen.getByText('取消固定')).toBeInTheDocument()
    })

    it('点击「关闭」关闭该标签', () => {
      const closeTab = vi.fn()
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-kline', closeTab })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📈 K线'))
      fireEvent.click(screen.getByText('关闭'))
      expect(closeTab).toHaveBeenCalledWith('tab-kline')
    })

    it('点击「关闭其他」调用 closeOthers(tabId)', () => {
      const closeOthers = vi.fn()
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-kline', closeOthers })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📈 K线'))
      fireEvent.click(screen.getByText('关闭其他'))
      expect(closeOthers).toHaveBeenCalledWith('tab-kline')
    })

    it('点击「关闭所有」调用 closeAll', () => {
      const closeAll = vi.fn()
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-kline', closeAll })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📈 K线'))
      fireEvent.click(screen.getByText('关闭所有'))
      expect(closeAll).toHaveBeenCalled()
    })

    it('点击「固定」调用 togglePin(tabId)', () => {
      const togglePin = vi.fn()
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-kline', togglePin })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📈 K线'))
      fireEvent.click(screen.getByText('📌 固定'))
      expect(togglePin).toHaveBeenCalledWith('tab-kline')
    })

    it('点击「窗口化」调用 detachTabAt(tabId, {x,y})', () => {
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-kline' })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📈 K线'), { clientX: 120, clientY: 80 })
      fireEvent.click(screen.getByText('窗口化'))
      expect(detachMock.detachTabAt).toHaveBeenCalledWith('tab-kline', { x: 120, y: 80 })
    })

    it('行情标签右键不出现菜单', () => {
      useTabStore.setState({ tabs: ctxTabs, activeTabId: 'tab-market' })
      render(<TabBar />)
      fireEvent.contextMenu(screen.getByText('📊 行情'))
      expect(screen.queryByText('关闭')).toBeNull()
      expect(screen.queryByText('窗口化')).toBeNull()
    })
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx -t "右键菜单"`
Expected: FAIL（旧菜单只有「在新窗口打开」，无 5 项；行情标签仍弹菜单）。

- [ ] **Step 3: 实现右键菜单 5 项**

修改 `frontend/src/components/TabBar/index.tsx`：

1. `ContextMenuState` 增加 `pinned: boolean`：

```ts
interface ContextMenuState {
  tabId: string
  tabType: string
  tabTitle: string
  pinned: boolean
  x: number
  y: number
}
```

2. `handleContextMenu` 读取 pinned 存入 state：

```ts
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tab: { id: string; type: string; title: string }) => {
      e.preventDefault()
      const pinned = !!useTabStore.getState().tabs.find((t) => t.id === tab.id)?.pinned
      setContextMenu({ tabId: tab.id, tabType: tab.type, tabTitle: tab.title, pinned, x: e.clientX, y: e.clientY })
    },
    [],
  )
```

3. 删除 `handleOpenInNewWindow` 与 `isElectron` import（`import { isElectron } from '@/services/electron'` 移除；若 `isElectron` 无其他使用则彻底移除）。

4. 从 store 取三个新 action：

```ts
  const closeOthers = useTabStore((s) => s.closeOthers)
  const closeAll = useTabStore((s) => s.closeAll)
  const togglePin = useTabStore((s) => s.togglePin)
```

5. 替换右键菜单 JSX 为 5 项：

```tsx
      {/* 右键菜单 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-bar__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeTab(contextMenu.tabId); setContextMenu(null) }}
          >
            <span className="tab-bar__context-icon">✕</span>
            <span>关闭</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeOthers(contextMenu.tabId); setContextMenu(null) }}
          >
            <span className="tab-bar__context-icon">⊞</span>
            <span>关闭其他</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { closeAll(); setContextMenu(null) }}
          >
            <span className="tab-bar__context-icon">⧉</span>
            <span>关闭所有</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { togglePin(contextMenu.tabId); setContextMenu(null) }}
          >
            <span className="tab-bar__context-icon">{contextMenu.pinned ? '📌' : '📌'}</span>
            <span>{contextMenu.pinned ? '取消固定' : '固定'}</span>
          </button>
          <button
            type="button"
            className="tab-bar__context-item"
            onClick={() => { detachTabAt(contextMenu.tabId, { x: contextMenu.x, y: contextMenu.y }); setContextMenu(null) }}
          >
            <span className="tab-bar__context-icon">🗗</span>
            <span>窗口化</span>
          </button>
        </div>
      )}
```

- [ ] **Step 4: 样式补充**

`frontend/src/components/TabBar/styles.css` 新增：

```css
.tab-bar__context-icon {
  font-size: 13px;
  width: 18px;
  flex-shrink: 0;
  text-align: center;
}
```

（`.tab-bar__context-item` 已有 `gap: 8px`，icon 对齐即可。）

- [ ] **Step 5: 跑测试确认绿**

Run: `cd frontend && npx vitest run src/components/TabBar/index.test.tsx src/components/GlobalBar/index.test.tsx`
Expected: 全部通过。

- [ ] **Step 6: tsc + 全量测试 + build**

```bash
cd frontend && npx tsc --noEmit
npx vitest run
npm run build
```
Expected: 全绿、无类型错误、构建成功。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/TabBar/
git commit -m "feat(tabbar): 右键菜单改 5 项（关闭/关闭其他/关闭所有/固定/窗口化），删除在新窗口打开"
```

---

## Self-Review

**Spec coverage:**
- §1 store（pinned + closeOthers/closeAll/togglePin）→ Task 1
- §2 布局（行情标签固定左侧 + scrollTabs 排序 + GlobalBar 去 padding）→ Task 2
- §3 右键菜单 5 项（关闭/关闭其他/关闭所有/固定/窗口化）→ Task 3
- §4 测试 → 各 Task 对应；全量测试 + build 在 Task 3 Step 6
- 不做项（浏览器式收缩图标、固定标签拖拽排序、行情不可取消固定、MAX_TABS、+ 菜单/▾/滚轮保留）均未实现

**Placeholder scan:** 无 TBD/TODO。Task 2 Step 3 的 scrollTabs 标签 JSX 标注「原样保留」——从现有文件复制，非占位。右键菜单 5 项完整代码给出。

**Type consistency:**
- `Tab.pinned?: boolean`：Task 1 定义，Task 2 排序与 Task 3 菜单文本一致。
- `closeOthers(tabId)` / `closeAll()` / `togglePin(tabId)`：Task 1 store 定义，Task 3 TabBar 消费，签名一致。
- `ContextMenuState.pinned: boolean`：Task 3 定义与使用一致。
- `scrollTabs`：Task 2 定义，测量/滚轮/溢出/键盘/渲染全部改用，Task 3 不新增 `visibleTabs` 依赖。
- testid/class 契约：`.tab-bar__market`、`.tab-bar__pin`、`.tab-bar__context-icon` 三处一致。
