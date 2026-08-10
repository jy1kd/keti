import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TabBar } from './index'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'

const detachMock = vi.hoisted(() => ({
  startDetachDrag: vi.fn(),
  detachTabAt: vi.fn(),
}))

vi.mock('@/utils/detachDrag', () => detachMock)

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

/** jsdom 24 无 PointerEvent 构造器；沿用 detachDrag.test 的 MouseEvent 方案保留 clientX/clientY/button */
function pointerDownOn(el: Element, init: MouseEventInit = {}): void {
  const ev = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  }) as unknown as PointerEvent
  fireEvent(el, ev)
}

describe('TabBar', () => {
  beforeEach(() => {
    detachMock.startDetachDrag.mockReset()
    detachMock.detachTabAt.mockReset()
    useFloatingWindowStore.setState({ windows: {} })
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
  })

  // --- + 新增标签选择栏 ---

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

    it('鼠标从 + 悬停区下移到菜单项不关闭选择栏（可到达并点击菜单项）', () => {
      // 回归：.tab-bar__add-menu 原留 4px 间隙，鼠标下移穿过间隙会触发 wrapper
      // mouseleave，导致选择栏在鼠标到达菜单项前关闭。此用例模拟「+ → 菜单项」的
      // 穿行路径，断言菜单在鼠标到达时仍打开、点击成功。
      const openTab = vi.fn(() => true)
      useTabStore.setState({ ...defaultState, openTab })
      render(<TabBar />)
      hoverOpen()
      // 鼠标下移进入菜单区（fix 后间隙并入悬停区，不再触发 wrapper mouseleave）
      fireEvent.mouseOver(screen.getByText('📝 报单'))
      expect(screen.getByText('📝 报单')).toBeInTheDocument()
      fireEvent.click(screen.getByText('📝 报单'))
      expect(openTab).toHaveBeenCalledWith({ type: 'order', title: '📝 报单' })
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

  // --- + 选择栏悬停可达性样式（回归） ---

  describe('+ 选择栏悬停可达性样式', () => {
    // jsdom 无法计算真实布局几何，故直接断言 CSS 源文件（同 KLinePage.style.test 模式）。
    it('.tab-bar__add-menu 必须与 + 悬停区无缝衔接（top:100%，无 4px 死区）', () => {
      const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf-8')
      const block = css.match(/\.tab-bar__add-menu\s*\{([^}]*)\}/)?.[1]
      expect(block).toBeTruthy()
      expect(block).toMatch(/top:\s*100%/)
      expect(block).not.toMatch(/\+ 4px/)
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
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
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
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings-2')
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

  // --- 拖拽脱离 ---

  describe('拖拽脱离', () => {
    it('可关闭标签按下时调用 startDetachDrag（pill ghost）', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      pointerDownOn(screen.getByText('⚙ 设置'), { clientX: 10, clientY: 10 })
      expect(detachMock.startDetachDrag).toHaveBeenCalledTimes(1)
      const params = detachMock.startDetachDrag.mock.calls[0][0]
      expect(params.ghostKind).toBe('pill')
      expect(params.canDetach()).toBe(true)
    })

    it('固定标签不调用 startDetachDrag', () => {
      render(<TabBar />)
      pointerDownOn(screen.getByText('📊 行情'), { clientX: 10, clientY: 10 })
      expect(detachMock.startDetachDrag).not.toHaveBeenCalled()
    })

    it('拖离后抑制随后的 click（不切换标签）', () => {
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
      pointerDownOn(screen.getByText('⚙ 设置'), { clientX: 10, clientY: 10 })
      const params = detachMock.startDetachDrag.mock.calls[0][0]
      params.onDetaching?.() // 模拟拖拽超阈值
      fireEvent.click(screen.getByText('⚙ 设置'))
      expect(setActiveTab).not.toHaveBeenCalled()
      // 下一次正常点击应恢复
      fireEvent.click(screen.getByText('⚙ 设置'))
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('浮动标签应从标签栏隐藏', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      useFloatingWindowStore.setState({
        windows: { 'tab-settings': { x: 0, y: 0, w: 400, h: 300, z: 1401 } },
      })
      render(<TabBar />)
      expect(screen.queryByText('⚙ 设置')).toBeNull()
      expect(screen.getByText('📊 行情')).toBeInTheDocument()
    })
  })
})
