# 行情表填充/合约列冻结/选中态与订阅一致性 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除行情模块 5 个 UI/数据一致性问题：页面自动填充、合约列冻结、右键选中、双高亮统一、自选订阅一致性。

**Architecture:** ① 布局高度链规范化 + vtable `widthMode:'adaptive'` + `frozenColCount` 填满/冻结；② 选中态统一为「蓝色选区 `selectedContracts` + 金色活动锚点 `selectedInstrument`（金在蓝内）」，`selectRow` 加守卫；③ 订阅生命周期统一由 `useSubscriptionManager` 负责（收藏不再直连 API），后端「先验证后记录」消除假成功，WS 重连触发强制重订阅兜底。

**Tech Stack:** React 18 + TypeScript 5 + Vite 5 + @visactor/vtable ^1.26.4 + Zustand；后端 Python FastAPI + ctp-python。

## Global Constraints

- 分支 `fix/market-table`；**绝不触碰**工作区未提交的 `frontend/dist-electron/**`、`实习周报*.docx`、`generate_weekly_report.py`。
- 每个 Task 严格 TDD：写失败测试 → 跑出红 → 最小实现 → 跑绿 → 提交。
- 前端测试命令：`cd frontend && npx vitest run <相对路径>`；后端：`cd server && python -m pytest tests/test_market_service.py -v`。
- vtable API：`ListTable` 实例有 `clearSelected()`（`node_modules/@visactor/vtable/cjs/core/BaseTable.d.ts:298`）与 `selectRow(row)`；`widthMode` 合法值 `'standard' | 'adaptive' | 'autoWidth'`，`'adaptive'` 自适应容器宽度填满。
- 强制重订阅触发：经 `/ws/system` 的 `connection_status {mdConnected:true}` 广播（后端初始登录 `ctp_startup.py:211` 与重连成功 `:364` 都会发），由 `useSystemWs` 消费 → `markForceResubscribe()`。**不改 `services/ws.ts` / `useMarketWs.ts`**——CTP 重连对浏览器 WS 透明，治愈时机选「后端 CTP 确认连上」而非「前端 WS 打开」。
- 现有测试基准：前端 469 个单测、后端 108 个单测，全量需保持绿。
- 设计依据：`docs/superpowers/specs/2026-08-10-market-table-fixes-design.md`。

---

## 文件结构总览

| 文件 | 责任 |
|------|------|
| `frontend/src/modules/market/MarketTable.tsx` | 冻结列、widthMode、右键选中、selectRow 守卫、拖选锚点同步 |
| `frontend/src/modules/market/styles.css` | `.panel-content` 高度链修复 |
| `frontend/src/modules/options/OptionPanel.tsx` | 删除 `chainHeight()` 固定高度 |
| `frontend/src/modules/options/styles.css` | `.options-panel`/`.options-chain-table` 弹性填充 |
| `frontend/src/hooks/useContractContextMenu.ts` | 右键同步 `selectedInstrument` |
| `frontend/src/stores/contracts.ts` | 收藏只维护状态，不再直连订阅 API |
| `frontend/src/modules/market/store.ts` | 新增 `forceResubscribeSeq` + `markForceResubscribe` |
| `frontend/src/hooks/useSubscriptionManager.ts` | 消费强制重订阅信号 |
| `frontend/src/hooks/useSystemWs.ts` | 消费 `connection_status {mdConnected:true}` → `markForceResubscribe` |
| `server/services/market_service.py` | `subscribe()` 先验证后记录（回滚假成功） |
| `server/services/ctp_startup.py` | `_subscribe_with_tracking` 透传 CTP 返回值 + `_wire_bridge` 同步权威订阅列表 |

---

### Task 1: 合约列冻结（问题 2）

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:194`（ListTable 配置）
- Test: `frontend/src/modules/market/MarketTable.test.tsx`

**Interfaces:**
- Produces: ListTable 配置含 `frozenColCount: 1`（「合约」列冻结在最左侧）

- [x] **Step 1: 写失败测试**

在 `MarketTable.test.tsx` 的 `it('creates ListTable with correct options', ...)`（约 32 行）后追加：

```ts
it('冻结合约列为最左列（frozenColCount=1）', async () => {
  render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
  const { ListTable } = await import('@visactor/vtable')
  const options = (ListTable as any).mock.calls[0][1]
  expect(options.frozenColCount).toBe(1)
})
```

- [x] **Step 2: 跑测试验证红**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`
Expected: FAIL — `options.frozenColCount` 为 `undefined`，`expect(...).toBe(1)` 不通过。

- [x] **Step 3: 最小实现**

`MarketTable.tsx` ListTable 配置（`MarketTable.tsx:194-197`）：

```ts
const table = new ListTable(containerRef.current, {
  columns,
  records,
  frozenColCount: 1, // 冻结「合约」列：横向拖动时固定最左侧
  widthMode: 'standard',
  ...
```

- [x] **Step 4: 跑测试验证绿**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`
Expected: PASS（全部用例绿）。

- [x] **Step 5: 提交**

```bash
git add frontend/src/modules/market/MarketTable.tsx frontend/src/modules/market/MarketTable.test.tsx
git commit -m "feat(market-table): 冻结合约列为最左列 (frozenColCount=1)"
```

---

### Task 2: 行情/期权页自动填充（问题 1，高宽都填）

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:196`（widthMode）
- Modify: `frontend/src/modules/market/styles.css:59-64`（`.panel-content`）
- Modify: `frontend/src/modules/options/OptionPanel.tsx:18-22, 272-275`（删除 chainHeight）
- Modify: `frontend/src/modules/options/styles.css:3-8, 146-148`（options-panel / options-chain-table）
- Test: `frontend/src/modules/market/MarketTable.test.tsx:164-176`、`MarketPanel.style.test.tsx`
- Create: `frontend/src/modules/options/OptionPanel.style.test.tsx`

**Interfaces:**
- Produces: 行情表 `widthMode: 'adaptive'`（列自适应填满容器）；`.panel-content` 无 `height:100%`；`.options-chain-table` `flex:1; height:100%`。

- [x] **Step 1: 写失败测试**

`MarketTable.test.tsx` 的「columns 包含合约乘数与最小变动价位，且采用固定列宽 standard」（164 行）改为：

```ts
it('columns 包含合约乘数与最小变动价位，且采用自适应宽度填满容器', async () => {
  const { ListTable } = await import('@visactor/vtable')
  render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
  const options = (ListTable as any).mock.calls[0][1]
  expect(options.widthMode).toBe('adaptive')
  const titles = options.columns.map((c: { title: string }) => c.title)
  expect(titles).toContain('合约乘数')
  expect(titles).toContain('最小变动价位')
  for (const col of options.columns) {
    expect(typeof col.width).toBe('number')
    expect(col.width as number).toBeGreaterThan(0)
  }
})
```

在 `MarketPanel.style.test.tsx` 追加（复用文件内 `readCssBlock`）：

```ts
describe('MarketPanel 高度链修复（审查）', () => {
  it('.panel-content 不再同时声明 flex:1 与 height:100%（双重计数）', () => {
    const block = readCssBlock('.panel-content')
    expect(block).toMatch(/flex:\s*1/)
    expect(block).not.toMatch(/height:\s*100%/)
  })
})
```

新建 `frontend/src/modules/options/OptionPanel.style.test.tsx`（复制 MarketPanel.style.test.tsx 的 `readCssBlock`，路径指向 `./styles.css`）：

```tsx
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readCssBlock(selector: string): string {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
  const match = css.match(re)
  if (!match) throw new Error(`CSS block not found: ${selector}`)
  return match[1]
}

describe('OptionPanel 自动填充', () => {
  it('.options-chain-table 以 height:100% 撑满可用高度（父级 .options-content 为 block 且已有 flex:1）', () => {
    const block = readCssBlock('.options-chain-table')
    expect(block).toMatch(/width:\s*100%/)
    expect(block).toMatch(/height:\s*100%/)
  })

  it('.options-panel 用 flex 填充（非固定 height:100%，避免与工具栏叠加溢出）', () => {
    const block = readCssBlock('.options-panel')
    expect(block).toMatch(/flex:\s*1\s+1\s+0/)
    expect(block).not.toMatch(/height:\s*100%/)
  })
})
```

- [x] **Step 2: 跑测试验证红**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx src/modules/market/MarketPanel.style.test.tsx src/modules/options/OptionPanel.style.test.tsx`
Expected: FAIL — widthMode 仍为 standard；`.panel-content` 仍含 `height:100%`；`.options-chain-table` 无 flex/height。

- [x] **Step 3: 最小实现**

`MarketTable.tsx:196`：`widthMode: 'standard'` → `widthMode: 'adaptive'`。

`frontend/src/modules/market/styles.css` `.panel-content`（59-64 行）：

```css
.market-panel .panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

`frontend/src/modules/options/OptionPanel.tsx`：
- 删除 18-22 行的 `chainHeight()` 函数；
- 272-275 行 `<div className="options-chain-table" style={{ height: chainHeight(selectedChain) }}>` → `<div className="options-chain-table">`。

`frontend/src/modules/options/styles.css`：
- `.options-panel`：`height: 100%;` → `flex: 1 1 0; min-height: 0;`（保留 `display:flex; flex-direction:column; padding:8px;`）。
- `.options-chain-table`：

```css
.options-chain-table {
  width: 100%;
  height: 100%;
}
```

- [x] **Step 4: 跑测试验证绿**

Run: 同 Step 2 命令。
Expected: PASS。

- [ ] **Step 5: 浏览器验证**

`cd frontend && npm run dev` + 后端 `start.py`：行情页与 T型期权页随窗口大小自适应填满（宽屏/窄屏各测一次）。若 `adaptive` 挤压价格列观感不佳，回退「固定列宽 + 末尾弹性列」并更新本任务测试（在 `MarketTable.tsx` 把末列 `favorite` 加 `width: 'auto'`/flex 并去掉 `widthMode` 断言）。

- [x] **Step 6: 提交**

```bash
git add frontend/src/modules/market/MarketTable.tsx frontend/src/modules/market/styles.css frontend/src/modules/market/MarketTable.test.tsx frontend/src/modules/market/MarketPanel.style.test.tsx frontend/src/modules/options/OptionPanel.tsx frontend/src/modules/options/styles.css frontend/src/modules/options/OptionPanel.style.test.tsx
git commit -m "feat(market): 行情/期权页自动填充 — widthMode adaptive + 高度链修复"
```

---

### Task 3: 右键选中合约（问题 4）

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:331-347`（contextmenu_cell）
- Modify: `frontend/src/hooks/useContractContextMenu.ts:93-97`（handleContextMenu）
- Test: `frontend/src/modules/market/MarketTable.test.tsx`、`frontend/src/hooks/useContractContextMenu.test.ts`

**Interfaces:**
- Consumes: `onSelectionChangeRef.current`（已有）、`useMarketStore.getState().setSelectedInstrument`（已有）。
- Produces: 右键落在集合外 → `selectedContracts={id}` + `selectedInstrument=id`；右键命中集合内 → 保持集合。

- [x] **Step 1: 写失败测试**

`MarketTable.test.tsx` 在「右键点击时调用 onContextMenu 并传入合约信息」（367 行）附近追加：

```ts
it('右键落在多选集合外时，先把该合约置为单选选中（同步蓝区）', async () => {
  const onContextMenu = vi.fn()
  const onSelectionChange = vi.fn()
  render(
    <MarketTable
      contracts={mockContracts}
      snapshots={mockSnapshots}
      selectedContracts={new Set(['ag2508'])} // 多选集合不包含 au2508
      onSelectionChange={onSelectionChange}
      onContextMenu={onContextMenu}
    />
  )
  const { ListTable } = await import('@visactor/vtable')
  const tableInstance = (ListTable as any).mock.results[0].value
  const contextmenuHandler = tableInstance.on.mock.calls.find(
    (call: any[]) => call[0] === 'contextmenu_cell'
  )?.[1]

  contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } }) // row1 → au2508

  expect(onSelectionChange).toHaveBeenCalledWith(new Set(['au2508']))
  expect(onContextMenu).toHaveBeenCalledWith('au2508', 480.5, expect.any(Object))
})

it('右键命中多选集合内时保持集合不变，显示多选菜单', async () => {
  const onMultiSelectContextMenu = vi.fn()
  const onSelectionChange = vi.fn()
  render(
    <MarketTable
      contracts={mockContracts}
      snapshots={mockSnapshots}
      selectedContracts={new Set(['au2508', 'ag2508'])}
      onSelectionChange={onSelectionChange}
      onMultiSelectContextMenu={onMultiSelectContextMenu}
    />
  )
  const { ListTable } = await import('@visactor/vtable')
  const tableInstance = (ListTable as any).mock.results[0].value
  const contextmenuHandler = tableInstance.on.mock.calls.find(
    (call: any[]) => call[0] === 'contextmenu_cell'
  )?.[1]

  contextmenuHandler({ row: 1, col: 0, event: { clientX: 100, clientY: 200 } }) // au2508 在集合内

  expect(onSelectionChange).not.toHaveBeenCalled()
  expect(onMultiSelectContextMenu).toHaveBeenCalledWith(['au2508', 'ag2508'], expect.any(Object))
})
```

`useContractContextMenu.test.ts` 追加：

```ts
import { useMarketStore } from '@/modules/market/store'

it('handleContextMenu 同步 selectedInstrument 到右键合约（金色锚点）', () => {
  useMarketStore.setState({ selectedInstrument: null })
  const { result } = renderHook(() => useContractContextMenu())
  act(() => {
    result.current.handleContextMenu('IF2608', 4695, {
      preventDefault: vi.fn(),
      clientX: 120,
      clientY: 240,
    } as unknown as MouseEvent)
  })
  expect(useMarketStore.getState().selectedInstrument).toBe('IF2608')
})
```

- [x] **Step 2: 跑测试验证红**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx src/hooks/useContractContextMenu.test.ts`
Expected: FAIL — 右键后 `onSelectionChange` 未被调用；`selectedInstrument` 未变。

- [x] **Step 3: 最小实现**

`MarketTable.tsx` `contextmenu_cell`（331-347 行）的 else 分支加一行：

```ts
} else {
  // 右键落在集合外 → 先同步蓝区（单选该合约），再显示单选菜单
  if (onSelectionChangeRef.current) {
    onSelectionChangeRef.current(new Set([record.instrumentID]))
  }
  const price = record.lastPrice === PLACEHOLDER ? 0 : (record.lastPrice as number)
  onContextMenuRef.current?.(record.instrumentID, price, event)
}
```

`useContractContextMenu.ts` `handleContextMenu`（93-97 行）：

```ts
const handleContextMenu = useCallback((instrumentID: string, price: number, event: MouseEvent) => {
  event.preventDefault()
  setMultiSelectMenu(null) // 关闭多选菜单
  // 同步金色活动锚点到右键合约（选中态一致性：金在蓝内）
  useMarketStore.getState().setSelectedInstrument(instrumentID)
  setContextMenu({ instrumentID, price, x: event.clientX, y: event.clientY })
}, [])
```

（`useMarketStore` 已在文件第 3 行导入。）

- [x] **Step 4: 跑测试验证绿**

Run: 同 Step 2 命令。
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add frontend/src/modules/market/MarketTable.tsx frontend/src/modules/market/MarketTable.test.tsx frontend/src/hooks/useContractContextMenu.ts frontend/src/hooks/useContractContextMenu.test.ts
git commit -m "feat(market-table): 右键选中合约 — 同步蓝区与金色锚点"
```

---

### Task 4: 高亮统一（问题 5，蓝色选区 + 金色活动锚点守卫）

**Files:**
- Modify: `frontend/src/modules/market/MarketTable.tsx:527-545`（selectRow effect + 守卫 + 锚点同步）
- Test: `frontend/src/modules/market/MarketTable.test.tsx`

**Interfaces:**
- Produces: 导出纯函数 `shouldRenderAnchor(selectedInstrument, selectedContracts): boolean`；selectRow effect 在锚点不在选区内时调 `clearSelected()`；`handleMouseDown` 新拖选时同步锚点。

- [ ] **Step 1: 写失败测试**

`MarketTable.test.tsx` 顶部 import 追加 `shouldRenderAnchor`：

```ts
import { MarketTable, shouldRenderAnchor } from './MarketTable'
```

文件末尾（`describe` 外层，或新建 describe）追加：

```ts
describe('shouldRenderAnchor（金色活动锚点守卫）', () => {
  it('锚点在选区内返回 true（单选重合 / 多选锚点在集合内）', () => {
    expect(shouldRenderAnchor('au2508', new Set(['au2508']))).toBe(true)
    expect(shouldRenderAnchor('au2508', new Set(['au2508', 'ag2508']))).toBe(true)
  })

  it('锚点不在选区内返回 false（防第二个高亮区）', () => {
    expect(shouldRenderAnchor('au2508', new Set(['ag2508']))).toBe(false)
    expect(shouldRenderAnchor('au2508', new Set())).toBe(false)
    expect(shouldRenderAnchor(null, new Set(['au2508']))).toBe(false)
    expect(shouldRenderAnchor(undefined, undefined)).toBe(false)
  })
})

describe('selectRow 守卫', () => {
  function stubRaf() {
    // jsdom 可能未实现 rAF：先兜底赋值，再 spy 使其同步触发回调
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0 }) as typeof requestAnimationFrame
    }
    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
    }
    const raf = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0 })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    return () => { raf.mockRestore(); cancel.mockRestore() }
  }

  it('锚点在选区内：渲染金色 selectRow', async () => {
    const restore = stubRaf()
    render(
      <MarketTable
        contracts={mockContracts}
        snapshots={mockSnapshots}
        selectedInstrument="au2508"
        selectedContracts={new Set(['au2508'])}
      />
    )
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    // au2508 在 contracts 中 index 0 → vtableRow 1
    expect(instance.selectRow).toHaveBeenCalledWith(1)
    expect(instance.clearSelected).not.toHaveBeenCalled()
    restore()
  })

  it('锚点不在选区内：清除金色（clearSelected），不渲染独立高亮', async () => {
    const restore = stubRaf()
    render(
      <MarketTable
        contracts={mockContracts}
        snapshots={mockSnapshots}
        selectedInstrument="au2508"
        selectedContracts={new Set(['ag2508'])}
      />
    )
    const { ListTable } = await import('@visactor/vtable')
    const instance = (ListTable as any).mock.results[0].value
    expect(instance.selectRow).not.toHaveBeenCalled()
    expect(instance.clearSelected).toHaveBeenCalled()
    restore()
  })
})
```

- [ ] **Step 2: 跑测试验证红**

Run: `cd frontend && npx vitest run src/modules/market/MarketTable.test.tsx`
Expected: FAIL — `shouldRenderAnchor` 未导出（undefined）；selectRow 无守卫（锚点不在选区内仍 selectRow）。

- [ ] **Step 3: 最小实现**

`MarketTable.tsx` 组件外（`columns` 定义附近）加纯函数并导出：

```ts
/** 金色活动锚点是否渲染：仅当锚点合约位于选中选区内（金在蓝内，防双高亮区） */
export function shouldRenderAnchor(
  selectedInstrument: string | null | undefined,
  selectedContracts?: Set<string>,
): boolean {
  if (!selectedInstrument) return false
  if (!selectedContracts || selectedContracts.size === 0) return false
  return selectedContracts.has(selectedInstrument)
}
```

重写 selectRow effect（527-545 行）：

```ts
useEffect(() => {
  if (!tableRef.current) return
  if (!shouldRenderAnchor(selectedInstrument, selectedContracts)) {
    // 锚点不在选区内 → 清除 vtable 原生金色选中，避免独立高亮区
    try {
      tableRef.current.clearSelected()
    } catch {
      // vtable 尚未就绪
    }
    return
  }
  const rowIndex = contracts.findIndex((c) => c.instrumentID === selectedInstrument)
  if (rowIndex < 0) return
  const vtableRow = rowIndex + 1
  const raf = requestAnimationFrame(() => {
    try {
      tableRef.current?.selectRow(vtableRow)
      const range = tableRef.current?.getBodyVisibleCellRange()
      if (range && (vtableRow < range.rowStart || vtableRow > range.rowEnd)) {
        tableRef.current?.scrollToCell({ row: vtableRow, col: 0 })
      }
    } catch {
      // vtable 尚未就绪
    }
  })
  return () => cancelAnimationFrame(raf)
}, [selectedInstrument, selectedContracts, contracts])
```

`handleMouseDown`（392-405 行）新拖选时同步锚点：

```ts
const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return // 只处理左键
  const rowIndex = getRowFromEvent(e)
  if (rowIndex < 0 || rowIndex >= recordsRef.current.length) return

  isDragging = true
  dragStartRow = rowIndex
  dragSelected = new Set(selectedContractsRef.current ?? [])

  // 如果没有按 Ctrl/Shift，开始新的选择
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
    dragSelected = new Set()
    // 锚点同步：新拖选以起始行为金色活动锚点（金始终在选区内）
    const startRecord = recordsRef.current[rowIndex]
    if (startRecord) useMarketStore.getState().setSelectedInstrument(startRecord.instrumentID)
  }
}
```

- [ ] **Step 4: 跑测试验证绿**

Run: 同 Step 2 命令。
Expected: PASS。

> 注：`instance.selectRow`/`instance.clearSelected` 来自 vitest 自动 mock 的 ListTable 实例，均为 `vi.fn()`。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/market/MarketTable.tsx frontend/src/modules/market/MarketTable.test.tsx
git commit -m "feat(market-table): 高亮统一 — 金色锚点守卫+拖选锚点同步（金在蓝内）"
```

---

### Task 5: 自选订阅一致性 — 前端（问题 3）

**Files:**
- Modify: `frontend/src/stores/contracts.ts`（收藏不再直连订阅/退订）
- Modify: `frontend/src/modules/market/store.ts`（forceResubscribeSeq + markForceResubscribe）
- Modify: `frontend/src/hooks/useSubscriptionManager.ts`（消费强制重订阅信号）
- Modify: `frontend/src/hooks/useSystemWs.ts`（mdConnected:true → markForceResubscribe）
- Test: `frontend/src/stores/contracts.test.ts`、`frontend/src/modules/market/store.test.ts`、`frontend/src/hooks/useSubscriptionManager.test.ts`、`frontend/src/hooks/useSystemWs.test.ts`（新建）

**Interfaces:**
- Consumes: `useMarketStore` 新增 `forceResubscribeSeq: number`、`markForceResubscribe(): void`。
- Produces: `addToFavorites`/`removeFromFavorites` 不再调用 `subscribeMarket`/`unsubscribeMarket`（订阅由管理器 diff 负责）；`useSystemWs` 收到 `connection_status {mdConnected:true}` 时调 `markForceResubscribe()`。

- [ ] **Step 1: 写失败测试**

`frontend/src/modules/market/store.test.ts` 追加：

```ts
describe('MarketStore - forceResubscribeSeq', () => {
  beforeEach(() => {
    useMarketStore.setState({ forceResubscribeSeq: 0 })
  })

  it('markForceResubscribe 递增强制重订阅信号', () => {
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
    useMarketStore.getState().markForceResubscribe()
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(1)
    useMarketStore.getState().markForceResubscribe()
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(2)
  })
})
```

`frontend/src/hooks/useSubscriptionManager.test.ts`：在「useSubscriptionManager 延迟退订」describe 的 beforeEach 的 `useMarketStore.setState({...})` 里加 `forceResubscribeSeq: 0`；并新增测试：

```ts
it('forceResubscribeSeq 递增时清空 subscribedRef 并对全部 should 重订阅', async () => {
  const { result } = renderHook(() => useSubscriptionManager())

  act(() => useMarketStore.getState().setVisibleInstrumentIDs(['IF2608']))
  await act(async () => { vi.advanceTimersByTime(110) })
  expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
  vi.mocked(subscribeMarket).mockClear()

  // 模拟 WS 重连触发强制重订阅：即使 IF2608 已在 subscribedRef 仍重发订阅
  act(() => useMarketStore.getState().markForceResubscribe())
  await act(async () => {})

  expect(vi.mocked(subscribeMarket)).toHaveBeenCalledWith(['IF2608'])
  expect(result.current.subscribed.has('IF2608')).toBe(true)
})
```

`frontend/src/stores/contracts.test.ts` 更新三处：
- `loadFavoriteContracts 从 localStorage 加载收藏合约并订阅` → 改名 `...加载收藏合约（订阅由订阅管理器负责）`，断言 `subscribeMarket` 未被调用：

```ts
it('loadFavoriteContracts 从 localStorage 加载收藏合约（订阅由订阅管理器负责）', async () => {
  const { getInstrumentsByIds, subscribeMarket } = await import('@/services/api')
  vi.mocked(getInstrumentsByIds).mockResolvedValue({ instruments: [mockContract], count: 1 })

  useUserPrefsStore.getState().addSelectedContract('au2406')
  useUserPrefsStore.getState().saveToLocalStorage()

  await useContractsStore.getState().loadFavoriteContracts()

  expect(getInstrumentsByIds).toHaveBeenCalledWith(['au2406'])
  expect(subscribeMarket).not.toHaveBeenCalled()
  expect(useContractsStore.getState().favorites).toEqual([mockContract])
})
```

- `addToFavorites 添加到收藏并订阅` → 改名 `...添加到收藏（订阅由订阅管理器负责）`：

```ts
it('addToFavorites 添加到收藏（订阅由订阅管理器负责）', async () => {
  const { subscribeMarket } = await import('@/services/api')

  await useContractsStore.getState().addToFavorites(mockContract)

  expect(useContractsStore.getState().favorites).toEqual([mockContract])
  expect(useUserPrefsStore.getState().selectedContracts).toContain('au2406')
  expect(subscribeMarket).not.toHaveBeenCalled()
})
```

- `removeFromFavorites 从收藏移除并取消订阅` → 改名 `...从收藏移除（退订由订阅管理器负责）`：

```ts
it('removeFromFavorites 从收藏移除（退订由订阅管理器负责）', async () => {
  const { unsubscribeMarket } = await import('@/services/api')

  useContractsStore.setState({ favorites: [mockContract] })
  useUserPrefsStore.getState().addSelectedContract('au2406')

  await useContractsStore.getState().removeFromFavorites('au2406')

  expect(useContractsStore.getState().favorites).toEqual([])
  expect(useUserPrefsStore.getState().selectedContracts).not.toContain('au2406')
  expect(unsubscribeMarket).not.toHaveBeenCalled()
})
```

新建 `frontend/src/hooks/useSystemWs.test.ts`（参照 `useMarketWs.test.ts` 的 WSManager mock 模式；用真实 `useConnectionStore`/`useMarketStore`，仅 mock `@/services/ws`）：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSystemWs } from './useSystemWs'
import { useMarketStore } from '@/modules/market/store'

const mockConnect = vi.fn()
vi.mock('@/services/ws', () => ({
  WSManager: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnectAll: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    onClose: vi.fn(),
  })),
}))

describe('useSystemWs 强制重订阅触发', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useMarketStore.setState({ forceResubscribeSeq: 0 })
    mockConnect.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('收到 connection_status mdConnected:true 时触发强制重订阅', () => {
    renderHook(() => useSystemWs('ws://localhost:8000'))
    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
    act(() => {
      onMessage({ type: 'connection_status', data: { mdConnected: true } })
    })
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(1)
  })

  it('mdConnected:false 不触发强制重订阅', () => {
    renderHook(() => useSystemWs('ws://localhost:8000'))
    const onMessage = mockConnect.mock.calls[0][1] as (msg: { type: string; data: unknown }) => void
    act(() => {
      onMessage({ type: 'connection_status', data: { mdConnected: false } })
    })
    expect(useMarketStore.getState().forceResubscribeSeq).toBe(0)
  })
})
```

（`useSystemWs` 用真实 `useConnectionStore`，其 `setMdPhase`/`setTdPhase` 在测试中无副作用断言。）

- [ ] **Step 2: 跑测试验证红**

Run: `cd frontend && npx vitest run src/modules/market/store.test.ts src/hooks/useSubscriptionManager.test.ts src/stores/contracts.test.ts src/hooks/useSystemWs.test.ts`
Expected: FAIL — `forceResubscribeSeq` 属性不存在 / 收藏仍调用订阅 API / mdConnected:true 未触发 markForceResubscribe。

- [ ] **Step 3: 最小实现**

`frontend/src/modules/market/store.ts`：
- 接口加：

```ts
/** 强制重订阅信号序号（WS 重连后递增；消费后无需重置） */
forceResubscribeSeq: number
/** 标记一次强制重订阅（WS 连接成功后调用），使订阅管理器清空 subscribedRef 重发全部订阅 */
markForceResubscribe: () => void
```

- 实现加：

```ts
forceResubscribeSeq: 0,
markForceResubscribe: () => set((state) => ({ forceResubscribeSeq: state.forceResubscribeSeq + 1 })),
```

`frontend/src/stores/contracts.ts`：
- import 去掉 `subscribeMarket, unsubscribeMarket`，只留 `getInstruments, getInstrumentsByIds`。
- `loadFavoriteContracts`：删掉 `// 订阅收藏合约` + `await subscribeMarket(ids)` 两段，保留 `set({ favorites: result.instruments })`。
- `addToFavorites`：删掉订阅 guard（`try { await subscribeMarket(...) } catch { return false }`），直接持久化 + set。
- `removeFromFavorites`：删掉 `unsubscribeMarket` 调用块。

> **UX 提示**：`addToFavorites` 去掉订阅 guard 后恒返回 `true`，MarketPanel 批量/右键收藏 toast 计数由「实收 N」变「乐观 N」（`MarketPanel.tsx:203,332`）——订阅失败静默由管理器 diff 重试，不再阻断收藏。

`frontend/src/hooks/useSubscriptionManager.ts`：
- 读信号：`const forceResubscribeSeq = useMarketStore((s) => s.forceResubscribeSeq)`。
- 加 ref：`const lastHandledForceResubscribeRef = useRef(0)`。
- 在既有 effect（178 行起）顶部加分支：

```ts
useEffect(() => {
  // 强制重订阅：WS（重）连接后清空 subscribedRef，对全部 should 重发一次批量订阅，
  // 一次性治愈后端/CTP 订阅失步（如 CTP 重连后订阅丢失）
  if (forceResubscribeSeq > lastHandledForceResubscribeRef.current) {
    lastHandledForceResubscribeRef.current = forceResubscribeSeq
    subscribedRef.current.clear()
    recentChangesRef.current = []
    if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
    runFullDiff()
    return () => {
      if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
      if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
    }
  }

  // ...原有 scrollEndSeq / 拖动态逻辑不动...
}, [visibleInstrumentIDs, isDragging, runFullDiff, scrollEndSeq, forceResubscribeSeq])
```

`frontend/src/hooks/useSystemWs.ts`：顶部加 import：

```ts
import { useMarketStore } from '@/modules/market/store'
```

在 `handleMessage` 的 `connection_status` 分支加治愈触发：

```ts
if (message.type === 'connection_status') {
  const data = message.data as {
    mdConnected?: boolean
    tdConnected?: boolean
    reason?: number
  }

  // MD 状态即时更新
  if (data.mdConnected !== undefined) {
    setMdPhase(data.mdConnected ? 'connected' : 'disconnected')
  }

  // 治愈兜底：CTP MD 确认连上（初始登录 ctp_startup.py:211 / 重连成功 :364 广播）时
  // 强制重订阅——后端 CTP 重连对浏览器 WS 透明，此信号才是订阅失步的正确治愈时机
  if (data.mdConnected === true) {
    useMarketStore.getState().markForceResubscribe()
  }

  // TD 状态即时更新
  if (data.tdConnected !== undefined) {
    setTdPhase(data.tdConnected ? 'connected' : 'disconnected')
  }
}
```

`services/ws.ts` / `useMarketWs.ts` **保持不动**（强制重订阅不经 WS 打开事件触发）。

- [ ] **Step 4: 跑测试验证绿**

Run: 同 Step 2 命令 + `cd frontend && npx vitest run src/hooks/useSystemWs.test.ts`。
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/stores/contracts.ts frontend/src/stores/contracts.test.ts frontend/src/modules/market/store.ts frontend/src/modules/market/store.test.ts frontend/src/hooks/useSubscriptionManager.ts frontend/src/hooks/useSubscriptionManager.test.ts frontend/src/hooks/useSystemWs.ts frontend/src/hooks/useSystemWs.test.ts
git commit -m "feat(subscription): 收藏统一由订阅管理器管理 + mdConnected 广播触发强制重订阅兜底"
```

---

### Task 6: 自选订阅一致性 — 后端（问题 3）

**Files:**
- Modify: `server/services/market_service.py:216-270`（subscribe 先验证后记录）
- Modify: `server/services/ctp_startup.py:336-346`（`_subscribe_with_tracking` 透传返回值 + `_wire_bridge` 同步权威订阅列表）
- Test: `server/tests/test_market_service.py`、`server/tests/test_ctp_startup.py`

**Interfaces:**
- Consumes: `subscribe_fn` 返回 `int`（0=成功，非 0=失败）或 `None`（兼容旧测试钩子，视为成功）。
- Produces: `subscribe()` 在 CTP 失败（抛异常或返回非 0）时不写入 `_subscriptions`，返回 `success:false`。

- [ ] **Step 1: 写失败测试**

`server/tests/test_market_service.py`：
- 更新 `test_subscribe_ctp_fn_exception_returns_failure`（310-321 行）断言 `== 0`：

```python
def test_subscribe_ctp_fn_exception_returns_failure(self):
    """If CTP subscribe raises, returns success=False and does NOT record (rollback)."""
    svc = MarketService()
    svc.set_ctp_hooks(
        subscribe_fn=lambda insts: (_ for _ in ()).throw(RuntimeError("CTP error")),
        unsubscribe_fn=lambda insts: None,
    )
    result = svc.subscribe(["IF2608"])
    assert result["success"] is False
    assert "message" in result
    assert "CTP error" in result["message"]
    assert svc.subscription_count == 0  # 回滚：未写入本地（消除假成功）
```

- 在 `TestCtpHooks` 追加两个用例：

```python
def test_subscribe_ctp_fn_nonzero_returns_failure_rollback(self):
    """If CTP subscribe returns non-zero, subscribe fails and does NOT record."""
    svc = MarketService()
    svc.set_ctp_hooks(
        subscribe_fn=lambda insts: -1,  # CTP 拒绝
        unsubscribe_fn=lambda insts: None,
    )
    result = svc.subscribe(["IF2608"])
    assert result["success"] is False
    assert "code=-1" in result["message"]
    assert svc.subscription_count == 0  # 未写入本地（先验证后记录）

def test_subscribe_ctp_fn_zero_records(self):
    """If CTP subscribe returns 0, subscribe succeeds and records locally."""
    svc = MarketService()
    svc.set_ctp_hooks(
        subscribe_fn=lambda insts: 0,  # CTP 成功
        unsubscribe_fn=lambda insts: None,
    )
    result = svc.subscribe(["IF2608"])
    assert result["success"] is True
    assert svc.subscription_count == 1
```

`server/tests/test_ctp_startup.py` 末尾新增（复用文件内已有 `_FakeApp`/`_FakeMdApi`/`MagicMock`/`patch` import，`_FakeApp.state.market_service` 为 MagicMock）：

```python
class TestWireBridge:
    """_wire_bridge — 订阅 hook 透传 CTP 返回值（先验证后记录的前提）。"""

    @patch("services.ctp_startup.KLineService")
    def test_subscribe_hook_returns_ctp_result(self, MockKLine):
        from services.ctp_startup import _wire_bridge

        app = _FakeApp()
        app.state.market_service.get_subscriptions.return_value = ["IF2608"]
        fake_api = _FakeMdApi(config=MagicMock())
        fake_api.subscribe = lambda insts: -1  # CTP 拒绝

        _wire_bridge(app, fake_api, MagicMock())

        # set_ctp_hooks 收到的 subscribe_fn 即 _subscribe_with_tracking，
        # 必须透传 CTP 返回值（-1），供 MarketService 先验证后记录
        subscribe_fn = app.state.market_service.set_ctp_hooks.call_args.args[0]
        assert subscribe_fn(["IF2608"]) == -1
```

- [ ] **Step 2: 跑测试验证红**

Run: `cd server && python -m pytest tests/test_market_service.py -v`
Expected: FAIL — `test_subscribe_ctp_fn_exception_returns_failure` 断言 count==1 现仍通过但期望改为 0 而实现未改 → 红；新增两用例失败。

- [ ] **Step 3: 最小实现**

`server/services/market_service.py` 重写 `subscribe`（216-270 行）：

```python
def subscribe(self, instruments: List[str]) -> dict:
    """Subscribe to market data for a list of instruments.

    Returns:
        dict with keys: success, added, alreadySubscribed, message (if limit hit).
    """
    if not instruments:
        return {"success": True, "added": 0, "alreadySubscribed": []}

    with self._lock:
        already: List[str] = []
        new_instruments: List[str] = []

        for inst in instruments:
            if inst in self._subscriptions:
                already.append(inst)
            else:
                new_instruments.append(inst)

        # Check limit BEFORE calling CTP (atomic check for batch)
        if len(self._subscriptions) + len(new_instruments) > self.MAX_SUBSCRIPTIONS:
            return {
                "success": False,
                "added": 0,
                "alreadySubscribed": already,
                "message": (
                    f"Subscription limit exceeded: "
                    f"{len(self._subscriptions)} subscribed, "
                    f"cannot add {len(new_instruments)} more "
                    f"(max {self.MAX_SUBSCRIPTIONS})"
                ),
            }

    # CTP 订阅成功后才写入本地跟踪（先验证后记录）：
    # 避免「假成功」——本地已记录但 CTP 实际未订阅 → 前端永不重试 → 永久无数据。
    # 契约：subscribe_fn 返回 0=成功；非 0=失败；None 兼容旧测试钩子视为成功。
    if new_instruments and self._subscribe_fn is not None:
        try:
            ctp_result = self._subscribe_fn(new_instruments)
        except Exception as exc:
            logger.warning("CTP subscribe failed for %s", new_instruments, exc_info=True)
            return {
                "success": False,
                "added": 0,
                "alreadySubscribed": already,
                "message": f"CTP subscribe failed: {exc}",
            }
        if ctp_result is not None and ctp_result != 0:
            logger.warning("CTP subscribe returned %s for %s", ctp_result, new_instruments)
            return {
                "success": False,
                "added": 0,
                "alreadySubscribed": already,
                "message": f"CTP subscribe failed (code={ctp_result})",
            }

    if new_instruments:
        with self._lock:
            for inst in new_instruments:
                self._subscriptions.add(inst)

    return {"success": True, "added": len(new_instruments), "alreadySubscribed": already}
```

`server/services/ctp_startup.py` `_subscribe_with_tracking`（336-341 行）：

```python
def _subscribe_with_tracking(instruments: List[str]):
    """订阅 + 同步 ReconnectService 订阅跟踪；透传 CTP 返回值（0=成功，供 MarketService 先验证后记录）。"""
    result = _original_subscribe(instruments)
    reconnect_svc.update_subscriptions(app.state.market_service.get_subscriptions())
    return result
```

`server/services/ctp_startup.py` `_wire_bridge` 在 `set_ctp_hooks` 后（346 行）加：

```python
app.state.market_service.set_ctp_hooks(
    subscribe_fn=_subscribe_with_tracking,
    unsubscribe_fn=md_api.unsubscribe,
)
# 重连恢复订阅使用权威订阅列表：随每次 wiring（含重连）同步，退订后不残留过期快照
reconnect_svc.update_subscriptions(app.state.market_service.get_subscriptions())
```

- [ ] **Step 4: 跑测试验证绿**

Run: `cd server && python -m pytest tests/test_market_service.py tests/test_ctp_startup.py -v`
Expected: PASS（含更新/新增用例）。

- [ ] **Step 5: 全量回归**

Run: `cd server && python -m pytest tests/ -v`
Expected: 108 个单测全绿。

- [ ] **Step 6: 提交**

```bash
git add server/services/market_service.py server/services/ctp_startup.py server/tests/test_market_service.py server/tests/test_ctp_startup.py
git commit -m "fix(market): 订阅先验证后记录 + 重连权威订阅列表（消除假成功）"
```

---

## 收尾验证

1. `cd frontend && npm test` — 前端全量绿（469 + 新增用例）。
2. `cd server && python -m pytest tests/ -v` — 后端全量绿。
3. `cd frontend && npm run dev` + `cd server && python start.py` 手动过一遍：
   - **#1** 行情/期权页随窗口自适应填满（宽屏/窄屏）。
   - **#2** 行情表横向拖动，「合约」列固定最左。
   - **#3** 收藏→移除→滚动→重收、以及 CTP 断线重连后，自选/可见合约数据恢复推送。
   - **#4** 右键不同合约，高亮立即切换到该合约。
   - **#5** 拖选/Shift/Ctrl+A，高亮始终唯一（蓝区 + 金锚，无第二高亮区）。

## 已完成记录

- `a272691` feat(market-table): 右键选中合约 — 同步蓝区与金色锚点 — Task 3 ✅
- `232bf25` feat(market): 行情/期权页自动填充 — widthMode adaptive + 高度链修复 — Task 2 ✅（浏览器验证待人工）
- `2ebb2ef` feat(market-table): 冻结合约列为最左列 (frozenColCount=1) — Task 1 ✅
- `7306127` docs: 新增行情表填充/合约列冻结/选中态与订阅一致性修复设计文档
- `48ed839` docs: 问题5高亮方案改为保留金色作活动锚点+选区守卫
