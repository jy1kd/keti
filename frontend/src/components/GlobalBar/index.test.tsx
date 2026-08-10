import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalBar } from './index'
import { useTabStore } from '@/stores/tabs'
import { useConnectionStore } from '@/stores/connection'
import { useMarketStore } from '@/modules/market/store'

// Mock 统一浮动窗入口（GlobalBar 工具入口委托给 helper；helper 自身的打开选项在
// utils/openFloatingTab.test.ts 覆盖，此处只验证按钮→helper 的接线）
const {
  mockOpenFloatingTab,
  mockOpenOrderFloating,
  mockOpenKlineFloating,
  mockOpenQueryFloating,
  mockOpenSettingsFloating,
  mockOpenIpcMonitorFloating,
} = vi.hoisted(() => ({
  mockOpenFloatingTab: vi.fn(),
  mockOpenOrderFloating: vi.fn(),
  mockOpenKlineFloating: vi.fn(),
  mockOpenQueryFloating: vi.fn(),
  mockOpenSettingsFloating: vi.fn(),
  mockOpenIpcMonitorFloating: vi.fn(),
}))

vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: mockOpenFloatingTab,
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
  openOrderFloating: mockOpenOrderFloating,
  openKlineFloating: mockOpenKlineFloating,
  openQueryFloating: mockOpenQueryFloating,
  openSettingsFloating: mockOpenSettingsFloating,
  openIpcMonitorFloating: mockOpenIpcMonitorFloating,
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

// rAF stub（PerfMonitor visible=true 时使用）
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

describe('GlobalBar', () => {
  const defaultTabs = {
    tabs: [
      { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
    ],
    activeTabId: 'tab-market',
  }

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
    useTabStore.setState(defaultTabs)
    // 默认无选中合约；个别用例显式设置
    useMarketStore.setState({ selectedInstrument: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('布局', () => {
    it('渲染左区连接状态（MD/TD 指示灯）', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('渲染中间 TabBar', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    })

    it('不渲染应用标题「SimNow 交易终端」', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.queryByText('SimNow 交易终端')).toBeNull()
    })
  })

  describe('全局工具区', () => {
    it('渲染 📝 报单与 📈 K线按钮', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByLabelText('报单')).toBeInTheDocument()
      expect(screen.getByLabelText('K线')).toBeInTheDocument()
    })

    it('点击 📝 报单调用 openOrderFloating（选中合约细节由 helper 测试覆盖）', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('报单'))
      expect(mockOpenOrderFloating).toHaveBeenCalled()
    })

    it('点击 📈 K线调用 openKlineFloating', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('K线'))
      expect(mockOpenKlineFloating).toHaveBeenCalled()
    })

    it('渲染 📋 查询按钮', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByLabelText('📋 查询')).toBeInTheDocument()
    })

    it('点击 📋 查询按钮调用 openQueryFloating', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('📋 查询'))
      expect(mockOpenQueryFloating).toHaveBeenCalled()
    })

    it('渲染 ⚙ 设置按钮', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByTitle('设置')).toBeInTheDocument()
    })

    it('点击 ⚙ 设置按钮调用 openSettingsFloating', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByTitle('设置'))
      expect(mockOpenSettingsFloating).toHaveBeenCalled()
    })

    it('渲染 ⋯ 更多按钮', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.getByLabelText('更多')).toBeInTheDocument()
    })
  })

  describe('⋯ 更多菜单', () => {
    it('默认收起：不显示菜单项', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.queryByRole('menuitem')).toBeNull()
    })

    it('点击 ⋯ 展开菜单，显示 ⚡FPS 与 🔌网络监控', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('更多'))
      expect(screen.getByText('⚡FPS 监控')).toBeInTheDocument()
      expect(screen.getByText('🔌 网络监控')).toBeInTheDocument()
    })

    it('点击 ⚡FPS 监控项调用 onTogglePerf', () => {
      const onTogglePerf = vi.fn()
      render(<GlobalBar perfVisible={false} onTogglePerf={onTogglePerf} />)
      fireEvent.click(screen.getByLabelText('更多'))
      fireEvent.click(screen.getByText('⚡FPS 监控'))
      expect(onTogglePerf).toHaveBeenCalled()
    })

    it('点击 🔌网络监控项调用 openIpcMonitorFloating', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('更多'))
      fireEvent.click(screen.getByText('🔌 网络监控'))
      expect(mockOpenIpcMonitorFloating).toHaveBeenCalled()
    })

    it('按 Escape 关闭菜单', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('更多'))
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('menuitem')).toBeNull()
    })

    it('点击菜单外部（body）关闭菜单', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('更多'))
      expect(screen.getByText('⚡FPS 监控')).toBeInTheDocument()
      fireEvent.click(document.body)
      expect(screen.queryByText('⚡FPS 监控')).toBeNull()
    })

    it('点击菜单项后菜单关闭', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      fireEvent.click(screen.getByLabelText('更多'))
      fireEvent.click(screen.getByText('🔌 网络监控'))
      expect(screen.queryByRole('menuitem')).toBeNull()
    })
  })

  describe('性能监控', () => {
    it('perfVisible=false 时不显示 FPS 徽标', () => {
      render(<GlobalBar perfVisible={false} onTogglePerf={vi.fn()} />)
      expect(screen.queryByTestId('global-bar-fps')).toBeNull()
    })

    it('perfVisible=true 时显示 FPS 徽标', () => {
      render(<GlobalBar perfVisible={true} onTogglePerf={vi.fn()} />)
      expect(screen.getByTestId('global-bar-fps')).toBeInTheDocument()
    })
  })
})
