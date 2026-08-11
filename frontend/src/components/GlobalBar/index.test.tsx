import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GlobalBar } from './index'
import { useTabStore } from '@/stores/tabs'

// Mock TabBar（GlobalBar 只承载，行为由 TabBar 自身测试覆盖）
vi.mock('@/components/TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar">TabBar Mock</div>,
}))

describe('GlobalBar', () => {
  const defaultTabs = {
    tabs: [
      { id: 'tab-market', type: 'market' as const, title: '📊 行情', props: {}, closable: false },
    ],
    activeTabId: 'tab-market',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useTabStore.setState(defaultTabs)
  })

  it('渲染中间 TabBar', () => {
    render(<GlobalBar />)
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
  })

  it('不再渲染连接状态（已迁至 BottomBar）', () => {
    render(<GlobalBar />)
    expect(screen.queryByText('MD')).toBeNull()
    expect(screen.queryByText('TD')).toBeNull()
  })

  it('不再渲染工具按钮（已迁至 BottomBar）', () => {
    render(<GlobalBar />)
    expect(screen.queryByLabelText('报单')).toBeNull()
    expect(screen.queryByLabelText('K线')).toBeNull()
    expect(screen.queryByLabelText('设置')).toBeNull()
  })

  it('不渲染应用标题「SimNow 交易终端」', () => {
    render(<GlobalBar />)
    expect(screen.queryByText('SimNow 交易终端')).toBeNull()
  })
})
