import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabContent } from './index'
import { useTabStore, type Tab, type TabType } from '@/stores/tabs'

// Mock MarketPanel 组件（避免依赖复杂子组件）
vi.mock('@/modules/market/MarketPanel', () => ({
  MarketPanel: () => <div data-testid="market-panel">行情面板 Mock</div>,
}))

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
const ORDER_TAB = makeTab({ type: 'order', title: '📝 报单', props: { instrumentID: 'IF2608' } })
const QUERY_TAB = makeTab({ type: 'query', title: '📋 查询' })

/** 获取所有面板（包括隐藏的） */
function getAllPanels() {
  return screen.getAllByRole('tabpanel', { hidden: true })
}

// --- 测试 ---

describe('TabContent', () => {
  beforeEach(() => {
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
        tabs: [MARKET_TAB, ORDER_TAB, QUERY_TAB],
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
        tabs: [MARKET_TAB, QUERY_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[0]).toHaveAttribute('aria-hidden', 'false')
      expect(panels[0]).toHaveStyle({ display: 'block' })
    })

    it('非活跃标签面板应隐藏（display:none）', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, QUERY_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[1]).toHaveAttribute('aria-hidden', 'true')
      expect(panels[1]).toHaveStyle({ display: 'none' })
    })

    it('切换标签后，新活跃标签应可见', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, QUERY_TAB],
        activeTabId: MARKET_TAB.id,
      })
      const { rerender } = render(<TabContent />)
      // 切换到查询标签
      useTabStore.getState().setActiveTab(QUERY_TAB.id)
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
      ['order', '报单标签页'],
      ['query', '查询标签页'],
      ['kline', 'K线标签页'],
      ['favorites', '⭐ 自选合约'],
      ['settings', '⚙ 设置'],
      ['options', '期权标签页'],
      ['ipc-monitor', 'IPC监控标签页'],
    ])('应为 %s 类型渲染对应内容', (type, expectedText) => {
      const tab = makeTab({ type })
      useTabStore.setState({
        tabs: [tab],
        activeTabId: tab.id,
      })
      render(<TabContent />)
      expect(screen.getByText(new RegExp(expectedText))).toBeInTheDocument()
    })
  })

  // --- 状态保持 ---

  describe('状态保持', () => {
    it('切换标签后切回，面板应保持', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, QUERY_TAB],
        activeTabId: MARKET_TAB.id,
      })
      const { rerender } = render(<TabContent />)
      // 切换到查询再切回行情
      useTabStore.getState().setActiveTab(QUERY_TAB.id)
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
        tabs: [MARKET_TAB, QUERY_TAB],
        activeTabId: MARKET_TAB.id,
      })
      render(<TabContent />)
      const panels = getAllPanels()
      expect(panels[0]).toHaveAttribute('aria-hidden', 'false')
    })

    it('非活跃面板应有 aria-hidden=true', () => {
      useTabStore.setState({
        tabs: [MARKET_TAB, QUERY_TAB],
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
})
