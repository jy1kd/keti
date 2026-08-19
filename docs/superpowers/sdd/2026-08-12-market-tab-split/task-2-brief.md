### Task 2: 标签栏双固定标签（期货 + 期权）

**Files:**
- Modify: `frontend/src/stores/tabs.ts:47-53`（`DEFAULT_TAB` → 双固定标签）
- Modify: `frontend/src/components/TabBar/index.tsx:87-94`（固定区判断泛化）
- Test: `frontend/src/stores/tabs.test.ts`、`frontend/src/components/TabBar/index.test.tsx`

**Interfaces:**
- Consumes: `Tab` 类型。
- Produces: 初始 `tabs` 含两个 `closable:false` 标签（`tab-market` 标题 `📊 期货`、`tab-options` 标题 `📈 期权`）；`TabBar` 用 `!t.closable` 判断固定标签。Task 6 的 `TabContent` 依据 `tab-options` 渲染期权面板。

- [ ] **Step 1: 写失败测试**

在 `frontend/src/stores/tabs.test.ts` 追加：

```ts
import { useTabStore } from './tabs'

describe('双固定标签初始化', () => {
  beforeEach(() => useTabStore.setState({ tabs: [{ id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false }, { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false }], activeTabId: 'tab-market' }))

  it('初始含期货+期权两个不可关闭标签', () => {
    const { tabs } = useTabStore.getState()
    expect(tabs.map((t) => t.title)).toEqual(['📊 期货', '📈 期权'])
    expect(tabs.every((t) => !t.closable)).toBe(true)
  })

  it('closeTab 拒绝关闭固定标签', () => {
    useTabStore.getState().closeTab('tab-market')
    expect(useTabStore.getState().tabs.length).toBe(2)
  })
})
```

在 `frontend/src/components/TabBar/index.test.tsx` 追加（若已存在渲染断言，则更新）：渲染后断言固定区同时出现「📊 期货」「📈 期权」，且 `data-tab-id="tab-options"` 位于固定区（`tab-bar__market` 或等价 class）而非滚动区。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx`
Expected: FAIL（仍只有单标签，或期权标签进入滚动区）

- [ ] **Step 3: 改 tabs 存储**

把 `frontend/src/stores/tabs.ts:47-53` 的 `DEFAULT_TAB` 替换为：

```ts
const DEFAULT_TABS: Tab[] = [
  { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
  { id: 'tab-options', type: 'options', title: '📈 期权', props: {}, closable: false },
]
```

并把 store 初始 `tabs: [DEFAULT_TAB]`、`activeTabId: DEFAULT_TAB.id` 改为 `tabs: DEFAULT_TABS`、`activeTabId: DEFAULT_TABS[0].id`；`closeTab` 内的 `DEFAULT_TAB.id` 兜底改 `DEFAULT_TABS[0].id`。

- [ ] **Step 4: 改 TabBar 固定区**

在 `frontend/src/components/TabBar/index.tsx`，把「行情标签固定左」的单一 `marketTab` 改为遍历所有不可关闭标签：

```ts
// 固定标签（期货/期权等 closable:false）：固定在左侧、可滚动区之外；不参与滚轮/溢出/隐藏
const fixedTabs = visibleTabs.filter((t) => !t.closable)

// 可滚动区标签：排除固定标签；pinned 靠左排序
const scrollTabs = useMemo(() => {
  const rest = visibleTabs.filter((t) => t.closable)
  return [...rest.filter((t) => t.pinned), ...rest.filter((t) => !t.pinned)]
}, [visibleTabs])
```

并将 JSX 中 `{marketTab && (…)}` 那段改为 `{fixedTabs.map((tab) => (…))}`，逐项渲染（`data-tab-id={tab.id}`、标题 `{tab.title}`、点击 `setActiveTab(tab.id)`、无右键、`onContextMenu` preventDefault）。`TabContent/index.tsx` 里的 `tabs.find((t) => t.type === 'market')` 兜底逻辑保持不变。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/stores/tabs.test.ts src/components/TabBar/index.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/stores/tabs.ts frontend/src/stores/tabs.test.ts frontend/src/components/TabBar/index.tsx frontend/src/components/TabBar/index.test.tsx
git commit -m "feat(tabs): 标签栏双固定标签（期货+期权），固定区判断泛化为 closable=false"
```

---

