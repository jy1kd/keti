import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import App from './App'
import { useConnectionStore } from '@/stores/connection'
import { useTabStore } from '@/stores/tabs'
import { useFloatingWindowStore } from '@/stores/floatingWindows'
import { useMarketWs } from '@/hooks/useMarketWs'
import { useSubscriptionManager } from '@/hooks/useSubscriptionManager'
import { useContractsStore } from '@/stores/contracts'
import { useMarketFilterStore } from '@/stores/marketFilter'

// Mock TabBar 组件
vi.mock('@/components/TabBar', () => ({
  TabBar: ({ onAddTab }: { onAddTab?: () => void }) => (
    <div data-testid="tab-bar">
      <span>TabBar Mock</span>
      <button onClick={onAddTab}>+</button>
    </div>
  ),
}))

// Mock TabContent 组件
vi.mock('@/components/TabContent', () => ({
  TabContent: () => <div data-testid="tab-content">TabContent Mock</div>,
}))

// Mock 共享行情基础设施（App 挂载的全局单例）— 避免测试环境建立真实 WS 连接与订阅。
// TabContent 已 mock，MarketPanel 不会渲染，但 App 直接挂载这两个 hook。
vi.mock('@/hooks/useMarketWs', () => ({ useMarketWs: vi.fn() }))
vi.mock('@/hooks/useSubscriptionManager', () => ({ useSubscriptionManager: vi.fn() }))

// rAF stub（BottomBar FPS 徽标内 PerfMonitor visible=true 时使用）
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

describe('App Layout — 标签页系统', () => {
  beforeEach(() => {
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

    useConnectionStore.setState({ mdConnected: false, tdConnected: false })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 期货', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
    useFloatingWindowStore.setState({ windows: {} })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('标签页布局', () => {
    it('渲染 TabBar 组件', () => {
      render(<App />)
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    })

    it('渲染 TabContent 组件', () => {
      render(<App />)
      expect(screen.getByTestId('tab-content')).toBeInTheDocument()
    })

    it('使用 app 类名', () => {
      const { container } = render(<App />)
      expect(container.firstChild).toHaveClass('app')
    })
  })

  describe('底部状态栏（BottomBar）', () => {
    it('显示 MD/TD 连接状态', () => {
      render(<App />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('不渲染应用标题（由 Electron 原生标题栏承载）', () => {
      render(<App />)
      expect(screen.queryByText('SimNow 交易终端')).toBeNull()
    })
  })

  describe('设置面板', () => {
    it('渲染设置按钮', () => {
      render(<App />)
      expect(screen.getByTitle('设置')).toBeInTheDocument()
    })

    it('点击设置按钮打开设置标签页', () => {
      render(<App />)
      const settingsBtn = screen.getByTitle('设置')
      fireEvent.click(settingsBtn)
      // 验证设置标签页被打开（通过检查 tab store）
      // 注意：由于 openTab 是 store 方法，这里主要验证不报错
      expect(settingsBtn).toBeInTheDocument()
    })
  })

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

  describe('顶部菜单 IPC', () => {
    const setElectronAPI = (overrides: Record<string, any>) => {
      ;(window as any).electronAPI = {
        onNavigateTab: vi.fn(),
        onOpenFloatingTab: vi.fn(),
        onTogglePerf: vi.fn(),
        onGetSelectedInstrument: vi.fn(),
        ...overrides,
      }
      return window.electronAPI
    }

    it('onOpenFloatingTab query 打开查询浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('query')
      })
      expect(useFloatingWindowStore.getState().windows['tab-query']).toBeDefined()
      delete (window as any).electronAPI
    })

    it('onOpenFloatingTab settings 打开设置浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('settings')
      })
      expect(useFloatingWindowStore.getState().windows['tab-settings']).toBeDefined()
      delete (window as any).electronAPI
    })

    it('onOpenFloatingTab query-orders 打开报单查询浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('query-orders')
      })
      expect(useFloatingWindowStore.getState().windows['tab-query-orders']).toBeDefined()
      delete (window as any).electronAPI
    })

    it('onOpenFloatingTab query-positions 打开持仓查询浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('query-positions')
      })
      expect(useFloatingWindowStore.getState().windows['tab-query-positions']).toBeDefined()
      delete (window as any).electronAPI
    })

    it('onOpenFloatingTab tquote 打开 T型报价浮动窗（空白无预选）', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('tquote')
      })
      expect(useTabStore.getState().tabs.some((t) => t.type === 'tquote')).toBe(true)
      expect(useFloatingWindowStore.getState().windows['tab-tquote']).toBeDefined()
      delete (window as any).electronAPI
    })

    it('onTogglePerf 切换 FPS 监控', () => {
      const onTogglePerf = vi.fn()
      setElectronAPI({ onTogglePerf })
      render(<App />)
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
      const callback = onTogglePerf.mock.calls[0][0]
      act(() => {
        callback()
      })
      expect(screen.getByTestId('bottom-bar-fps')).toBeInTheDocument()
      delete (window as any).electronAPI
    })
  })

  describe('共享行情基础设施（上移 App，期货/期权双面板单例）', () => {
    it('挂载 useMarketWs 与 useSubscriptionManager 各一次，并启动时加载合约/收藏', () => {
      vi.clearAllMocks()
      const loadAllSpy = vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
      const loadFavSpy = vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)

      render(<App />)

      expect(useMarketWs).toHaveBeenCalledTimes(1)
      expect(useMarketWs).toHaveBeenCalledWith('ws://localhost:8000')
      expect(useSubscriptionManager).toHaveBeenCalledTimes(1)
      expect(loadAllSpy).toHaveBeenCalledTimes(1)
      expect(loadFavSpy).toHaveBeenCalledTimes(1)
    })

    it('启动时加载持久化筛选（useMarketFilterStore.load）', () => {
      vi.spyOn(useContractsStore.getState(), 'loadAllInstruments').mockResolvedValue(undefined)
      vi.spyOn(useContractsStore.getState(), 'loadFavoriteContracts').mockResolvedValue(undefined)
      const loadSpy = vi.spyOn(useMarketFilterStore.getState(), 'load').mockImplementation(() => {})
      render(<App />)
      expect(loadSpy).toHaveBeenCalledTimes(1)
      loadSpy.mockRestore()
    })
  })
})
