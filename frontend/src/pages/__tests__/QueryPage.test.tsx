import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryPage } from '../QueryPage'

// Mock QueryPanel 组件。
// QueryPanel 自身的 Tab 切换 / 数据加载已由 modules/query/QueryPanel.test.tsx 覆盖，
// 本测试聚焦 QueryPage 页面包装层（页头 + 集成）。
vi.mock('@/modules/query/QueryPanel', () => ({
  QueryPanel: () => <div data-testid="query-panel">查询面板 Mock</div>,
}))

describe('QueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 页头 ──

  it('should render page header with 📋 查询 title', () => {
    render(<QueryPage />)
    expect(screen.getByText('📋 查询')).toBeInTheDocument()
  })

  // ── 集成 QueryPanel ──

  it('should integrate QueryPanel component', () => {
    render(<QueryPage />)
    expect(screen.getByTestId('query-panel')).toBeInTheDocument()
  })

  // ── 包装结构 ──

  it('should render with query-page wrapper class', () => {
    const { container } = render(<QueryPage />)
    expect(container.firstChild).toHaveClass('query-page')
  })
})
