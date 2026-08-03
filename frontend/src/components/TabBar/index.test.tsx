import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from './index'
import { useTabStore } from '@/stores/tabs'

// Mock useTabStore
const defaultState = {
  tabs: [
    { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
  ],
  activeTabId: 'tab-market',
  openTab: () => true,
  closeTab: () => {},
  setActiveTab: () => {},
  getTabByType: () => undefined,
}

describe('TabBar', () => {
  beforeEach(() => {
    useTabStore.setState(defaultState)
  })

  // --- 渲染 ---

  describe('渲染', () => {
    it('应渲染标签栏容器', () => {
      render(<TabBar />)
      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('应显示默认的行情标签', () => {
      render(<TabBar />)
      expect(screen.getByText('📊 行情')).toBeInTheDocument()
    })

    it('应显示多个标签', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-order-au2406', type: 'order', title: '📝 报单-au2406', props: { instrumentID: 'au2406' }, closable: true },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      expect(screen.getByText('📊 行情')).toBeInTheDocument()
      expect(screen.getByText('📝 报单-au2406')).toBeInTheDocument()
      expect(screen.getByText('📋 查询')).toBeInTheDocument()
    })
  })

  // --- 标签切换 ---

  describe('标签切换', () => {
    it('点击标签应调用 setActiveTab', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.click(screen.getByText('📋 查询'))
      expect(setActiveTab).toHaveBeenCalledWith('tab-query')
    })

    it('活跃标签应有 active 样式', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-query',
      })
      render(<TabBar />)
      const queryTab = screen.getByText('📋 查询').closest('[role="tab"]')
      expect(queryTab).toHaveAttribute('aria-selected', 'true')
    })

    it('非活跃标签应有 aria-selected=false', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      const queryTab = screen.getByText('📋 查询').closest('[role="tab"]')
      expect(queryTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  // --- 关闭标签 ---

  describe('关闭标签', () => {
    it('可关闭标签应显示关闭按钮', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      // 行情标签没有关闭按钮
      const marketTab = screen.getByText('📊 行情').closest('[role="tab"]')
      expect(marketTab?.querySelector('[aria-label="关闭标签"]')).toBeNull()
      // 查询标签有关闭按钮
      const queryTab = screen.getByText('📋 查询').closest('[role="tab"]')
      expect(queryTab?.querySelector('[aria-label="关闭标签"]')).toBeInTheDocument()
    })

    it('点击关闭按钮应调用 closeTab', () => {
      const closeTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        closeTab,
      })
      render(<TabBar />)
      const closeButton = screen.getByText('📋 查询').closest('[role="tab"]')?.querySelector('[aria-label="关闭标签"]')
      fireEvent.click(closeButton!)
      expect(closeTab).toHaveBeenCalledWith('tab-query')
    })

    it('关闭按钮不应冒泡触发标签切换', () => {
      const setActiveTab = vi.fn()
      const closeTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-query', type: 'query', title: '📋 查询', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
        closeTab,
      })
      render(<TabBar />)
      const closeButton = screen.getByText('📋 查询').closest('[role="tab"]')?.querySelector('[aria-label="关闭标签"]')
      fireEvent.click(closeButton!)
      expect(closeTab).toHaveBeenCalledWith('tab-query')
      expect(setActiveTab).not.toHaveBeenCalled()
    })
  })

  // --- 新增标签按钮 ---

  describe('新增标签按钮', () => {
    it('应显示 + 按钮', () => {
      render(<TabBar />)
      expect(screen.getByLabelText('新增标签')).toBeInTheDocument()
    })
  })

  // --- 无障碍 ---

  describe('无障碍', () => {
    it('容器应有 role="tablist"', () => {
      render(<TabBar />)
      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('每个标签应有 role="tab"', () => {
      render(<TabBar />)
      expect(screen.getAllByRole('tab')).toHaveLength(1)
    })

    it('活跃标签应有 aria-selected="true"', () => {
      render(<TabBar />)
      expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true')
    })
  })
})
