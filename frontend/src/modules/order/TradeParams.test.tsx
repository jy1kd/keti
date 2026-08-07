import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TradeParams } from './TradeParams'
import { useOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'

const IF2608_CONTRACT = {
  instrumentID: 'IF2608',
  instrumentName: '沪深300',
  exchangeID: 'CFFEX',
  productID: 'IF',
  volumeMultiple: 300,
  priceTick: 0.2,
  expireDate: '2026-08-15',
  isTrading: 1,
  productClass: '1',
}

function setForm(partial: Partial<ReturnType<typeof useOrderStore.getState>['orderForm']>) {
  useOrderStore.setState({ orderForm: { ...useOrderStore.getState().orderForm, ...partial } })
}

describe('TradeParams（任务#4）', () => {
  beforeEach(() => {
    setForm({ instrumentID: 'IF2608', volumeTotalOriginal: 1, orderPriceType: 'limit' })
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      favorites: [],
      isLoaded: true,
    })
  })

  it('渲染 开平/投保/有效期 三个下拉与手数步进', () => {
    render(<TradeParams />)
    expect(screen.getByLabelText('开平')).toBeInTheDocument()
    expect(screen.getByLabelText('投保')).toBeInTheDocument()
    expect(screen.getByLabelText('有效期')).toBeInTheDocument()
    expect(screen.getByTestId('tp-volume')).toBeInTheDocument()
  })

  it('开平下拉当前值 = combOffsetFlag，选项映射正确', () => {
    render(<TradeParams />)
    const select = screen.getByLabelText('开平') as HTMLSelectElement
    expect(select.value).toBe('open')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['open', 'close', 'close_today'])
  })

  it('选择开平 → setOrderForm({ combOffsetFlag })', () => {
    render(<TradeParams />)
    fireEvent.change(screen.getByLabelText('开平'), { target: { value: 'close' } })
    expect(useOrderStore.getState().orderForm.combOffsetFlag).toBe('close')
  })

  it('选择投保 → setOrderForm({ combHedgeFlag })', () => {
    render(<TradeParams />)
    fireEvent.change(screen.getByLabelText('投保'), { target: { value: 'hedge' } })
    expect(useOrderStore.getState().orderForm.combHedgeFlag).toBe('hedge')
  })

  it('选择有效期 → setOrderForm({ timeCondition })', () => {
    render(<TradeParams />)
    fireEvent.change(screen.getByLabelText('有效期'), { target: { value: 'fok' } })
    expect(useOrderStore.getState().orderForm.timeCondition).toBe('fok')
  })

  it('手数 +/- 步进（最小 1）', () => {
    render(<TradeParams />)
    fireEvent.click(screen.getByTestId('tp-volume-up'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(2)
    fireEvent.click(screen.getByTestId('tp-volume-down'))
    fireEvent.click(screen.getByTestId('tp-volume-down'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(1)
  })

  it('期货限价单上限 500 手提示', () => {
    render(<TradeParams />)
    expect(screen.getByText('最大 500 手')).toBeInTheDocument()
  })

  it('市价单上限 60 手提示', () => {
    setForm({ orderPriceType: 'market' })
    render(<TradeParams />)
    expect(screen.getByText('最大 60 手')).toBeInTheDocument()
  })

  it('期权限价单上限 100 手提示', () => {
    useContractsStore.setState({
      contracts: [{ ...IF2608_CONTRACT, productClass: '2' }],
      favorites: [],
      isLoaded: true,
    })
    render(<TradeParams />)
    expect(screen.getByText('最大 100 手')).toBeInTheDocument()
  })

  it('手数超限 → 显示错误提示', () => {
    setForm({ volumeTotalOriginal: 600 })
    render(<TradeParams />)
    expect(screen.getByText('数量不能超过500手')).toBeInTheDocument()
    expect(screen.getByTestId('tp-volume-hint').className).toContain('tp-hint--error')
  })

  it('手数 + 达上限时禁用步进按钮，不再越界累加（🟡-4）', () => {
    setForm({ volumeTotalOriginal: 500 })
    render(<TradeParams />)
    expect(screen.getByTestId('tp-volume-up')).toBeDisabled()
    fireEvent.click(screen.getByTestId('tp-volume-up'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(500)
  })

  describe('快捷手数（P3 QtyPreset 集成）', () => {
    it('点击预设 → setOrderForm({ volumeTotalOriginal })', () => {
      render(<TradeParams />)
      fireEvent.click(screen.getByTestId('qty-preset-50'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(50)
    })

    it('市价单上限 60：点击 100 预设 → 钳制到 60', () => {
      setForm({ orderPriceType: 'market' })
      render(<TradeParams />)
      fireEvent.click(screen.getByTestId('qty-preset-100'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(60)
    })
  })

  describe('合约步进（P3 ContractStepper 集成）', () => {
    it('渲染 合约 行与步进控件', () => {
      render(<TradeParams />)
      expect(screen.getByText('合约')).toBeInTheDocument()
      expect(screen.getByTestId('contract-stepper')).toBeInTheDocument()
    })

    it('点击 › 相邻月份 → setOrderForm({ instrumentID }) 切换到新合约', () => {
      useContractsStore.setState({
        contracts: [
          IF2608_CONTRACT,
          { ...IF2608_CONTRACT, instrumentID: 'IF2609' },
          { ...IF2608_CONTRACT, instrumentID: 'IF2607' },
        ],
        favorites: [],
        isLoaded: true,
      })
      render(<TradeParams />)
      fireEvent.click(screen.getByTestId('cs-next'))
      expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2609')
    })

    it('点击 ‹ 相邻月份 → 切换到上一月份合约', () => {
      useContractsStore.setState({
        contracts: [
          IF2608_CONTRACT,
          { ...IF2608_CONTRACT, instrumentID: 'IF2609' },
          { ...IF2608_CONTRACT, instrumentID: 'IF2607' },
        ],
        favorites: [],
        isLoaded: true,
      })
      render(<TradeParams />)
      fireEvent.click(screen.getByTestId('cs-prev'))
      expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2607')
    })
  })
})
