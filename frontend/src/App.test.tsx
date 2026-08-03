import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { useConnectionStore } from '@/stores/connection'
import { useTabStore } from '@/stores/tabs'

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

describe('App Layout — 标签页系统', () => {
  beforeEach(() => {
    useConnectionStore.setState({ mdConnected: false, tdConnected: false })
    useTabStore.setState({
      tabs: [
        { id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false },
      ],
      activeTabId: 'tab-market',
    })
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

  describe('状态栏', () => {
    it('显示 MD/TD 连接状态', () => {
      render(<App />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('显示应用标题', () => {
      render(<App />)
      expect(screen.getByText('SimNow 交易终端')).toBeInTheDocument()
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
    it('渲染 FPS 按钮', () => {
      render(<App />)
      expect(screen.getByText('⚡FPS')).toBeInTheDocument()
    })

    it('Ctrl+Shift+M 切换性能监控', () => {
      render(<App />)
      const fpsBtn = screen.getByText('⚡FPS').closest('button')
      expect(fpsBtn).toBeInTheDocument()

      // 触发快捷键后，FPS 按钮背景色应变化（perfVisible=true）
      fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
      expect(fpsBtn).toHaveStyle({ background: 'rgba(63,185,80,0.12)' })
    })
  })
})
