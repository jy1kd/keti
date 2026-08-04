import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from './index'
import { useTabStore } from '@/stores/tabs'

const { mockQueryOpen } = vi.hoisted(() => ({ mockQueryOpen: vi.fn() }))

// Mock 查询弹窗 store（TabBar 📋 按钮打开悬浮弹窗而非标签页）
vi.mock('@/modules/query/popupStore', () => ({
  useQueryPopupStore: {
    getState: () => ({ open: mockQueryOpen, close: vi.fn() }),
  },
}))

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
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      expect(screen.getByText('📊 行情')).toBeInTheDocument()
      expect(screen.getByText('📝 报单-au2406')).toBeInTheDocument()
      expect(screen.getByText('⚙ 设置')).toBeInTheDocument()
    })
  })

  // --- 标签切换 ---

  describe('标签切换', () => {
    it('点击标签应调用 setActiveTab', () => {
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
      fireEvent.click(screen.getByText('⚙ 设置'))
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('活跃标签应有 active 样式', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
      })
      render(<TabBar />)
      const queryTab = screen.getByText('⚙ 设置').closest('[role="tab"]')
      expect(queryTab).toHaveAttribute('aria-selected', 'true')
    })

    it('非活跃标签应有 aria-selected=false', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      const queryTab = screen.getByText('⚙ 设置').closest('[role="tab"]')
      expect(queryTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  // --- 关闭标签 ---

  describe('关闭标签', () => {
    it('可关闭标签应显示关闭按钮', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      const marketTab = screen.getByText('📊 行情').closest('[role="tab"]')
      expect(marketTab?.querySelector('[aria-label="关闭标签"]')).toBeNull()
      const queryTab = screen.getByText('⚙ 设置').closest('[role="tab"]')
      expect(queryTab?.querySelector('[aria-label="关闭标签"]')).toBeInTheDocument()
    })

    it('关闭按钮应为 button 元素（支持键盘操作）', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      const closeButton = screen.getByText('⚙ 设置').closest('[role="tab"]')?.querySelector('[aria-label="关闭标签"]')
      expect(closeButton?.tagName).toBe('BUTTON')
      expect(closeButton).toHaveAttribute('type', 'button')
    })

    it('点击关闭按钮应调用 closeTab', () => {
      const closeTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        closeTab,
      })
      render(<TabBar />)
      const closeButton = screen.getByText('⚙ 设置').closest('[role="tab"]')?.querySelector('[aria-label="关闭标签"]')
      fireEvent.click(closeButton!)
      expect(closeTab).toHaveBeenCalledWith('tab-settings')
    })

    it('关闭按钮不应冒泡触发标签切换', () => {
      const setActiveTab = vi.fn()
      const closeTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
        closeTab,
      })
      render(<TabBar />)
      const closeButton = screen.getByText('⚙ 设置').closest('[role="tab"]')?.querySelector('[aria-label="关闭标签"]')
      fireEvent.click(closeButton!)
      expect(closeTab).toHaveBeenCalledWith('tab-settings')
      expect(setActiveTab).not.toHaveBeenCalled()
    })
  })

  // --- 新增标签按钮 ---

  describe('新增标签按钮', () => {
    it('应显示 + 按钮', () => {
      render(<TabBar />)
      expect(screen.getByLabelText('新增标签')).toBeInTheDocument()
    })

    it('点击 + 按钮应调用 onAddTab', () => {
      const onAddTab = vi.fn()
      render(<TabBar onAddTab={onAddTab} />)
      fireEvent.click(screen.getByLabelText('新增标签'))
      expect(onAddTab).toHaveBeenCalledTimes(1)
    })
  })

  // --- 键盘导航 ---

  describe('键盘导航', () => {
    it('右箭头应切换到下一个标签', () => {
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
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('左箭头应切换到上一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-market')
    })

    it('右箭头在最后一个标签应循环到第一个', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-market')
    })

    it('Home 键应跳转到第一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-market')
    })

    it('End 键应跳转到最后一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('其他键不应触发切换', () => {
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
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' })
      expect(setActiveTab).not.toHaveBeenCalled()
    })
  })

  // --- 快捷按钮 ---

  describe('快捷按钮', () => {
    it('应显示 ⭐ 自选快捷按钮', () => {
      render(<TabBar />)
      expect(screen.getByLabelText('⭐ 自选')).toBeInTheDocument()
    })

    it('点击 ⭐ 按钮应打开自选标签页', () => {
      const openTab = vi.fn().mockReturnValue(true)
      useTabStore.setState({ openTab })
      render(<TabBar />)
      fireEvent.click(screen.getByLabelText('⭐ 自选'))
      expect(openTab).toHaveBeenCalledWith({
        type: 'favorites',
        title: '⭐ 自选',
        closable: true,
      })
    })

    it('自选标签已打开时，点击 ⭐ 应激活该标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-favorites', type: 'favorites', title: '⭐ 自选', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.click(screen.getByLabelText('⭐ 自选'))
      expect(setActiveTab).toHaveBeenCalledWith('tab-favorites')
    })

    it('应显示 📋 查询快捷按钮', () => {
      render(<TabBar />)
      expect(screen.getByLabelText('📋 查询')).toBeInTheDocument()
    })

    it('点击 📋 按钮应打开查询弹窗', () => {
      render(<TabBar />)
      fireEvent.click(screen.getByLabelText('📋 查询'))
      expect(mockQueryOpen).toHaveBeenCalled()
    })
  })

  // --- 无障碍 ---

  describe('无障碍', () => {
    it('容器应有 role="tablist"', () => {
      render(<TabBar />)
      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('容器应有 aria-label', () => {
      render(<TabBar />)
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', '标签栏')
    })

    it('每个标签应有 role="tab"', () => {
      render(<TabBar />)
      expect(screen.getAllByRole('tab')).toHaveLength(1)
    })

    it('活跃标签应有 aria-selected="true"', () => {
      render(<TabBar />)
      expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true')
    })

    it('标签应可聚焦（tabIndex=0）', () => {
      render(<TabBar />)
      expect(screen.getByRole('tab')).toHaveAttribute('tabindex', '0')
    })
  })
})
