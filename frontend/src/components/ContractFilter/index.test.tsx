import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractFilter } from './index'
import type { MarketFilter } from '@/modules/market/filter'
import type { ContractInfo } from '@/services/types'

const PRODUCT_NAMES = { FG: '玻璃', cu: '沪铜', MA: '甲醇' }

/** 三合约跨两交易所/两品种（交叉计算用） */
const CONTRACTS: ContractInfo[] = [
  { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1' },
  { instrumentID: 'cu2609', instrumentName: 'cu2609', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1' },
  { instrumentID: 'MA609', instrumentName: 'MA609', exchangeID: 'CZCE', productID: 'MA', volumeMultiple: 1, priceTick: 0.1, expireDate: '', isTrading: 1, productClass: '1' },
]

const defaultProps = {
  allContracts: CONTRACTS,
  getProduct: (c: ContractInfo) => c.productID,
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

  it('点击「清空」调用 onChange({ exchanges: [], products: [], underlyings: [] })', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: ['FG'] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('button', { name: '清空' }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: [], products: [], underlyings: [] })
  })

  it('清空时调用 onClear 回调', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: ['FG'] }} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('button', { name: '清空' }))
    expect(onClear).toHaveBeenCalledTimes(1)
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

  // --- 交叉联动（V2-3） ---

  it('交叉联动：勾选品种后交易所列表只剩有该品种的交易所', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: [], products: ['FG'] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    // FG 仅在 CZCE → 交易所列表只剩 CZCE（SHFE 隐藏）
    expect(screen.getByRole('checkbox', { name: 'CZCE' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'SHFE' })).toBeNull()
  })

  it('交叉联动：勾选交易所后品种列表只剩该所合约的品种', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: [] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    // SHFE 仅 cu → 品种列表只剩 cu
    expect(screen.getByRole('checkbox', { name: /沪铜/ })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /玻璃/ })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /甲醇/ })).toBeNull()
  })

  it('已选但被交叉过滤掉的品种/交易所仍显示（勾选）且可取消', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: ['SHFE'], products: ['FG'] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    // SHFE 已选 → 可用品种只剩 cu；FG 不在可用列表但仍显示勾选（可取消）
    expect(screen.getByRole('checkbox', { name: 'SHFE' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /玻璃/ })).toBeChecked()
    // 取消 FG → onChange 移除该品种
    await user.click(screen.getByRole('checkbox', { name: /玻璃/ }))
    expect(defaultProps.onChange).toHaveBeenCalledWith({ exchanges: ['SHFE'], products: [] })
  })
})

// ── 标底合约级筛选（传 getUnderlying 时显示的第三级） ─────────────────────

describe('ContractFilter 标底合约级筛选', () => {
  /** 期权合约：带 underlyingInstrID，标底跨两品种（FG×2、MA×1） */
  const OPTION_CONTRACTS: ContractInfo[] = [
    { instrumentID: 'FG609-C-1300', instrumentName: 'FG609-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 1, priceTick: 0.1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'FG609', optionsType: '1', strikePrice: 1300 },
    { instrumentID: 'FG610-C-1300', instrumentName: 'FG610-C-1300', exchangeID: 'CZCE', productID: 'FGC', volumeMultiple: 1, priceTick: 0.1, expireDate: '20261030', isTrading: 1, productClass: '2', underlyingInstrID: 'FG610', optionsType: '1', strikePrice: 1300 },
    { instrumentID: 'MA609-C-1500', instrumentName: 'MA609-C-1500', exchangeID: 'CZCE', productID: 'MAC', volumeMultiple: 1, priceTick: 0.1, expireDate: '20260930', isTrading: 1, productClass: '2', underlyingInstrID: 'MA609', optionsType: '1', strikePrice: 1500 },
  ]
  const optProps = {
    allContracts: OPTION_CONTRACTS,
    getProduct: (c: ContractInfo) => c.underlyingInstrID!.replace(/\d+$/, ''),
    productNames: PRODUCT_NAMES,
    getUnderlying: (c: ContractInfo) => c.underlyingInstrID!,
    onChange: vi.fn(),
  }

  beforeEach(() => {
    optProps.onChange = vi.fn()
  })

  it('未传 getUnderlying 时不显示「合约」section（期货页不显示）', async () => {
    const user = userEvent.setup()
    render(<ContractFilter {...defaultProps} value={{ exchanges: [], products: ['FG'], underlyings: [] }} />)
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    expect(screen.queryByText('合约')).toBeNull()
  })

  it('传 getUnderlying 且已选品种时显示「合约」section，只列出该品种标底', async () => {
    const user = userEvent.setup()
    render(
      <ContractFilter
        {...optProps}
        value={{ exchanges: [], products: ['FG'], underlyings: [] }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    // 合约 section 出现，列出 FG 品种的两个标底
    expect(screen.getByText('合约')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'FG609' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'FG610' })).toBeInTheDocument()
    // 其他品种（MA609）不在该品种标底列表中
    expect(screen.queryByRole('checkbox', { name: 'MA609' })).toBeNull()
  })

  it('未选品种时不显示「合约」section', async () => {
    const user = userEvent.setup()
    render(
      <ContractFilter
        {...optProps}
        value={{ exchanges: [], products: [], underlyings: [] }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    expect(screen.queryByText('合约')).toBeNull()
  })

  it('勾选标底调用 onChange({ ...value, underlyings })', async () => {
    const user = userEvent.setup()
    render(
      <ContractFilter
        {...optProps}
        value={{ exchanges: [], products: ['FG'], underlyings: [] }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    await user.click(screen.getByRole('checkbox', { name: 'FG609' }))
    expect(optProps.onChange).toHaveBeenCalledWith({ exchanges: [], products: ['FG'], underlyings: ['FG609'] })
  })

  it('已选标底即使被交易所/品种交叉过滤掉也并回显示（可取消）', async () => {
    const user = userEvent.setup()
    render(
      <ContractFilter
        {...optProps}
        value={{ exchanges: ['CZCE'], products: ['MA'], underlyings: ['FG609'] }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /筛选/ }))
    // 已选 MA 品种 → 可用标底只有 MA609；FG609 被过滤但仍并回显示勾选
    expect(screen.getByRole('checkbox', { name: 'FG609' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'MA609' })).toBeInTheDocument()
    // 取消 FG609 → onChange 移除
    await user.click(screen.getByRole('checkbox', { name: 'FG609' }))
    expect(optProps.onChange).toHaveBeenCalledWith({ exchanges: ['CZCE'], products: ['MA'], underlyings: [] })
  })
})
