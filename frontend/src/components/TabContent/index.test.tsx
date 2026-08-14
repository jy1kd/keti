import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabContent } from './index'
import { useTabStore, type Tab, type TabType } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

// Mock MarketPanel 组件（避免依赖复杂子组件）
vi.mock('@/modules/market/MarketPanel', () => ({
  MarketPanel: () => <div data-testid="market-panel">行情面板 Mock</div>,
}))

// Mock AccountQuery 组件（避免依赖复杂子组件）
vi.mock('@/modules/query/AccountQuery', () => ({
  AccountQuery: () => <div data-testid="account-query">资金查询 Mock</div>,
}))

vi.mock('@/modules/query/OrdersQuery', () => ({
  OrdersQuery: () => <div data-testid="orders-query">报单查询 Mock</div>,
}))

vi.mock('@/modules/query/PositionsQuery', () => ({
  PositionsQuery: () => <div data-testid="positions-query">持仓查询 Mock</div>,
}))

// Mock OrderPage 组件（避免依赖 stores）
vi.mock('@/pages/OrderPage', () => ({
  OrderPage: ({ instrumentID }: { instrumentID?: string }) => (
    <div data-testid="order-page">
      报单页面 Mock
      {instrumentID && <span>合约: {instrumentID}</span>}
    </div>
  ),
}))

// Mock KLinePage 组件（避免依赖 stores）
vi.mock('@/pages/KLinePage', () => ({
  KLinePage: ({ instrumentID }: { instrumentID?: string }) => (
    <div data-testid="kline-page">
      K线页面 Mock
      {instrumentID && <span>合约: {instrumentID}</span>}
    </div>
  ),
}))

// Mock TQuoteView 组件（T型报价独立悬浮标签；断言收到 instrumentID + tabId prop）
vi.mock('@/modules/options/TQuoteView', () => ({
  TQuoteView: ({ instrumentID, tabId }: { instrumentID?: string; tabId?: string }) => (
    <div data-testid="tquote-view">
      T型报价 Mock
      {instrumentID && <span>标的: {instrumentID}</span>}
      {tabId && <span data-testid="tquote-tabid">{tabId}</span>}
    </div>
  ),
}))

// Mock detachDrag 工具（Task 5 拖拽脱离）
const detachMock = vi.hoisted(() => ({ startDetachDrag: vi.fn(), detachTabAt: vi.fn() }))
vi.mock('@/utils/detachDrag', () => detachMock)

// --- 辅助函数 ---

function makeTab(overrides: Partial<Tab> & { type: TabType }): Tab {
  return {
    id: `tab-${overrides.type}`,
    title: overrides.type,
    props: {},
    closable: true,
    ...overrides,
  }
}

const MARKET_TAB = makeTab({ type: 'market', title: '📊 行情', closable: false })
const ORDER_TAB = makeTab({ type: 'order', title: '📝 五档下单', props: { instrumentID: 'IF2608' } })
const SETTINGS_TAB = makeTab({ type: 'settings', title: '⚙ 设置' })

/** 获取所有面板（包括隐藏的） */
function getAllPanels() {
  return screen.getAllByRole('tabpanel', { hidden: true })
}

/** jsdom 24 不提供 PointerEvent 构造器；用 MouseEvent 保留 clientX/clientY/button */
function pointerEvent(type: string, init: MouseEventInit): PointerEvent {
  return new MouseEvent(type, init) as unknown as PointerEvent
}

// --- 测试 ---

describe('TabContent', () => {
  beforeEach(() => {
    detachMock.startDetachDrag.mockReset()
    useFloatingWindowStore.setState({ windows: {} })
    useTabStore.setState({
      tabs: [MARKET_TAB],
      activeTabId: MARKET_TAB.id,
    })
  })

  // --- 渲染 ---

  describe('渲染', () => {
    it('应渲染容器元素', () => {
      render(<TabContent />)
      expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    })

    it('活跃标签应有 role="tabpanel"', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panel = screen.getByRole('tabpanel')
      expect(panel).toBeInTheDocument()
    })

    it('应为每个标签渲染面板', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, ORDER_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      expect(getAllPanels()).toHaveLength(3)
    })
  })

  // --- 活跃标签可见性 ---

  describe('活跃标签可见性', () => {
    it('活跃标签面板应可见', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[0]).toHaveAttribute('aria-hidden', 'false')
      expect(panels[0]).toHaveStyle({ display: 'block' })
    })

    it('非活跃标签面板应隐藏（display:none）', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[1]).toHaveAttribute('aria-hidden', 'true')
      expect(panels[1]).toHaveStyle({ display: 'none' })
    })

    it('切换标签后，新活跃标签应可见', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      const { rerender } = render(<TabContent />)
      // 切换到查询标签
      useTabStore.getState().setActiveTab(SETTINGS_TAB.id)
      rerender(<TabContent />)
      const panels = getAllPanels()
      expect(panels[0]).toHaveAttribute('aria-hidden', 'true')
      expect(panels[0]).toHaveStyle({ display: 'none' })
      expect(panels[1]).toHaveAttribute('aria-hidden', 'false')
      expect(panels[1]).toHaveStyle({ display: 'block' })
    })
  })

  // --- 标签类型渲染 ---

  describe('标签类型渲染', () => {
    it.each<[TabType, string]>([
      ['market', '行情面板'],
      ['order', '报单页面'],
      ['kline', 'K线页面'],
      ['settings', '⚙ 设置'],
      ['options', '自选'],
      ['ipc-monitor', '🔌 IPC 监控'],
      ['query-account', '资金查询 Mock'],
      ['query-orders', '报单查询'],
      ['query-positions', '持仓查询'],
    ])('应为 %s 类型渲染对应内容', (type, expectedText) => {
      const tab = makeTab({ type })
      useTabStore.setState({
        tabs: [tab],
        activeTabId: tab.id,
      })
      render(<TabContent />)
      expect(screen.getByText(new RegExp(expectedText))).toBeInTheDocument()
    })

    // tquote：独立悬浮标签页渲染 TQuoteView，且 props.instrumentID + tab.id 透传
    it('应为 tquote 类型渲染 TQuoteView，并透传 props.instrumentID 与 tabId', () => {
      const tab = makeTab({ type: 'tquote', id: 'tab-tquote-IF2608', props: { instrumentID: 'IF2608' } })
      useTabStore.setState({
        tabs: [tab],
        activeTabId: tab.id,
      })
      render(<TabContent />)
      expect(screen.getByTestId('tquote-view')).toBeInTheDocument()
      expect(screen.getByText(/标的: IF2608/)).toBeInTheDocument()
      // tabId 透传 → TQuoteView 窗内切标底可同步该标签的标题/props
      expect(screen.getByTestId('tquote-tabid').textContent).toBe('tab-tquote-IF2608')
    })

    it('tquote 空白标签（无 instrumentID）渲染 TQuoteView 不带预选', () => {
      const tab = makeTab({ type: 'tquote', id: 'tab-tquote' })
      useTabStore.setState({
        tabs: [tab],
        activeTabId: tab.id,
      })
      render(<TabContent />)
      expect(screen.getByTestId('tquote-view')).toBeInTheDocument()
      expect(screen.queryByText(/标的:/)).toBeNull()
    })

    // 审查 🔵-2：自选页标题已删除，改用稳定的 data-testid 断言页面渲染
    it('应为 favorites 类型渲染自选页', () => {
      const tab = makeTab({ type: 'favorites' })
      useTabStore.setState({
        tabs: [tab],
        activeTabId: tab.id,
      })
      render(<TabContent />)
      expect(screen.getByTestId('favorites-page')).toBeInTheDocument()
    })
  })

  // --- 状态保持 ---

  describe('状态保持', () => {
    it('切换标签后切回，面板应保持', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      const { rerender } = render(<TabContent />)
      // 切换到查询再切回行情
      useTabStore.getState().setActiveTab(SETTINGS_TAB.id)
      rerender(<TabContent />)
      useTabStore.getState().setActiveTab(MARKET_TAB.id)
      rerender(<TabContent />)
      // 行情面板应仍然存在且可见
      const panels = getAllPanels()
      expect(panels).toHaveLength(2)
      expect(panels[0]).toHaveAttribute('aria-hidden', 'false')
      expect(panels[0]).toHaveStyle({ display: 'block' })
    })
  })

  // --- 无障碍 ---

  describe('无障碍', () => {
    it('活跃面板应有 aria-hidden=false', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[0]).toHaveAttribute('aria-hidden', 'false')
    })

    it('非活跃面板应有 aria-hidden=true', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[1]).toHaveAttribute('aria-hidden', 'true')
    })

    it('面板应通过 aria-labelledby 关联标签', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panel = screen.getByRole('tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', MARKET_TAB.id)
    })
  })

  // --- 页面标题栏拖拽委托 ---

  describe('页面标题栏拖拽委托', () => {
    it('命中 [data-drag-handle] 且可关闭时调用 startDetachDrag（content ghost）', () => {
      useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
      render(<TabContent />)
      const panel = getAllPanels()[1] // [market, settings]
      const handle = document.createElement('div')
      handle.setAttribute('data-drag-handle', '')
      panel.appendChild(handle)
      fireEvent(handle, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }))
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
      fireEvent(btn, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }))
      expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
    })

    it('固定标签（market）不调用 startDetachDrag', () => {
      render(<TabContent />)
      const panel = getAllPanels()[0]
      const handle = document.createElement('div')
      handle.setAttribute('data-drag-handle', '')
      panel.appendChild(handle)
      fireEvent(handle, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }))
      expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
    })

    it('非 [data-drag-handle] 区域不调用 startDetachDrag', () => {
      useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
      render(<TabContent />)
      const panel = getAllPanels()[1]
      fireEvent(panel, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }))
      expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
    })

    it('右键命中 [data-drag-handle] 不调用 startDetachDrag', () => {
      useTabStore.setState({ tabs: [MARKET_TAB, SETTINGS_TAB], activeTabId: MARKET_TAB.id })
      render(<TabContent />)
      const panel = getAllPanels()[1]
      const handle = document.createElement('div')
      handle.setAttribute('data-drag-handle', '')
      panel.appendChild(handle)
      // pointerdown with button: 2 (right button)
      fireEvent(handle, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 2, bubbles: true }))
      expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
    })
  })
})

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

  it('浮动标签面板 portal 到顶层 #floating-overlay（脱离 .tab-content 布局）', () => {
    const overlay = document.createElement('div')
    overlay.id = 'floating-overlay'
    document.body.appendChild(overlay)
    try {
      useTabStore.setState({
        tabs: [MARKET_TAB, SETTINGS_TAB],
        activeTabId: MARKET_TAB.id,
      })
      useFloatingWindowStore.setState({
        windows: { 'tab-settings': { x: 10, y: 20, w: 400, h: 300, z: 1401 } },
      })
      render(<TabContent />)
      // 浮动面板应渲染在 overlay 内，并保留浮动样式
      const panel = overlay.querySelector('[role="tabpanel"]')
      expect(panel).not.toBeNull()
      expect(panel).toHaveClass('tab-content__panel--floating')
      expect(panel).toHaveStyle({ position: 'fixed', left: '10px', top: '52px', width: '400px', height: '268px' })
      // .tab-content 内不应再包含浮动面板（只有 market）
      const contentPanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
      expect(contentPanels).toHaveLength(1)
      expect(contentPanels[0]).not.toHaveClass('tab-content__panel--floating')
    } finally {
      overlay.remove()
    }
  })

  it('浮动面板捕获阶段置顶：子元素 stopPropagation 也触发 focus', () => {
    useTabStore.setState({
      tabs: [MARKET_TAB, SETTINGS_TAB],
      activeTabId: MARKET_TAB.id,
    })
    // 用 detach 建立浮动窗口（z 与模块级 zCounter 同步，focus 后严格递增）
    useFloatingWindowStore.setState({ windows: {} })
    useFloatingWindowStore.getState().detach('tab-settings', { x: 10, y: 20, w: 400, h: 300 })
    render(<TabContent />)
    const before = useFloatingWindowStore.getState().windows['tab-settings'].z
    const panel = getAllPanels().find((p) => p.classList.contains('tab-content__panel--floating'))!
    // 子元素在冒泡阶段 stopPropagation：捕获阶段 handler 仍应触发 focus
    const child = document.createElement('div')
    child.addEventListener('pointerdown', (e) => e.stopPropagation())
    panel.appendChild(child)
    fireEvent(child, pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }))
    const after = useFloatingWindowStore.getState().windows['tab-settings'].z
    expect(after).toBe(before + 1)
  })

  it('兜底：活跃标签已浮动时主窗口回退显示行情标签页（不空白）', () => {
    // 模拟「活跃标签 = 已浮动的标签」的状态（正常路径 detachTabAt 会切回 market，
    // 此用例验证渲染层兜底——任何路径漏切时主窗口仍显示行情，不空白）。
    useTabStore.setState({
      tabs: [MARKET_TAB, SETTINGS_TAB],
      activeTabId: SETTINGS_TAB.id,
    })
    const overlay = document.createElement('div')
    overlay.id = 'floating-overlay'
    document.body.appendChild(overlay)
    try {
      useFloatingWindowStore.setState({
        windows: { 'tab-settings': { x: 10, y: 20, w: 400, h: 300, z: 1401 } },
      })
      render(<TabContent />)
      // 主窗口内容区应显示行情面板（回退），而非空白
      const contentPanels = document.querySelectorAll('.tab-content [role="tabpanel"]')
      const visible = Array.from(contentPanels).filter((p) => (p as HTMLElement).style.display !== 'none')
      expect(visible).toHaveLength(1)
      expect(contentPanels[0]).toHaveAttribute('aria-hidden', 'false')
      // 设置面板已 portal 到 overlay
      const overlayPanels = overlay.querySelectorAll('[role="tabpanel"]')
      expect(overlayPanels).toHaveLength(1)
    } finally {
      overlay.remove()
    }
  })
})
