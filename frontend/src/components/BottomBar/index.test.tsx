import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from './index'
import { useConnectionStore } from '@/stores/connection'
import { useMarketStore } from '@/modules/market/store'

// Mock 统一浮动窗入口（BottomBar 工具入口委托给 helper；helper 自身的打开选项在
// utils/openFloatingTab.test.ts 覆盖，此处只验证按钮→helper 的接线）
const {
  mockOpenFloatingTab,
  mockOpenOrderFloating,
  mockOpenKlineFloating,
  mockOpenSettingsFloating,
  mockOpenIpcMonitorFloating,
} = vi.hoisted(() => ({
  mockOpenFloatingTab: vi.fn(),
  mockOpenOrderFloating: vi.fn(),
  mockOpenKlineFloating: vi.fn(),
  mockOpenSettingsFloating: vi.fn(),
  mockOpenIpcMonitorFloating: vi.fn(),
}))

vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: mockOpenFloatingTab,
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
  openOrderFloating: mockOpenOrderFloating,
  openKlineFloating: mockOpenKlineFloating,
  openSettingsFloating: mockOpenSettingsFloating,
  openIpcMonitorFloating: mockOpenIpcMonitorFloating,
}))

describe('BottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      render(<BottomBar />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('工具按钮含图标 + 中文名', () => {
      render(<BottomBar />)
      const cases: Array<[string, string, string]> = [
        ['五档下单', '📝', '五档下单'],
        ['K线', '📈', 'K线'],
        ['设置', '⚙', '设置'],
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
    it('点击 📝 五档下单调用 openOrderFloating（选中合约细节由 helper 测试覆盖）', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('五档下单'))
      expect(mockOpenOrderFloating).toHaveBeenCalled()
    })

    it('点击 📈 K线调用 openKlineFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('K线'))
      expect(mockOpenKlineFloating).toHaveBeenCalled()
    })

    it('点击 ⚙ 设置按钮调用 openSettingsFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('设置'))
      expect(mockOpenSettingsFloating).toHaveBeenCalled()
    })

    it('点击 🔌 网络监控按钮调用 openIpcMonitorFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('网络监控'))
      expect(mockOpenIpcMonitorFloating).toHaveBeenCalled()
    })
  })

  describe('箭头展开/收起', () => {
    it('默认展开：工具区可见，箭头显示 <', () => {
      render(<BottomBar />)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('<')
    })

    it('点击箭头收起：工具区加 collapsed 类，箭头变 >', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByTestId('bottom-bar-toggle'))
      expect(screen.getByTestId('bottom-bar-tools')).toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('>')
    })

    it('再次点击展开：移除 collapsed 类，箭头变回 <', () => {
      render(<BottomBar />)
      const toggle = screen.getByTestId('bottom-bar-toggle')
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(toggle).toHaveTextContent('<')
    })
  })
})
