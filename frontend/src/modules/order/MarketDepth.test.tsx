import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MarketDepth, DepthRow, QuickTradeBar } from './MarketDepth'
import type { ResolvedLevel } from './MarketDepth'
import { useOrderStore, DEFAULT_ORDER_FORM } from './store'
import type { MarketSnapshot } from '@/services/types'

// Mock API 模块：真实 submitOrder 集成用例需要可控的成功响应
// （auto-mock 同时覆盖 contracts/market 等对 services/api 的传递导入）
vi.mock('../../services/api')

import { submitOrder as apiSubmitOrder } from '../../services/api'

// 捕获真实 submitOrder：「点价确认闭环」用例会用 submitSpy 覆盖 store action，集成用例需在 beforeEach 恢复
const realSubmitOrder = useOrderStore.getState().submitOrder

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
    preSettlementPrice: 4690,
    upperLimitPrice: 5000,
    lowerLimitPrice: 4500,
    bidPrice1: 4694, bidVolume1: 10,
    bidPrice2: 4693, bidVolume2: 20,
    bidPrice3: 4692, bidVolume3: 30,
    bidPrice4: 4691, bidVolume4: 40,
    bidPrice5: 4690, bidVolume5: 50,
    askPrice1: 4696, askVolume1: 15,
    askPrice2: 4697, askVolume2: 25,
    askPrice3: 4698, askVolume3: 35,
    askPrice4: 4699, askVolume4: 45,
    askPrice5: 4700, askVolume5: 55,
    volume: 5000,
    openInterest: 3000,
    ...overrides,
  } as MarketSnapshot
}

describe('MarketDepth（任务#1：骨架 + 数据接入）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染三列表头 买入/价格/卖出', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('买入')).toBeInTheDocument()
    expect(screen.getByText('价格')).toBeInTheDocument()
    expect(screen.getByText('卖出')).toBeInTheDocument()
  })

  it('渲染 5 卖档 + 5 买档', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`ask-${i}`)).toBeInTheDocument()
      expect(screen.getByTestId(`bid-${i}`)).toBeInTheDocument()
    }
  })

  it('渲染档位价格与数量：卖档卖出列显示卖量、买档买入列显示买量', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    // 卖一~卖五价格（真实档按 tick 0.2 → 1 位小数还原）
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText((4695 + i).toFixed(1))).toBeInTheDocument()
    }
    // 买一~买五价格
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText((4694 - i).toFixed(1))).toBeInTheDocument()
    }
    // 卖档量（卖出列）
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
    // 买档量（买入列）
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('渲染汇总行：委买总量 / 最新价+涨跌 / 委卖总量', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('委买')).toBeInTheDocument()
    expect(screen.getByText('委卖')).toBeInTheDocument()
    // 委买总量 = 10+20+30+40+50
    expect(screen.getByText('150')).toBeInTheDocument()
    // 委卖总量 = 15+25+35+45+55
    expect(screen.getByText('175')).toBeInTheDocument()
    // 最新价（按 tick 0.2 → 1 位小数还原）
    expect(screen.getByText('4695.0')).toBeInTheDocument()
    // 涨跌 = 4695 - 4690 = +5.0（tick 0.2 → 1 位小数）
    expect(screen.getByText('+5.0')).toBeInTheDocument()
  })

  it('卖盘在上、买盘在下：从上到下 ask-5 → ask-1 → bid-1 → bid-5', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    const ladder = screen.getByTestId('depth-ladder')
    const rowTestIds = Array.from(
      ladder.querySelectorAll('[data-testid^="ask-"], [data-testid^="bid-"]'),
    ).map((el) => el.getAttribute('data-testid'))
    expect(rowTestIds[0]).toBe('ask-5')
    expect(rowTestIds[4]).toBe('ask-1')
    expect(rowTestIds[5]).toBe('bid-1')
    expect(rowTestIds[9]).toBe('bid-5')
  })

  describe('priceTick 兜底合成五档', () => {
    it('无真实挂单价时以最新价为基准 ± n×priceTick 合成', () => {
      const snap = makeSnapshot({
        bidPrice1: 0, bidVolume1: 0,
        bidPrice2: 0, bidVolume2: 0,
        bidPrice3: 0, bidVolume3: 0,
        bidPrice4: 0, bidVolume4: 0,
        bidPrice5: 0, bidVolume5: 0,
        askPrice1: 0, askVolume1: 0,
        askPrice2: 0, askVolume2: 0,
        askPrice3: 0, askVolume3: 0,
        askPrice4: 0, askVolume4: 0,
        askPrice5: 0, askVolume5: 0,
      })
      render(<MarketDepth snapshot={snap} priceTick={0.2} />)
      // 基准回退最新价 4695：买一/卖一 = 4695.0，买二 = 4694.8，卖二 = 4695.2
      expect(screen.getAllByText('4695.0').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('4694.8')).toBeInTheDocument() // 买二
      expect(screen.getByText('4694.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4695.2')).toBeInTheDocument() // 卖二
      expect(screen.getByText('4695.8')).toBeInTheDocument() // 卖五
      // 无真实量 → 档位量显示 --
      expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(10)
    })

    it('以真实买一/卖一为基准向外推档位', () => {
      const snap = makeSnapshot({
        bidPrice1: 4694, bidVolume1: 10,
        askPrice1: 4696, askVolume1: 15,
        bidPrice2: 0, bidVolume2: 0,
        bidPrice3: 0, bidVolume3: 0,
        bidPrice4: 0, bidVolume4: 0,
        bidPrice5: 0, bidVolume5: 0,
        askPrice2: 0, askVolume2: 0,
        askPrice3: 0, askVolume3: 0,
        askPrice4: 0, askVolume4: 0,
        askPrice5: 0, askVolume5: 0,
      })
      render(<MarketDepth snapshot={snap} priceTick={0.2} />)
      expect(screen.getByText('4694.0')).toBeInTheDocument() // 买一真实价（tick 还原）
      expect(screen.getByText('4693.8')).toBeInTheDocument() // 买二 = 买一 - 0.2
      expect(screen.getByText('4693.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4696.0')).toBeInTheDocument() // 卖一真实价（tick 还原）
      expect(screen.getByText('4696.2')).toBeInTheDocument() // 卖二 = 卖一 + 0.2
      expect(screen.getByText('4696.8')).toBeInTheDocument() // 卖五
    })
  })

  it('空快照显示空态', () => {
    render(<MarketDepth snapshot={null} priceTick={0.2} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })
})

describe('DepthRow 三列语义（任务#2）', () => {
  // 卖一档：真实有效价 4696 / 量 15
  const level: ResolvedLevel = { price: 4696, volume: 15, valid: true, fallback: null }

  function renderRow(props: Partial<React.ComponentProps<typeof DepthRow>> = {}) {
    const onBuyClick = vi.fn()
    const onSellClick = vi.fn()
    const onPriceClick = vi.fn()
    const view = render(
      <DepthRow
        kind="ask"
        index={1}
        level={level}
        tick={0.2}
        maxVol={55}
        onBuyClick={onBuyClick}
        onSellClick={onSellClick}
        onPriceClick={onPriceClick}
        {...props}
      />,
    )
    return { onBuyClick, onSellClick, onPriceClick, ...view }
  }

  it('买入列点击 → onBuyClick(本档价)，不触发卖单（列语义硬绑定）', () => {
    const { onBuyClick, onSellClick } = renderRow()
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__buy')!)
    expect(onBuyClick).toHaveBeenCalledWith(4696)
    expect(onSellClick).not.toHaveBeenCalled()
  })

  it('卖出列点击 → onSellClick(本档价)，不触发买单', () => {
    const { onBuyClick, onSellClick } = renderRow()
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__sell')!)
    expect(onSellClick).toHaveBeenCalledWith(4696)
    expect(onBuyClick).not.toHaveBeenCalled()
  })

  it('价格列点击 → onPriceClick(本档价)，不触发买/卖（只填改价框，不直接下单）', () => {
    const { onBuyClick, onSellClick, onPriceClick } = renderRow()
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__price')!)
    expect(onPriceClick).toHaveBeenCalledWith(4696)
    expect(onBuyClick).not.toHaveBeenCalled()
    expect(onSellClick).not.toHaveBeenCalled()
  })

  it('完全无效档（无价无兜底）点击不触发任何回调', () => {
    const invalid: ResolvedLevel = { price: 0, volume: 0, valid: false, fallback: null }
    const { onBuyClick, onSellClick, onPriceClick } = renderRow({ level: invalid })
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__buy')!)
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__sell')!)
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__price')!)
    expect(onBuyClick).not.toHaveBeenCalled()
    expect(onSellClick).not.toHaveBeenCalled()
    expect(onPriceClick).not.toHaveBeenCalled()
  })
})

describe('量能条与 -- 占位（任务#2）', () => {
  // 十档最大量 = 50：买 10/20/30/40/50，卖 50/40/30/20/10
  const depthSnap = makeSnapshot({
    bidVolume1: 10, bidVolume2: 20, bidVolume3: 30, bidVolume4: 40, bidVolume5: 50,
    askVolume1: 50, askVolume2: 40, askVolume3: 30, askVolume4: 20, askVolume5: 10,
  })

  it('买档买入列量能条宽度 = 该档量/十档最大量', () => {
    render(<MarketDepth snapshot={depthSnap} priceTick={0.2} />)
    const bid5Buy = screen.getByTestId('bid-5').querySelector('.depth-row__buy') as HTMLElement
    expect(bid5Buy.style.getPropertyValue('--vol-pct')).toBe('100%')
    const bid1Buy = screen.getByTestId('bid-1').querySelector('.depth-row__buy') as HTMLElement
    expect(bid1Buy.style.getPropertyValue('--vol-pct')).toBe('20%')
  })

  it('卖档卖出列量能条宽度 = 该档量/十档最大量', () => {
    render(<MarketDepth snapshot={depthSnap} priceTick={0.2} />)
    const ask1Sell = screen.getByTestId('ask-1').querySelector('.depth-row__sell') as HTMLElement
    expect(ask1Sell.style.getPropertyValue('--vol-pct')).toBe('100%')
    const ask2Sell = screen.getByTestId('ask-2').querySelector('.depth-row__sell') as HTMLElement
    expect(ask2Sell.style.getPropertyValue('--vol-pct')).toBe('80%')
  })

  it('有效档对侧空列（卖档买入列 / 买档卖出列）量能条为 0', () => {
    render(<MarketDepth snapshot={depthSnap} priceTick={0.2} />)
    const ask1Buy = screen.getByTestId('ask-1').querySelector('.depth-row__buy') as HTMLElement
    expect(ask1Buy.style.getPropertyValue('--vol-pct')).toBe('0%')
  })

  it('无量占位 -- 弱化为次级灰（depth-row__muted）', () => {
    // 合成档：无真实挂单价 → 所有量显示 --，应 muted
    const snap = makeSnapshot({
      bidPrice1: 0, bidVolume1: 0,
      bidPrice2: 0, bidVolume2: 0,
      bidPrice3: 0, bidVolume3: 0,
      bidPrice4: 0, bidVolume4: 0,
      bidPrice5: 0, bidVolume5: 0,
      askPrice1: 0, askVolume1: 0,
      askPrice2: 0, askVolume2: 0,
      askPrice3: 0, askVolume3: 0,
      askPrice4: 0, askVolume4: 0,
      askPrice5: 0, askVolume5: 0,
    })
    render(<MarketDepth snapshot={snap} priceTick={0.2} />)
    const bid1Buy = screen.getByTestId('bid-1').querySelector('.depth-row__buy')
    expect(bid1Buy!.className).toContain('depth-row__muted')
    const ask1Sell = screen.getByTestId('ask-1').querySelector('.depth-row__sell')
    expect(ask1Sell!.className).toContain('depth-row__muted')
  })
})

describe('QuickTradeBar（任务#3）', () => {
  // 对手价=卖一 4696，涨跌停 4700/4690
  const snap = makeSnapshot({
    lastPrice: 4695,
    askPrice1: 4696,
    upperLimitPrice: 4700,
    lowerLimitPrice: 4690,
  })

  function renderBar(
    overrides: {
      volume?: number
      onBuy?: () => void
      onSell?: () => void
      value?: number
      onChangePrice?: () => void
    } = {},
  ) {
    const onBuy = overrides.onBuy ?? vi.fn()
    const onSell = overrides.onSell ?? vi.fn()
    const onChangePrice = overrides.onChangePrice ?? vi.fn()
    const view = render(
      <QuickTradeBar
        snapshot={snap}
        priceTick={0.2}
        volume={overrides.volume ?? 2}
        value={overrides.value ?? 4696}
        onChangePrice={onChangePrice}
        onBuy={onBuy}
        onSell={onSell}
      />,
    )
    return { onBuy, onSell, onChangePrice, ...view }
  }

  it('显示改价框当前价，按 tick 精度格式化', () => {
    renderBar()
    expect((screen.getByTestId('qtb-price') as HTMLInputElement).value).toBe('4696.0')
  })

  it('▲ 步进 +tick、▼ 步进 -tick', () => {
    renderBar()
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    fireEvent.click(screen.getByTestId('qtb-step-up'))
    expect(input.value).toBe('4696.2')
    fireEvent.click(screen.getByTestId('qtb-step-down'))
    fireEvent.click(screen.getByTestId('qtb-step-down'))
    expect(input.value).toBe('4695.8')
  })

  it('输入超过涨停价 → 提交后夹紧到涨停价', () => {
    renderBar()
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4705' } })
    fireEvent.blur(input)
    expect(input.value).toBe('4700.0')
  })

  it('输入低于跌停价 → 提交后夹紧到跌停价', () => {
    renderBar()
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4680' } })
    fireEvent.blur(input)
    expect(input.value).toBe('4690.0')
  })

  it('输入非 tick 整数倍 → 提交后对齐到 tick', () => {
    renderBar()
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4696.55' } })
    fireEvent.blur(input)
    expect(input.value).toBe('4696.6')
  })

  it('买入/卖出按钮文字随手数联动', () => {
    renderBar({ volume: 2 })
    expect(screen.getByText('买入2手')).toBeInTheDocument()
    expect(screen.getByText('卖出2手')).toBeInTheDocument()
  })

  it('点买入 → onBuy(改价框价格)；点卖出 → onSell(改价框价格)', () => {
    const onBuy = vi.fn()
    const onSell = vi.fn()
    renderBar({ onBuy, onSell })
    fireEvent.click(screen.getByTestId('qtb-buy'))
    expect(onBuy).toHaveBeenCalledWith(4696)
    fireEvent.click(screen.getByTestId('qtb-sell'))
    expect(onSell).toHaveBeenCalledWith(4696)
  })

  it('手数 < 1 时买卖按钮禁用', () => {
    renderBar({ volume: 0 })
    expect(screen.getByTestId('qtb-buy')).toBeDisabled()
    expect(screen.getByTestId('qtb-sell')).toBeDisabled()
  })

  it('快照为空时输入框与按钮禁用', () => {
    render(
      <QuickTradeBar
        snapshot={null}
        priceTick={0.2}
        volume={2}
        value={0}
        onChangePrice={vi.fn()}
        onBuy={vi.fn()}
        onSell={vi.fn()}
      />,
    )
    expect(screen.getByTestId('qtb-price')).toBeDisabled()
    expect(screen.getByTestId('qtb-buy')).toBeDisabled()
    expect(screen.getByTestId('qtb-sell')).toBeDisabled()
  })

  it('步进/提交后通过 onChangePrice 上报对齐夹紧后的价格', () => {
    const onChangePrice = vi.fn()
    renderBar({ onChangePrice, value: 4696 })
    fireEvent.click(screen.getByTestId('qtb-step-up'))
    expect(onChangePrice).toHaveBeenCalledWith(4696.2)
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4705' } })
    fireEvent.blur(input)
    expect(onChangePrice).toHaveBeenCalledWith(4700)
  })
})

describe('点价确认闭环（任务#5）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 恢复真实 submitOrder（本 describe 的用例会用 submitSpy 覆盖 store action）
    useOrderStore.setState({ submitOrder: realSubmitOrder })
    useOrderStore.setState({
      orderForm: {
        ...DEFAULT_ORDER_FORM,
        instrumentID: 'IF2608',
        exchangeID: 'CFFEX',
        volumeTotalOriginal: 3,
        combOffsetFlag: 'open',
        timeCondition: 'gfd',
        combHedgeFlag: 'speculation',
      },
    })
  })

  it('改价框默认显示对手价（卖一）', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    expect((screen.getByTestId('qtb-price') as HTMLInputElement).value).toBe('4696.0')
  })

  it('点买档买入列 → 弹确认框，展示 方向/价格/手数/开平', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('bid-1').querySelector('.depth-row__buy')!)
    const dialog = within(screen.getByTestId('confirm-dialog'))
    expect(screen.getByText('确认报单')).toBeInTheDocument()
    expect(dialog.getByText('买入')).toBeInTheDocument()
    expect(dialog.getByText('4694.0')).toBeInTheDocument() // 本档价
    expect(dialog.getByText('3')).toBeInTheDocument() // 手数
    expect(dialog.getByText('开')).toBeInTheDocument() // 开平
  })

  it('点卖档卖出列 → 确认框方向为 卖出，价格为本档卖价', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('ask-2').querySelector('.depth-row__sell')!)
    const dialog = within(screen.getByTestId('confirm-dialog'))
    expect(dialog.getByText('卖出')).toBeInTheDocument()
    expect(dialog.getByText('4697.0')).toBeInTheDocument()
  })

  it('确认 → 提交报单（方向 buy + 本档价 + 当前手数）', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('bid-1').querySelector('.depth-row__buy')!)
    fireEvent.click(screen.getByText('确认执行'))
    await act(async () => {})
    expect(submitSpy).toHaveBeenCalledTimes(1)
    const form = useOrderStore.getState().orderForm
    expect(form.direction).toBe('buy')
    expect(form.limitPrice).toBe(4694)
    expect(form.volumeTotalOriginal).toBe(3)
  })

  it('连续两单：真实 submitOrder 第一单成功后保留合约/手数，第二单仍能发起（🔴-1 回归）', async () => {
    const apiSubmit = vi.mocked(apiSubmitOrder)
    apiSubmit.mockResolvedValue({ success: true, orderRef: 'ORD-001' })

    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)

    // 第一单：点买一档 → 确认 → 真实 submitOrder 成功
    fireEvent.click(screen.getByTestId('bid-1').querySelector('.depth-row__buy')!)
    fireEvent.click(screen.getByText('确认执行'))
    await act(async () => {})
    expect(apiSubmit).toHaveBeenCalledTimes(1)

    // 成功后保留交易上下文（手数记忆），instrumentID 未被清空
    const formAfterFirst = useOrderStore.getState().orderForm
    expect(formAfterFirst.instrumentID).toBe('IF2608')
    expect(formAfterFirst.volumeTotalOriginal).toBe(3)

    // 第二单：再次点价 → 确认框正常弹出 → 确认 → 仍成功（不再「请选择合约」）
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__buy')!)
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('确认执行'))
    await act(async () => {})
    expect(apiSubmit).toHaveBeenCalledTimes(2)
    // 第二单以当前弹窗合约 + 档位价发起（instrumentID 未因第一单重置而清空）
    expect(apiSubmit.mock.calls[1][0].instrumentID).toBe('IF2608')
    expect(apiSubmit.mock.calls[1][0].limitPrice).toBe(4696)
  })

  it('取消 → 不提交，确认框关闭', () => {
    const submitSpy = vi.fn().mockResolvedValue(true)
    useOrderStore.setState({ submitOrder: submitSpy as () => Promise<boolean> })
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('ask-1').querySelector('.depth-row__sell')!)
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('取消'))
    expect(submitSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('价格列点击 → 不弹确认框（不直接下单），改价框同步该价', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('ask-2').querySelector('.depth-row__price')!)
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect((screen.getByTestId('qtb-price') as HTMLInputElement).value).toBe('4697.0')
  })

  it('改价后行情 tick 更新不覆写改价框（🟡-1：仅首帧/合约变更跟随默认价）', () => {
    const { rerender } = render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    const input = screen.getByTestId('qtb-price') as HTMLInputElement
    expect(input.value).toBe('4696.0') // 初始默认对手价（卖一）

    // 价格列点击改价 → 4697
    fireEvent.click(screen.getByTestId('ask-2').querySelector('.depth-row__price')!)
    expect(input.value).toBe('4697.0')

    // 行情 tick 更新（卖一/最新价变化，同合约）→ 不覆写用户改价
    rerender(<MarketDepth snapshot={makeSnapshot({ askPrice1: 4700, lastPrice: 4699 })} priceTick={0.2} />)
    expect(input.value).toBe('4697.0')

    // 切换合约 → 重新跟随新合约默认对手价
    rerender(
      <MarketDepth
        snapshot={makeSnapshot({ instrumentID: 'IF2609', askPrice1: 4800, lastPrice: 4799 })}
        priceTick={0.2}
      />,
    )
    expect(input.value).toBe('4800.0')
  })

  it('QuickTradeBar 买入 → 弹确认框（改价框价格 + 当前手数）', () => {
    render(<MarketDepth snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('qtb-buy'))
    const dialog = within(screen.getByTestId('confirm-dialog'))
    expect(dialog.getByText('买入')).toBeInTheDocument()
    expect(dialog.getByText('4696.0')).toBeInTheDocument()
    expect(dialog.getByText('3')).toBeInTheDocument()
  })
})
