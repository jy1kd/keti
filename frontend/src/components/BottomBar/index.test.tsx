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
