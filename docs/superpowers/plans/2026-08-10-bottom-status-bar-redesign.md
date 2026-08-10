# 底部状态栏改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GlobalBar 中除「打开的行情/报单标签」外的内容（MD/TD 连接状态 + 全部工具）移到应用底部，形成全局常驻的 BottomBar；工具按钮改为「图标 + 中文名」并直接平铺（移除 ⋯ 菜单）；加 `>`/`<` 箭头做全部展开/收起动画；修复行情表横向进度条在行数少时「跑到上边去」的 bug。

**Architecture:** GlobalBar 瘦身为只承载 TabBar 的顶栏；新建 BottomBar（`components/BottomBar/`）承接连接状态 + 6 个工具按钮（图标+中文名）+ 箭头开关，挂到 App 的 `.app` flex 列尾部。进度条修复通过给共享 `PROMINENT_SCROLL_STYLE` 加 `barToSide: true` 实现（vtable 内部将横向滚动条钉在视口底部而非内容底部）。

**Tech Stack:** React 18 + TypeScript + Vite；Zustand；@visactor/vtable 1.26.4；vitest + @testing-library/react。

## Global Constraints

- 分支 `feature/top-tab`。
- 前端 `frontend/src`，无后端改动。
- 不改连接状态数据流（useSystemWs / useConnectionPoll / connection store）。
- 不做展开/收起状态持久化（localStorage）。
- 不改变 TabBar 拖拽分离 / 浮动窗口 / 右键菜单行为。
- 不改 `FLOATING_CHROME_H` 与浮动窗口定位。
- 顶栏 GlobalBar 高度保持 40px；底栏 BottomBar 高度 40px。
- 全量前端测试 + `npm run build` 必须通过。

---

### Task 1: 共享滚动条主题加 barToSide，修复进度条跑到上边

**Files:**
- Modify: `frontend/src/utils/vtableTheme.ts:10-15`
- Test: `frontend/src/modules/market/MarketTable.test.tsx:197-206`
- Test: `frontend/src/modules/options/TQuoteTable.test.tsx:65-75`

**Interfaces:**
- Consumes: 现有 `PROMINENT_SCROLL_STYLE`（MarketTable 与 TQuoteTable 的 theme.scrollStyle 均展开此常量）。
- Produces: `PROMINENT_SCROLL_STYLE.barToSide === true`。后续无其他任务依赖此字段。

- [ ] **Step 1: 写失败测试（MarketTable）**

在 `MarketTable.test.tsx` 的「横向滚动条样式明显」用例末尾追加断言：

```tsx
    expect(ss.scrollSliderColor).toBe('#4a9eff') // 高亮滑块色，便于发现
    expect(ss.barToSide).toBe(true) // 进度条钉在视口底部，行数少时不跑到上边去
```

- [ ] **Step 2: 写失败测试（TQuoteTable）**

在 `TQuoteTable.test.tsx` 的「采用固定列宽 standard + 明显的滚动条」用例末尾追加：

```tsx
    expect(ss.scrollSliderColor).toBe('#4a9eff')
    expect(ss.barToSide).toBe(true)
```

- [ ] **Step 3: 跑测试确认红**

Run: `npx vitest run src/modules/market/MarketTable.test.tsx src/modules/options/TQuoteTable.test.tsx`
Expected: 2 条失败，`expect(ss.barToSide).toBe(true)` 报「received: undefined」。

- [ ] **Step 4: 实现**

`frontend/src/utils/vtableTheme.ts` 的 `PROMINENT_SCROLL_STYLE` 加一行：

```ts
export const PROMINENT_SCROLL_STYLE = {
  scrollSliderColor: '#4a9eff',
  scrollRailColor: '#21262d',
  width: SCROLLBAR_SIZE,
  visible: 'always' as const,
  /** 进度条钉在表格视口底部（而非内容底部）：行数少时不再跑到上边 */
  barToSide: true,
}
```

- [ ] **Step 5: 跑测试确认绿**

Run: `npx vitest run src/modules/market/MarketTable.test.tsx src/modules/options/TQuoteTable.test.tsx`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/utils/vtableTheme.ts frontend/src/modules/market/MarketTable.test.tsx frontend/src/modules/options/TQuoteTable.test.tsx
git commit -m "fix(market): 滚动条 barToSide 钉在视口底部，行情表行数少时进度条不再跑到上边"
```

---

### Task 2: 新建 BottomBar 组件（连接状态 + 带中文名工具 + 箭头开关）

**Files:**
- Create: `frontend/src/components/BottomBar/index.tsx`
- Create: `frontend/src/components/BottomBar/styles.css`
- Create: `frontend/src/components/BottomBar/index.test.tsx`

**Interfaces:**
- Consumes: `ConnectionStatus`（`@/components/ConnectionStatus`）、`PerfMonitor`（`@/components/PerfMonitor`）、`useMarketStore`（`@/modules/market/store`）、`openFloatingTab` / `ORDER_FLOATING_SIZE`（`@/utils/openFloatingTab`）。
- Produces: `BottomBar({ perfVisible: boolean; onTogglePerf: () => void })`。App 将在 Task 3 接入。
  - DOM 契约（测试与后续维护依赖）：`.bottom-bar` / `.bottom-bar__left` / `.bottom-bar__tools`（`data-testid="bottom-bar-tools"`，收起时加 `bottom-bar__tools--collapsed`）/ `.bottom-bar__tool`（icon + label 两个 span）/ `.bottom-bar__toggle`（`data-testid="bottom-bar-toggle"`）/ `.bottom-bar__fps`（`data-testid="bottom-bar-fps"`）。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/components/BottomBar/index.test.tsx`，内容完整如下：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from './index'
import { useConnectionStore } from '@/stores/connection'
import { useMarketStore } from '@/modules/market/store'

// Mock 统一浮动窗入口（BottomBar 所有工具入口均打开浮动窗口）
const { mockOpenFloatingTab } = vi.hoisted(() => ({
  mockOpenFloatingTab: vi.fn(),
}))

vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: mockOpenFloatingTab,
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
}))

// rAF stub（PerfMonitor visible=true 时使用）
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

describe('BottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rafCallbacks = []
    rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks = rafCallbacks.filter((_, i) => i + 1 !== id)
    })
    vi.stubGlobal('performance', { now: () => 0 })

    useConnectionStore.setState({
      md: { phase: 'connected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      mdConnected: true,
      td: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      tdConnected: false,
    })
    useMarketStore.setState({ selectedInstrument: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('布局', () => {
    it('渲染左区连接状态（MD/TD 指示灯）', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('工具按钮含图标 + 中文名', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      const cases: Array<[string, string, string]> = [
        ['报单', '📝', '报单'],
        ['K线', '📈', 'K线'],
        ['📋 查询', '📋', '查询'],
        ['设置', '⚙', '设置'],
        ['FPS 监控', '⚡', 'FPS 监控'],
        ['网络监控', '🔌', '网络监控'],
      ]
      for (const [label, icon, name] of cases) {
        const btn = screen.getByLabelText(label)
        expect(btn.textContent).toContain(icon)
        expect(btn.textContent).toContain(name)
      }
    })
  })

  describe('工具操作', () => {
    it('选中合约时点击 📝 报单为选中合约打开报单浮动窗口（尺寸 620×540）', () => {
      useMarketStore.setState({ selectedInstrument: 'IF2608' })
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('报单'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({
        type: 'order',
        title: '📝 报单-IF2608',
        props: { instrumentID: 'IF2608' },
        size: { w: 620, h: 540 },
      })
    })

    it('未选中合约时点击 📝 报单打开空白报单浮动窗口', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('报单'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({
        type: 'order',
        title: '📝 报单',
        props: {},
        size: { w: 620, h: 540 },
      })
    })

    it('选中合约时点击 📈 K线打开该合约的K线浮动窗口', () => {
      useMarketStore.setState({ selectedInstrument: 'IF2608' })
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('K线'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({
        type: 'kline',
        title: '📈 K线-IF2608',
        props: { instrumentID: 'IF2608' },
      })
    })

    it('未选中合约时点击 📈 K线打开空白K线浮动窗口', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('K线'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({ type: 'kline', title: '📈 K线', props: {} })
    })

    it('点击 📋 查询按钮打开查询浮动窗口', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('📋 查询'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({ type: 'query', title: '📋 查询' })
    })

    it('点击 ⚙ 设置按钮打开设置浮动窗口', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('设置'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({ type: 'settings', title: '⚙ 设置' })
    })

    it('点击 🔌 网络监控按钮打开网络监控浮动窗口', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('网络监控'))
      expect(mockOpenFloatingTab).toHaveBeenCalledWith({ type: 'ipc-monitor', title: '📡 网络监控' })
    })

    it('点击 ⚡FPS 监控按钮调用 onTogglePerf', () => {
      const onTogglePerf = vi.fn()
      render(<BottomBar perfVisible={false} onTogglePerf={onTogglePerf} />)
      fireEvent.click(screen.getByLabelText('FPS 监控'))
      expect(onTogglePerf).toHaveBeenCalled()
    })
  })

  describe('箭头展开/收起', () => {
    it('默认展开：工具区可见，箭头显示 <', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('<')
    })

    it('点击箭头收起：工具区加 collapsed 类，箭头变 >', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByTestId('bottom-bar-toggle'))
      expect(screen.getByTestId('bottom-bar-tools')).toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('>')
    })

    it('再次点击展开：移除 collapsed 类，箭头变回 <', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      const toggle = screen.getByTestId('bottom-bar-toggle')
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(toggle).toHaveTextContent('<')
    })
  })

  describe('性能监控', () => {
    it('perfVisible=false 时不显示 FPS 徽标', () => {
      render(<BottomBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
    })

    it('perfVisible=true 时显示 FPS 徽标', () => {
      render(<BottomBar perfVisible={true} onTogglePerf={vi.fn()} />)
      expect(screen.getByTestId('bottom-bar-fps')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/BottomBar/index.test.tsx`
Expected: FAIL，模块 `./index` 无法解析（组件不存在）。

- [ ] **Step 3: 创建样式**

创建 `frontend/src/components/BottomBar/styles.css`：

```css
.bottom-bar {
  display: flex;
  align-items: center;
  height: 40px;
  padding-left: 16px;
  gap: 8px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}

.bottom-bar__left {
  display: flex;
  align-items: center;
  margin-right: 12px;
  flex-shrink: 0;
}

/* 工具区：可整体展开/收起（max-width + opacity 动画） */
.bottom-bar__tools {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  overflow: hidden;
  white-space: nowrap;
  transition: max-width 0.3s ease, opacity 0.25s ease;
}

.bottom-bar__tools--collapsed {
  max-width: 0;
  opacity: 0;
  pointer-events: none;
}

.bottom-bar__tool {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.bottom-bar__tool:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.bottom-bar__tool--active {
  color: var(--accent);
  background: var(--accent-dim);
}

.bottom-bar__tool-icon {
  font-size: 14px;
  line-height: 1;
}

.bottom-bar__tool-label {
  font-size: 12px;
}

/* FPS 徽标：仅 perfVisible 时内联显示 */
.bottom-bar__fps {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: #3fb950;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: rgba(63, 185, 80, 0.08);
  white-space: nowrap;
}

/* 箭头开关：始终可见，不随工具区收缩 */
.bottom-bar__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  margin-right: 12px;
  transition: color 0.15s, background 0.15s;
}

.bottom-bar__toggle:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 4: 创建组件**

创建 `frontend/src/components/BottomBar/index.tsx`：

```tsx
import { useCallback, useState } from 'react'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { PerfMonitor } from '@/components/PerfMonitor'
import { useMarketStore } from '@/modules/market/store'
import { openFloatingTab, ORDER_FLOATING_SIZE } from '@/utils/openFloatingTab'
import './styles.css'

interface BottomBarProps {
  /** 性能监控（⚡FPS）是否可见 */
  perfVisible: boolean
  /** 切换性能监控 */
  onTogglePerf: () => void
}

/**
 * BottomBar — 底部状态栏
 *
 * 承接原 GlobalBar 中除「工作区标签」外的全部内容：
 * - 左：连接状态（MD/TD 指示灯）
 * - 中：全局工具（报单/K线/查询/设置/FPS/网络监控，图标 + 中文名）
 * - 右：`>`/`<` 箭头，点击切换工具区全部展开 / 全部隐藏（max-width + opacity 动画）
 */
export function BottomBar({ perfVisible, onTogglePerf }: BottomBarProps) {
  const [toolsExpanded, setToolsExpanded] = useState(true)

  // 统一浮动窗入口：所有工具打开为浮动窗口
  const openSettings = useCallback(() => {
    openFloatingTab({ type: 'settings', title: '⚙ 设置' })
  }, [])

  const openIpcMonitor = useCallback(() => {
    openFloatingTab({ type: 'ipc-monitor', title: '📡 网络监控' })
  }, [])

  const openQuery = useCallback(() => {
    openFloatingTab({ type: 'query', title: '📋 查询' })
  }, [])

  // 报单入口：优先为当前选中合约打开报单浮动窗；未选中合约时打开空白报单浮动窗
  const openOrder = useCallback(() => {
    const inst = useMarketStore.getState().selectedInstrument
    openFloatingTab({
      type: 'order',
      title: inst ? `📝 报单-${inst}` : '📝 报单',
      props: inst ? { instrumentID: inst } : {},
      size: ORDER_FLOATING_SIZE,
    })
  }, [])

  // K线入口：打开K线浮动窗；有选中合约则直接定位到该合约
  const openKline = useCallback(() => {
    const inst = useMarketStore.getState().selectedInstrument
    openFloatingTab({
      type: 'kline',
      title: inst ? `📈 K线-${inst}` : '📈 K线',
      props: inst ? { instrumentID: inst } : {},
    })
  }, [])

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar__left">
        <ConnectionStatus />
      </div>

      {/* 工具区：图标 + 中文名；箭头可整体收起/展开 */}
      <div
        className={`bottom-bar__tools${toolsExpanded ? '' : ' bottom-bar__tools--collapsed'}`}
        data-testid="bottom-bar-tools"
        aria-hidden={!toolsExpanded}
      >
        <button type="button" className="bottom-bar__tool" aria-label="报单" title="报单" onClick={openOrder}>
          <span className="bottom-bar__tool-icon">📝</span>
          <span className="bottom-bar__tool-label">报单</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="K线" title="K线" onClick={openKline}>
          <span className="bottom-bar__tool-icon">📈</span>
          <span className="bottom-bar__tool-label">K线</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="📋 查询" title="查询" onClick={openQuery}>
          <span className="bottom-bar__tool-icon">📋</span>
          <span className="bottom-bar__tool-label">查询</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="设置" title="设置" onClick={openSettings}>
          <span className="bottom-bar__tool-icon">⚙</span>
          <span className="bottom-bar__tool-label">设置</span>
        </button>
        <button
          type="button"
          className={`bottom-bar__tool${perfVisible ? ' bottom-bar__tool--active' : ''}`}
          aria-label="FPS 监控"
          title="FPS 监控 (Ctrl+Shift+M)"
          aria-pressed={perfVisible}
          onClick={onTogglePerf}
        >
          <span className="bottom-bar__tool-icon">⚡</span>
          <span className="bottom-bar__tool-label">FPS 监控</span>
        </button>
        <button type="button" className="bottom-bar__tool" aria-label="网络监控" title="网络监控" onClick={openIpcMonitor}>
          <span className="bottom-bar__tool-icon">🔌</span>
          <span className="bottom-bar__tool-label">网络监控</span>
        </button>

        {/* FPS 徽标：仅 perfVisible 时内联显示 */}
        {perfVisible && (
          <span className="bottom-bar__fps" data-testid="bottom-bar-fps" title="FPS 监控 (Ctrl+Shift+M)">
            ⚡<PerfMonitor visible />
          </span>
        )}
      </div>

      {/* 箭头开关：展开时 `<`（点击收起），收起时 `>`（点击展开） */}
      <button
        type="button"
        className="bottom-bar__toggle"
        data-testid="bottom-bar-toggle"
        aria-label={toolsExpanded ? '收起工具' : '展开工具'}
        aria-expanded={toolsExpanded}
        title={toolsExpanded ? '收起工具' : '展开工具'}
        onClick={() => setToolsExpanded((v) => !v)}
      >
        {toolsExpanded ? '<' : '>'}
      </button>
    </footer>
  )
}
```

- [ ] **Step 5: 跑测试确认绿**

Run: `npx vitest run src/components/BottomBar/index.test.tsx`
Expected: 全部通过。

- [ ] **Step 6: tsc 检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/BottomBar/
git commit -m "feat(bottom-bar): 新建底部状态栏 — 连接状态 + 带中文名工具 + 箭头展开/收起动画"
```

---

### Task 3: GlobalBar 瘦身 + App 接入 BottomBar（含测试与调试脚本）

**Files:**
- Modify: `frontend/src/components/GlobalBar/index.tsx`
- Modify: `frontend/src/components/GlobalBar/styles.css`
- Modify: `frontend/src/components/GlobalBar/index.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/repro-detach.cjs:24`

**Interfaces:**
- Consumes: `BottomBar({ perfVisible, onTogglePerf })`（Task 2 产出）；`TabBar`（`@/components/TabBar`）；`openFloatingTab`（`@/utils/openFloatingTab`）。
- Produces: `GlobalBar()` —— 无 props，仅渲染 `<TabBar onAddTab={openSettings} />`。App 布局变为 `.app` flex 列：GlobalBar → floating-overlay → tab-main → BottomBar → FloatingWindows。

- [ ] **Step 1: 先改 App.test 的失败测试（BottomBar 尚未接入 App 前先写断言）**

在 `frontend/src/App.test.tsx` 中做以下修改，然后运行应失败：

1. 把 `describe('全局栏（GlobalBar）')` 改为 `describe('底部状态栏（BottomBar）')`，保留「显示 MD/TD 连接状态」与「不渲染应用标题」两条用例（MD/TD 现来自 BottomBar，App 接入后依旧通过；未接入前失败）。
2. `性能监控` 块两条用例的 `global-bar-fps` testid 全部改为 `bottom-bar-fps`；「默认不渲染 ⚡FPS（已收敛进 ⋯ 更多菜单）」改为「默认不显示 FPS 徽标（FPS 监控按钮常驻）」：

```tsx
  describe('性能监控', () => {
    it('默认不显示 FPS 徽标（FPS 监控按钮常驻）', () => {
      render(<App />)
      expect(screen.getByLabelText('FPS 监控')).toBeInTheDocument()
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
    })

    it('Ctrl+Shift+M 切换性能监控（显示 FPS 徽标）', () => {
      render(<App />)
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
      fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
      expect(screen.getByTestId('bottom-bar-fps')).toBeInTheDocument()
    })
  })
```

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL（BottomBar 未接入，MD/TD 与 FPS 徽标不可见）。

- [ ] **Step 2: 重写 GlobalBar 组件（瘦身）**

将 `frontend/src/components/GlobalBar/index.tsx` 整体替换为：

```tsx
import { useCallback } from 'react'
import { TabBar } from '@/components/TabBar'
import { openFloatingTab } from '@/utils/openFloatingTab'
import './styles.css'

/**
 * GlobalBar — 全局顶栏（仅承载工作区标签）
 *
 * 原「连接状态 + 全局工具」已迁至底部状态栏 BottomBar。
 * 保留 + 新增标签入口（打开设置浮动窗）。
 */
export function GlobalBar() {
  // 新增标签入口：打开设置浮动窗（与 BottomBar 的 ⚙ 设置一致）
  const openSettings = useCallback(() => {
    openFloatingTab({ type: 'settings', title: '⚙ 设置' })
  }, [])

  return (
    <header className="global-bar">
      <TabBar onAddTab={openSettings} />
    </header>
  )
}
```

- [ ] **Step 3: 清理 GlobalBar 样式**

将 `frontend/src/components/GlobalBar/styles.css` 替换为：

```css
.global-bar {
  display: flex;
  align-items: center;
  height: 40px;
  padding-left: 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}

/* 中间标签区：占满剩余空间；覆盖 TabBar 自身高度/边框以融入全局栏 */
.global-bar .tab-bar {
  flex: 1;
  min-width: 0;
  height: 100%;
  border-bottom: none;
  background: transparent;
}
```

（原 `.global-bar__left` / `.global-bar__tools` / `.global-bar__tool` / `.global-bar__fps` / `.global-bar__more` / `.global-bar__menu*` 规则已迁至 BottomBar，全部删除。）

- [ ] **Step 4: 重写 GlobalBar 测试**

将 `frontend/src/components/GlobalBar/index.test.tsx` 整体替换为：

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalBar } from './index'
import { useTabStore } from '@/stores/tabs'

// Mock 统一浮动窗入口（GlobalBar 的 + 按钮打开设置浮动窗）
const { mockOpenFloatingTab } = vi.hoisted(() => ({
  mockOpenFloatingTab: vi.fn(),
}))

vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: mockOpenFloatingTab,
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
}))

// Mock TabBar（GlobalBar 只承载，行为由 TabBar 自身测试覆盖）
vi.mock('@/components/TabBar', () => ({
  TabBar: ({ onAddTab }: { onAddTab?: () => void }) => (
    <div data-testid="tab-bar">
      <span>TabBar Mock</span>
      <button data-testid="add-tab" onClick={onAddTab}>
        +
      </button>
    </div>
  ),
}))

describe('GlobalBar', () => {
  const defaultTabs = {
    tabs: [
      { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
    ],
    activeTabId: 'tab-market',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useTabStore.setState(defaultTabs)
  })

  it('渲染中间 TabBar', () => {
    render(<GlobalBar />)
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
  })

  it('不再渲染连接状态（已迁至 BottomBar）', () => {
    render(<GlobalBar />)
    expect(screen.queryByText('MD')).toBeNull()
    expect(screen.queryByText('TD')).toBeNull()
  })

  it('不再渲染工具按钮（已迁至 BottomBar）', () => {
    render(<GlobalBar />)
    expect(screen.queryByLabelText('报单')).toBeNull()
    expect(screen.queryByLabelText('K线')).toBeNull()
    expect(screen.queryByLabelText('设置')).toBeNull()
  })

  it('不渲染应用标题「SimNow 交易终端」', () => {
    render(<GlobalBar />)
    expect(screen.queryByText('SimNow 交易终端')).toBeNull()
  })

  it('点击 + 新增标签按钮打开设置浮动窗', () => {
    render(<GlobalBar />)
    fireEvent.click(screen.getByTestId('add-tab'))
    expect(mockOpenFloatingTab).toHaveBeenCalledWith({ type: 'settings', title: '⚙ 设置' })
  })
})
```

- [ ] **Step 5: 接入 App**

在 `frontend/src/App.tsx`：

1. 顶部 import 区新增 `import { BottomBar } from '@/components/BottomBar'`。
2. 将 `<GlobalBar perfVisible={perfVisible} onTogglePerf={() => setPerfVisible((v) => !v)} />` 替换为 `<GlobalBar />`。
3. 在 `</main>` 之后、`<FloatingWindows />` 之前插入：

```tsx
      {/* 底部状态栏：连接状态 + 全局工具（图标+中文名），箭头可收起/展开 */}
      <BottomBar
        perfVisible={perfVisible}
        onTogglePerf={() => setPerfVisible((v) => !v)}
      />
```

- [ ] **Step 6: 更新调试脚本选择器**

`frontend/repro-detach.cjs` 第 24 行：

```js
const gear = await page.$('.bottom-bar__tool[title="设置"]')  // 原 .global-bar__tool[title="设置"]
```

- [ ] **Step 7: 跑相关测试确认绿**

Run: `npx vitest run src/App.test.tsx src/components/GlobalBar/index.test.tsx src/components/BottomBar/index.test.tsx`
Expected: 全部通过。

- [ ] **Step 8: 全量前端测试 + 类型检查**

```bash
npx vitest run
npx tsc --noEmit
```
Expected: 全绿，无类型错误。

- [ ] **Step 9: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 10: 提交**

```bash
git add frontend/src/components/GlobalBar/ frontend/src/App.tsx frontend/src/App.test.tsx frontend/repro-detach.cjs
git commit -m "refactor(app): GlobalBar 瘦身为标签栏，连接状态+工具迁至底部 BottomBar；更新调试脚本选择器"
```

---

## Self-Review

**Spec coverage:**
- §1 组件结构与 App 布局 → Task 2（BottomBar）+ Task 3（GlobalBar 瘦身 + App 接入）
- §2 箭头展开/收起 + 动画 → Task 2 Step 4 组件内 `toolsExpanded` state + `bottom-bar__tools--collapsed` 类 + styles.css max-width/opacity transition
- §3 barToSide 进度条修复 → Task 1
- §4 测试清单 → Task 1（2 条表测试）、Task 2（BottomBar 测试）、Task 3（GlobalBar/App 测试）
- 工具按钮加中文名 → Task 2 每个按钮 `icon + label` 双 span
- 去掉 ⋯ 菜单、FPS/网络监控平铺 → Task 2 直接渲染 6 个按钮，无 moreOpen 状态
- `>`/`<` 箭头 → Task 2 toggle 按钮，展开 `<` / 收起 `>`
- 全局常驻 → Task 3 App 布局将 BottomBar 挂 `.app` flex 列尾部（所有标签页共用）

**Placeholder scan:** 无 TBD/TODO；所有步骤含完整代码。

**Type consistency:** `BottomBar` props `{ perfVisible: boolean; onTogglePerf: () => void }` 在 Task 2 定义、Task 3 App 使用一致；`GlobalBar()` 无 props，App 中改为 `<GlobalBar />` 一致；testid 契约（bottom-bar-tools / bottom-bar-toggle / bottom-bar-fps）三处一致。
