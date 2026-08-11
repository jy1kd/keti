import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TradeParams } from './TradeParams'
import { useOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import { useQueryStore } from '../query/store'

vi.mock('../../services/api')

import {
  cancelOrder as apiCancelOrder,
  cancelAllOrders as apiCancelAllOrders,
  reversePosition as apiReversePosition,
} from '../../services/api'

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
    useOrderStore.setState({ volumeStep: 1 })
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      favorites: [],
      isLoaded: true,
    })
  })

  it('渲染 开平/投保/有效期 三个下拉与手数步进', () => {
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByLabelText('开平')).toBeInTheDocument()
    expect(screen.getByLabelText('投保')).toBeInTheDocument()
    expect(screen.getByLabelText('有效期')).toBeInTheDocument()
    expect(screen.getByTestId('tp-volume')).toBeInTheDocument()
  })

  it('开平下拉当前值 = combOffsetFlag，选项映射正确', () => {
    render(<TradeParams instrumentID="IF2608" />)
    const select = screen.getByLabelText('开平') as HTMLSelectElement
    expect(select.value).toBe('open')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['open', 'close', 'close_today'])
  })

  it('选择开平 → setOrderForm({ combOffsetFlag })', () => {
    render(<TradeParams instrumentID="IF2608" />)
    fireEvent.change(screen.getByLabelText('开平'), { target: { value: 'close' } })
    expect(useOrderStore.getState().orderForm.combOffsetFlag).toBe('close')
  })

  it('选择投保 → setOrderForm({ combHedgeFlag })', () => {
    render(<TradeParams instrumentID="IF2608" />)
    fireEvent.change(screen.getByLabelText('投保'), { target: { value: 'hedge' } })
    expect(useOrderStore.getState().orderForm.combHedgeFlag).toBe('hedge')
  })

  it('选择有效期 → setOrderForm({ timeCondition })', () => {
    render(<TradeParams instrumentID="IF2608" />)
    fireEvent.change(screen.getByLabelText('有效期'), { target: { value: 'fok' } })
    expect(useOrderStore.getState().orderForm.timeCondition).toBe('fok')
  })

  it('手数 +/- 步进（最小 1）', () => {
    render(<TradeParams instrumentID="IF2608" />)
    fireEvent.click(screen.getByTestId('tp-volume-up'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(2)
    fireEvent.click(screen.getByTestId('tp-volume-down'))
    fireEvent.click(screen.getByTestId('tp-volume-down'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(1)
  })

  it('期货限价单上限 500 手提示', () => {
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByText('最大 500 手')).toBeInTheDocument()
  })

  it('市价单上限 60 手提示', () => {
    setForm({ orderPriceType: 'market' })
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByText('最大 60 手')).toBeInTheDocument()
  })

  it('期权限价单上限 100 手提示', () => {
    useContractsStore.setState({
      contracts: [{ ...IF2608_CONTRACT, productClass: '2' }],
      favorites: [],
      isLoaded: true,
    })
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByText('最大 100 手')).toBeInTheDocument()
  })

  it('手数超限 → 显示错误提示', () => {
    setForm({ volumeTotalOriginal: 600 })
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByText('数量不能超过500手')).toBeInTheDocument()
    expect(screen.getByTestId('tp-volume-hint').className).toContain('tp-hint--error')
  })

  it('手数 + 达上限时禁用步进按钮，不再越界累加（🟡-4）', () => {
    setForm({ volumeTotalOriginal: 500 })
    render(<TradeParams instrumentID="IF2608" />)
    expect(screen.getByTestId('tp-volume-up')).toBeDisabled()
    fireEvent.click(screen.getByTestId('tp-volume-up'))
    expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(500)
  })

  describe('快捷手数（P3 QtyPreset 集成）', () => {
    it('点击预设 → 手数保持不变、步进设为预设值', () => {
      render(<TradeParams instrumentID="IF2608" />)
      // beforeEach 手数为 1；点 20 只改步进，不改手数
      fireEvent.click(screen.getByTestId('qty-preset-20'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(1)
      expect(useOrderStore.getState().volumeStep).toBe(20)
    })

    it('步进 +/− 按 volumeStep（手数 5 点 20 → + → 25 → − → 5）', () => {
      setForm({ volumeTotalOriginal: 5 })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('qty-preset-20'))
      fireEvent.click(screen.getByTestId('tp-volume-up'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(25)
      fireEvent.click(screen.getByTestId('tp-volume-down'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(5)
    })

    it('手动输入手数不改变步进（步进 20 → 输入 35 → + → 55）', () => {
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('qty-preset-20'))
      fireEvent.change(screen.getByTestId('tp-volume'), { target: { value: '35' } })
      expect(useOrderStore.getState().volumeStep).toBe(20)
      fireEvent.click(screen.getByTestId('tp-volume-up'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(55)
    })

    it('市价 limit 60：手数 20 步进 20 → + → 40 → + → 60 到顶禁用', () => {
      setForm({ orderPriceType: 'market', volumeTotalOriginal: 20 })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('qty-preset-20'))
      fireEvent.click(screen.getByTestId('tp-volume-up'))
      fireEvent.click(screen.getByTestId('tp-volume-up'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(60)
      expect(screen.getByTestId('tp-volume-up')).toBeDisabled()
    })

    it('点 100 预设 → 手数不变（不钳制手数）、步进为 100', () => {
      setForm({ orderPriceType: 'market' })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('qty-preset-100'))
      expect(useOrderStore.getState().orderForm.volumeTotalOriginal).toBe(1)
      expect(useOrderStore.getState().volumeStep).toBe(100)
    })
  })

  describe('操作按钮（P3-5 撤最新/撤全部/平净仓）', () => {
    beforeEach(() => {
      useQueryStore.setState({ orders: [], positions: [] })
      vi.clearAllMocks()
    })

    it('渲染 撤最新/撤全部/平净仓 按钮', () => {
      render(<TradeParams instrumentID="IF2608" />)
      expect(screen.getByTestId('tp-cancel-latest')).toBeInTheDocument()
      expect(screen.getByTestId('tp-cancel-all')).toBeInTheDocument()
      expect(screen.getByTestId('tp-flat-net')).toBeInTheDocument()
    })

    it('撤最新 → 撤当前合约 insertTime 最新一笔活动挂单', async () => {
      vi.mocked(apiCancelOrder).mockResolvedValue({ success: true })
      useQueryStore.setState({
        orders: [
          { orderRef: 'OLD', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4690, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '2', insertTime: '09:30:01' },
          { orderRef: 'LATEST', instrumentID: 'IF2608', direction: '0', combOffsetFlag: '0', limitPrice: 4694, volumeTotalOriginal: 2, volumeTraded: 0, orderStatus: '2', insertTime: '09:31:00' },
          { orderRef: 'OTHER', instrumentID: 'IC2608', direction: '0', combOffsetFlag: '0', limitPrice: 5600, volumeTotalOriginal: 1, volumeTraded: 0, orderStatus: '2', insertTime: '09:32:00' },
        ],
      })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-cancel-latest'))
      await act(async () => {})
      expect(apiCancelOrder).toHaveBeenCalledWith('LATEST')
    })

    it('撤最新但无该合约活动挂单 → 不调撤单接口', async () => {
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-cancel-latest'))
      await act(async () => {})
      expect(apiCancelOrder).not.toHaveBeenCalled()
    })

    it('撤全部 → 强制确认框 → 确认后调用 cancelAllOrders', async () => {
      vi.mocked(apiCancelAllOrders).mockResolvedValue({ success: true, attempted: 2, succeeded: 2, failedRefs: [] })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-cancel-all'))
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('确认执行'))
      await act(async () => {})
      expect(apiCancelAllOrders).toHaveBeenCalledTimes(1)
    })

    it('撤全部取消 → 不调用 cancelAllOrders', () => {
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-cancel-all'))
      fireEvent.click(screen.getByText('取消'))
      expect(apiCancelAllOrders).not.toHaveBeenCalled()
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    })

    it('平净仓 → 强制确认框 → 确认后调用 reversePosition(当前合约)', async () => {
      vi.mocked(apiReversePosition).mockResolvedValue({ success: true, orders: [] })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-flat-net'))
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByText('确认执行'))
      await act(async () => {})
      expect(apiReversePosition).toHaveBeenCalledWith(expect.objectContaining({ instrumentID: 'IF2608' }))
    })

    it('平净仓成功 → 刷新持仓', async () => {
      const fetchPositionsSpy = vi.spyOn(useQueryStore.getState(), 'fetchPositions').mockResolvedValue(undefined)
      vi.mocked(apiReversePosition).mockResolvedValue({ success: true, orders: [] })
      render(<TradeParams instrumentID="IF2608" />)
      fireEvent.click(screen.getByTestId('tp-flat-net'))
      fireEvent.click(screen.getByText('确认执行'))
      await act(async () => {})
      expect(fetchPositionsSpy).toHaveBeenCalled()
    })
  })

  describe('合约搜索切换（替换箭头步进）', () => {
    it('渲染 合约 行与搜索框（回显当前合约）', () => {
      render(<TradeParams instrumentID="IF2608" />)
      expect(screen.getByText('合约')).toBeInTheDocument()
      const input = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
      expect(input.value).toBe('IF2608')
    })

    it('搜索并选择合约 → setOrderForm({ instrumentID }) 切换', () => {
      useContractsStore.setState({
        contracts: [
          IF2608_CONTRACT,
          { ...IF2608_CONTRACT, instrumentID: 'IF2609' },
        ],
        favorites: [],
        isLoaded: true,
      })
      render(<TradeParams instrumentID="IF2608" />)
      const input = screen.getByPlaceholderText('搜索合约...')
      fireEvent.change(input, { target: { value: 'IF2609' } })
      fireEvent.mouseDown(screen.getByText('IF2609'))
      expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2609')
    })

    it('选择新合约后输入框回显新合约（key 随 activeInstrument 重挂载）', () => {
      useContractsStore.setState({
        contracts: [
          IF2608_CONTRACT,
          { ...IF2608_CONTRACT, instrumentID: 'IF2609' },
        ],
        favorites: [],
        isLoaded: true,
      })
      const { rerender } = render(<TradeParams instrumentID="IF2608" />)
      const input = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'IF2609' } })
      fireEvent.mouseDown(screen.getByText('IF2609'))
      // orderForm.instrumentID 已切换 → key 变化强制重挂载 → 输入框回显新合约
      expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2609')
      rerender(<TradeParams instrumentID="IF2609" />)
      const input2 = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
      expect(input2.value).toBe('IF2609')
    })

    it('浮动窗模式选择新合约 → 触发 onSwitch 联动切换所属标签页合约', () => {
      const onSwitch = vi.fn()
      useContractsStore.setState({
        contracts: [
          IF2608_CONTRACT,
          { ...IF2608_CONTRACT, instrumentID: 'IF2609' },
        ],
        favorites: [],
        isLoaded: true,
      })
      render(<TradeParams instrumentID="IF2608" onSwitch={onSwitch} />)
      const input = screen.getByPlaceholderText('搜索合约...')
      fireEvent.change(input, { target: { value: 'IF2609' } })
      fireEvent.mouseDown(screen.getByText('IF2609'))
      expect(onSwitch).toHaveBeenCalledWith('IF2609')
    })
  })

  it('无 instrumentID prop 时忽略 orderForm 残留（全局残留不击穿空态：请选择合约 + 操作按钮禁用）', () => {
    // beforeEach 已把 orderForm.instrumentID 设为 'IF2608'（残留）
    render(<TradeParams />)
    expect(screen.getByPlaceholderText('请选择合约')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('IF2608')).toBeNull()
    expect(screen.getByTestId('tp-cancel-latest')).toBeDisabled()
    expect(screen.getByTestId('tp-cancel-all')).toBeDisabled()
    expect(screen.getByTestId('tp-flat-net')).toBeDisabled()
  })
})
