import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TabBar } from './index'
import { useTabStore, type Tab } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useMarketStore } from '@/modules/market/store'

const detachMock = vi.hoisted(() => ({
  startDetachDrag: vi.fn(),
  detachTabAt: vi.fn(),
}))

vi.mock('@/utils/detachDrag', () => detachMock)

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
    useMarketStore.setState({ selectedInstrument: null })
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

  // --- 固定标签置顶按钮 ---

  describe('固定标签置顶按钮', () => {
    it('固定标签显示 📌 取消固定按钮，不显示 × 关闭按钮；点击调用 togglePin', () => {
      const togglePin = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-pinned', type: 'kline', title: '📈 K线', props: {}, closable: true, pinned: true },
        ],
        activeTabId: 'tab-market',
        togglePin,
      })
      render(<TabBar />)
      const tabEl = screen.getByText('📈 K线').closest('[role="tab"]')!
      const pinBtn = tabEl.querySelector('[aria-label="取消固定"]')
      expect(pinBtn).toBeInTheDocument()
      expect(pinBtn?.textContent).toContain('📌')
      expect(tabEl.querySelector('[aria-label="关闭标签"]')).toBeNull()
      fireEvent.click(pinBtn!)
      expect(togglePin).toHaveBeenCalledWith('tab-pinned')
    })

    it('未固定可关闭标签仍显示 × 关闭按钮，不显示 📌 置顶按钮', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-unpinned', type: 'kline', title: '📈 K线', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      render(<TabBar />)
      const tabEl = screen.getByText('📈 K线').closest('[role="tab"]')!
      expect(tabEl.querySelector('[aria-label="关闭标签"]')).toBeInTheDocument()
      expect(tabEl.querySelector('[aria-label="取消固定"]')).toBeNull()
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

    it('选中合约时点击「📝 报单」带 instrumentID 打开（标题含合约代码）', () => {
      const openTab = vi.fn(() => true)
      useTabStore.setState({ ...defaultState, openTab })
      useMarketStore.setState({ selectedInstrument: 'IF2608' })
      render(<TabBar />)
      hoverOpen()
      fireEvent.click(screen.getByText('📝 报单'))
      expect(openTab).toHaveBeenCalledWith({
        type: 'order',
        title: '📝 报单-IF2608',
        props: { instrumentID: 'IF2608' },
      })
    })

    it('选中合约时点击「📈 K线」带 instrumentID 打开（标题含合约代码）', () => {
      const openTab = vi.fn(() => true)
      useTabStore.setState({ ...defaultState, openTab })
      useMarketStore.setState({ selectedInstrument: 'IF2608' })
      render(<TabBar />)
      hoverOpen()
      fireEvent.click(screen.getByText('📈 K线'))
      expect(openTab).toHaveBeenCalledWith({
        type: 'kline',
        title: '📈 K线-IF2608',
        props: { instrumentID: 'IF2608' },
      })
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
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings-2')
    })

    it('左箭头应切换到上一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings-2',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('右箭头在最后一个标签应循环到第一个', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings-2',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('Home 键应跳转到第一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings-2',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' })
      expect(setActiveTab).toHaveBeenCalledWith('tab-settings')
    })

    it('End 键应跳转到最后一个标签', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-settings',
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
        activeTabId: 'tab-settings',
        setActiveTab,
      })
      render(<TabBar />)
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' })
      expect(setActiveTab).not.toHaveBeenCalled()
    })

    it('活跃标签为行情标签时方向键/Home/End 不切换（行情标签不参与方向键切换）', () => {
      const setActiveTab = vi.fn()
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-settings', type: 'settings', title: '⚙ 设置', props: {}, closable: true },
          { id: 'tab-settings-2', type: 'settings', title: '⚙ 设置 2', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
        setActiveTab,
      })
      render(<TabBar />)
      // 行情标签不在 scrollTabs 中，findIndex 返回 -1，方向键/Home/End 均 no-op
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' })
      fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
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

  // --- 标签溢出（▾ 下拉） ---

  describe('标签溢出（▾ 下拉）', () => {
    /** 渲染 N 个等宽标签，mock offsetWidth/clientWidth，触发 ResizeObserver 重算 */
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
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          ...Array.from({ length: 8 }, (_, i) => ({
            id: `tab-${i + 1}`,
            type: 'settings' as const,
            title: `标签 ${i + 1}`,
            props: {},
            closable: true,
          })),
        ],
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

    it('▾ 菜单项不重复显示图标（title 已含 emoji 前缀）', () => {
      useTabStore.setState({
        tabs: [
          { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
          { id: 'tab-1', type: 'settings', title: '标签 1', props: {}, closable: true },
          { id: 'tab-2', type: 'settings', title: '标签 2', props: {}, closable: true },
          { id: 'tab-3', type: 'settings', title: '标签 3', props: {}, closable: true },
          { id: 'tab-4', type: 'settings', title: '标签 4', props: {}, closable: true },
          { id: 'tab-5', type: 'settings', title: '标签 5', props: {}, closable: true },
          { id: 'tab-6', type: 'settings', title: '标签 6', props: {}, closable: true },
          { id: 'tab-order-au', type: 'order', title: '📝 报单-IF2608', props: {}, closable: true },
        ],
        activeTabId: 'tab-market',
      })
      const { container } = render(<TabBar />)
      const scrollEl = container.querySelector('.tab-bar__scroll') as HTMLElement
      Object.defineProperty(scrollEl, 'clientWidth', { value: 300, configurable: true })
      scrollEl.querySelectorAll('[role="tab"]').forEach((el) => {
        Object.defineProperty(el, 'offsetWidth', { value: 100, configurable: true })
      })
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      fireEvent.click(screen.getByLabelText('溢出标签'))
      const menu = screen.getByRole('menu', { name: '隐藏标签' })
      const item = within(menu).getByRole('menuitem', { name: /报单/ })
      // title 已含 emoji，不应再渲染独立 icon span（否则 📝 出现两次）
      expect(item.querySelector('.tab-bar__overflow-icon')).toBeNull()
      expect(item.textContent).toContain('📝 报单-IF2608')
    })

    it('隐藏标签在标签栏完全隐藏（visibility:hidden，不露半截）；可见标签自动填充至 ▾ 左侧', () => {
      const { container } = renderManyTabs(8, 300, 100)
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      const tabEls = Array.from(container.querySelectorAll('.tab-bar__scroll [role="tab"]'))
      // 8 个等宽 100、容器 300、maxScroll=200 → 右缘>500 的索引 5,6,7 隐藏
      expect(tabEls[5]).toHaveClass('tab-bar__tab--hidden')
      expect(tabEls[7]).toHaveClass('tab-bar__tab--hidden')
      expect(tabEls[0]).not.toHaveClass('tab-bar__tab--hidden')
      // 可见标签填充（flex grow）到 ▾ 左侧，隐藏标签不 grow（也不占位）
      expect(tabEls[0]).toHaveClass('tab-bar__tab--grow')
      expect(tabEls[5]).not.toHaveClass('tab-bar__tab--grow')
    })

    it('滚轮横滚 clamp 到 MAX_SCROLL（2×平均宽），不越界；溢出时 preventDefault', () => {
      const { container, scrollEl } = renderManyTabs(6, 300, 100)
      Object.defineProperty(scrollEl, 'scrollLeft', { value: 0, writable: true, configurable: true })
      act(() => { roCallback?.([], null as unknown as ResizeObserver) })
      const scrollNode = container.querySelector('.tab-bar__scroll')!
      // 下滚（deltaY 正）→ 向右；maxScroll=200
      const evDown = new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true })
      fireEvent(scrollNode, evDown)
      expect(evDown.defaultPrevented).toBe(true)
      expect(scrollEl.scrollLeft).toBe(200)
      // 上滚（deltaY 负）→ 回左，不为负
      const evUp = new WheelEvent('wheel', { deltaY: -1000, bubbles: true, cancelable: true })
      fireEvent(scrollNode, evUp)
      expect(evUp.defaultPrevented).toBe(true)
      expect(scrollEl.scrollLeft).toBe(0)
    })
  })

  // --- 行情标签固定左侧 ---

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

  // --- 固定标签排序 ---

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

  // --- 右键菜单 ---

  describe('右键菜单', () => {
    const ctxTabs: Tab[] = [
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
})
