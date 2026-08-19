import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ContractInfo } from '@/services/types'
import { OptionsFilterBar } from './OptionsFilterBar'
import { EMPTY_OPTIONS_TABS, type OptionsTabsState } from './optionsTabs'

function makeContract(instrumentID: string, underlyingInstrID: string, exchangeID: string): ContractInfo {
  return { instrumentID, underlyingInstrID, exchangeID } as ContractInfo
}

// FG×2 系列（CZCE），MA（CZCE），cu×2 系列（SHFE），al（SHFE）
const contracts: ContractInfo[] = [
  makeContract('FG609-C-1300', 'FG609', 'CZCE'),
  makeContract('FG610-P-1300', 'FG610', 'CZCE'),
  makeContract('MA609-C-1000', 'MA609', 'CZCE'),
  makeContract('cu2609-C-70000', 'cu2609', 'SHFE'),
  makeContract('cu2701-P-70000', 'cu2701', 'SHFE'),
  makeContract('al2609-C-20000', 'al2609', 'SHFE'),
]

const getProduct = (c: ContractInfo) => (c.underlyingInstrID ?? '').replace(/\d+$/, '')
const productNames: Record<string, string> = { FG: '玻璃', MA: '甲醇', cu: '铜', al: '铝' }

function Harness({ initial = EMPTY_OPTIONS_TABS, onClear }: { initial?: OptionsTabsState; onClear?: () => void }) {
  const [value, setValue] = useState(initial)
  return (
    <OptionsFilterBar
      allContracts={contracts}
      getProduct={getProduct}
      productNames={productNames}
      value={value}
      onChange={(v) => setValue(v)}
      onClear={onClear}
    />
  )
}

/** 点开合并下拉并选定交易所：同一面板自动切到该所品种清单（无需二次点击） */
function openAndPickExchange(exchange: string) {
  fireEvent.click(screen.getByTestId('options-filter-combo__button'))
  fireEvent.click(screen.getByRole('button', { name: exchange }))
}

describe('OptionsFilterBar 合并的交易所→品种下拉 → Tab → 系列', () => {
  it('初始：按钮显示「请选择交易所」，无 tab 条、无系列下拉', () => {
    render(<Harness />)
    expect(screen.getByTestId('options-filter-combo__button')).toHaveTextContent('请选择交易所')
    expect(screen.queryByTestId('options-filter-tabs')).toBeNull()
    expect(screen.queryByTestId('options-series-select')).toBeNull()
  })

  it('点开先选交易所；选完交易所同一面板自动跳出该所品种（无需额外点击）', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('options-filter-combo__button'))
    // 第一步：交易所列表
    expect(screen.getByTitle('选择交易所与品种')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CZCE' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SHFE' })).toBeInTheDocument()
    // 选 SHFE → 面板自动切到品种步骤（不放面板即在本步骤）
    fireEvent.click(screen.getByRole('button', { name: 'SHFE' }))
    expect(screen.getByText('SHFE 品种')).toBeInTheDocument()
    expect(screen.getByLabelText('cu')).toBeInTheDocument()
    expect(screen.getByLabelText('al')).toBeInTheDocument()
    expect(screen.queryByLabelText('FG')).toBeNull() // CZCE 品种不在
  })

  it('品种面板标题 ‹ 返回可重新选交易所', () => {
    render(<Harness />)
    openAndPickExchange('SHFE')
    fireEvent.click(screen.getByTestId('options-filter-back'))
    expect(screen.getByText('选择交易所')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CZCE' })).toBeInTheDocument()
  })

  it('品种勾选 → 追加 tab（英文代码）并激活；取消勾选 → 移除 tab', () => {
    render(<Harness />)
    openAndPickExchange('SHFE')
    fireEvent.click(screen.getByLabelText('cu'))
    // tab 条出现，tab 显示英文代码
    expect(screen.getByTestId('options-filter-tabs')).toBeInTheDocument()
    const tabs = screen.getByTestId('options-filter-tabs')
    expect(within(tabs).getAllByText('cu').length).toBeGreaterThan(0)
    // 取消勾选 → tab 消失
    fireEvent.click(screen.getByLabelText('cu'))
    expect(screen.queryByTestId('options-filter-tabs')).toBeNull()
  })

  it('跨交易所累积：返回换交易所再选品种，tab 合并保留', () => {
    render(<Harness />)
    openAndPickExchange('SHFE')
    fireEvent.click(screen.getByLabelText('cu'))
    // 返回 → 选 CZCE → 加 FG
    fireEvent.click(screen.getByTestId('options-filter-back'))
    fireEvent.click(screen.getByRole('button', { name: 'CZCE' }))
    fireEvent.click(screen.getByLabelText('FG'))
    const tabs = screen.getByTestId('options-filter-tabs')
    expect(within(tabs).getByText('cu')).toBeInTheDocument()
    expect(within(tabs).getByText('FG')).toBeInTheDocument()
    // 新加的 FG 是激活 tab → 系列下拉随动为 FG 系列
    expect(screen.getByTestId('options-series-select')).toBeInTheDocument()
  })

  it('筛选条内容溢出时，鼠标滚轮横向移动到后面的品种', () => {
    render(<Harness initial={{ exchange: 'CZCE', tabs: [
      { product: 'FG', series: [] },
      { product: 'MA', series: [] },
      { product: 'cu', series: [] },
    ], activeIndex: 2 }} />)
    const tabs = screen.getByTestId('options-filter-tabs')
    Object.defineProperty(tabs, 'clientWidth', { configurable: true, value: 80 })
    Object.defineProperty(tabs, 'scrollWidth', { configurable: true, value: 240 })
    Object.defineProperty(tabs, 'scrollLeft', { configurable: true, writable: true, value: 0 })

    fireEvent.wheel(tabs, { deltaY: 60 })

    expect(tabs.scrollLeft).toBe(60)
  })

  it('tab 点击切换激活（aria-selected）；✕ 关闭品种', () => {
    render(<Harness />)
    openAndPickExchange('SHFE')
    fireEvent.click(screen.getByLabelText('cu'))
    // 面板保持打开：返回 → 选 CZCE → 加 FG（新加激活）
    fireEvent.click(screen.getByTestId('options-filter-back'))
    fireEvent.click(screen.getByRole('button', { name: 'CZCE' }))
    fireEvent.click(screen.getByLabelText('FG'))
    const tabsEl = screen.getByTestId('options-filter-tabs')
    const tabs = Array.from(tabsEl.querySelectorAll('[role="tab"]')) as HTMLElement[]
    // 顺序 cu、FG；新加的 FG 激活
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    // 切换回 cu
    fireEvent.click(tabs[0])
    expect(tabsEl.querySelectorAll('[role="tab"]')[0].getAttribute('aria-selected')).toBe('true')
    // 关闭 cu
    const closes = screen.getAllByTitle('关闭品种')
    expect(closes.length).toBe(2)
    fireEvent.click(closes[0])
    expect(screen.getByTestId('options-filter-tabs').textContent).not.toContain('cu')
    expect(screen.getByTestId('options-filter-tabs').textContent).toContain('FG')
  })

  it('系列下拉：列出激活品种的全部系列；勾选系列收窄；「全部」清空系列', () => {
    render(<Harness />)
    openAndPickExchange('CZCE')
    fireEvent.click(screen.getByLabelText('FG'))
    // FG 有两个系列，系列下拉随激活 tab 出现
    expect(screen.getByTestId('options-series-select')).toBeInTheDocument()
    // 未选 → 按钮显示「FG 系列·多选」
    expect(screen.getByTestId('options-series-dropdown')).toHaveTextContent('FG 系列·多选')
    fireEvent.click(screen.getByTestId('options-series-dropdown'))
    fireEvent.click(screen.getByLabelText('FG609'))
    // 选中 1 个 → 按钮显示「FG 系列·已选1」
    expect(screen.getByTestId('options-series-dropdown')).toHaveTextContent('FG 系列·已选1')
    // 「全部」清空系列
    fireEvent.click(screen.getByTestId('options-series-all'))
    expect(screen.getByTestId('options-series-dropdown')).toHaveTextContent('FG 系列·多选')
  })

  it('系列选项较多时，保持纵向清单并支持鼠标滚轮继续查看后面的系列', () => {
    render(<Harness initial={{ exchange: 'CZCE', tabs: [{ product: 'FG', series: [] }], activeIndex: 0 }} />)
    fireEvent.click(screen.getByTestId('options-series-dropdown'))
    const panel = document.querySelector('.options-filter-panel--series') as HTMLElement
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 80 })
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 240 })
    Object.defineProperty(panel, 'scrollTop', { configurable: true, writable: true, value: 0 })

    fireEvent.wheel(panel, { deltaY: 60 })

    expect(panel.scrollTop).toBe(60)
  })

  it('系列下拉随激活 tab 变化（切到 MA 显示其系列）', () => {
    render(<Harness />)
    openAndPickExchange('CZCE')
    fireEvent.click(screen.getByLabelText('FG'))
    // 面板保持打开，直接加 MA
    fireEvent.click(screen.getByLabelText('MA'))
    const tabsEl = screen.getByTestId('options-filter-tabs')
    const tabs = Array.from(tabsEl.querySelectorAll('[role="tab"]')) as HTMLElement[]
    expect(tabs.length).toBe(2)
    // MA 激活 → 系列下拉是 MA 的系列
    fireEvent.click(screen.getByTestId('options-series-dropdown'))
    expect(screen.getByLabelText('MA609')).toBeInTheDocument()
    expect(screen.queryByLabelText('FG609')).toBeNull()
    // 切回 FG tab → 系列下拉变为 FG 系列
    fireEvent.click(tabs[0])
    fireEvent.click(screen.getByTestId('options-series-dropdown'))
    expect(screen.getByLabelText('FG609')).toBeInTheDocument()
    expect(screen.queryByLabelText('MA609')).toBeNull()
  })

  it('品种展示：英文代码在左（正常色），中文名在右（灰色）', () => {
    render(<Harness />)
    openAndPickExchange('SHFE')
    const item = screen.getByLabelText('cu').closest('label')!
    const code = item.querySelector('.options-filter-product-code')
    const name = item.querySelector('.options-filter-product-name')
    expect(code?.textContent).toBe('cu')
    expect(name?.textContent).toBe('铜')
    // 英文代码在中文名之前
    const indexOfCode = item.textContent!.indexOf('cu')
    const indexOfName = item.textContent!.indexOf('铜')
    expect(indexOfCode).toBeGreaterThan(-1)
    expect(indexOfName).toBeGreaterThan(indexOfCode)
  })

  it('清空按钮：清空筛选态并触发 onClear', () => {
    const onClear = vi.fn()
    render(<Harness initial={{ exchange: 'CZCE', tabs: [{ product: 'FG', series: ['FG609'] }], activeIndex: 0 }} onClear={onClear} />)
    fireEvent.click(screen.getByTitle('清空筛选'))
    expect(onClear).toHaveBeenCalled()
    expect(screen.getByTestId('options-filter-combo__button')).toHaveTextContent('请选择交易所')
    expect(screen.queryByTestId('options-filter-tabs')).toBeNull()
  })
})
