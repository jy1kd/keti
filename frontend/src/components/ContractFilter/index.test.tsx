import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractFilter } from './index'
import type { MarketFilter } from '@/modules/market/filter'

const PRODUCT_NAMES = { FG: '玻璃', cu: '沪铜', MA: '甲醇' }

const defaultProps = {
  exchanges: ['CZCE', 'SHFE'],
  products: ['FG', 'cu', 'MA'],
  productNames: PRODUCT_NAMES,
  value: { exchanges: [], products: [] } as MarketFilter,
  onChange: vi.fn(),
}

describe('ContractFilter', () => {
  beforeEach(() => {
    defaultProps.value = { exchanges: [], products: [] }
    defaultProps.onChange = vi.fn()
  })

  it('渲染「筛选」按钮，空筛选无徽标', () => {
    render(<ContractFilter {...defaultProps} />)
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument()
    expect(screen.queryByTestId('contract-filter-badge')).toBeNull()
  })

  it('点击按钮展开面板：含交易所与品种两组 checkbox', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    expect(screen.getByText('交易所')).toBeInTheDocument()
    expect(screen.getByText('品种')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'CZCE' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'SHFE' })).toBeInTheDocument()
    // 品种项：中文名 + 代码
    expect(screen.getByRole('checkbox', { name: /玻璃/ })).toBeInTheDocument()
    expect(screen.getByText('cu')).toBeInTheDocument()
  })

  it('勾选交易所调用 onChange({ ...value, exchanges })', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: 'SHFE' }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: ['SHFE'], products: [] })
  })

  it('再次勾选同一交易所取消选择', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: [] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: 'SHFE' }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: [], products: [] })
  })

  it('勾选品种调用 onChange({ ...value, products })', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: [], products: ['FG'] })
  })

  it('有已选时按钮显示数量徽标（交易所+品种合计）', () => {
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: ['FG', 'cu'] }} />)
    const badge = screen.getByTestId('contract-filter-badge')
    expect(badge).toHaveTextContent('3')
  })

  it('点击「清空」调用 onChange({ exchanges: [], products: [] })', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: ['FG'] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('button', { name: '清空' }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: [], products: [] })
  })

  it('Esc 关闭面板', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    expect(screen.getByText('交易所')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('交易所')).toBeNull()
  })

  it('点击外部关闭面板', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside" />
        <ContractFilter {...defaultProps} />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    expect(screen.getByText('交易所')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('交易所')).toBeNull()
  })

  it('品种关键词过滤展示列表（不影响已选值）', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    const keywordInput = screen.getByPlaceholderText('筛选品种...')
    await user.type(keywordInput, '玻璃')
    // 仅显示 FG，其余品种 checkbox 隐藏
    expect(screen.getByRole('checkbox', { name: /玻璃/ })).toBeInTheDocument()
    expect(screen.queryByText('cu')).toBeNull()
    expect(screen.queryByText('MA')).toBeNull()
  })
})
