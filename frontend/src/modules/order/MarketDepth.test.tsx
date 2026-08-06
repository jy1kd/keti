import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketDepth, DepthRow, QuickTradeBar } from './MarketDepth'
import type { ResolvedLevel } from './MarketDepth'
import type { MarketSnapshot } from '@/services/types'

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
    // 卖一~卖五价格
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(4695 + i))).toBeInTheDocument()
    }
    // 买一~买五价格
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(String(4694 - i))).toBeInTheDocument()
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
    // 最新价
    expect(screen.getByText('4695')).toBeInTheDocument()
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
      expect(screen.getByText('4694')).toBeInTheDocument() // 买一真实价
      expect(screen.getByText('4693.8')).toBeInTheDocument() // 买二 = 买一 - 0.2
      expect(screen.getByText('4693.2')).toBeInTheDocument() // 买五
      expect(screen.getByText('4696')).toBeInTheDocument() // 卖一真实价
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

  function renderBar(overrides: { volume?: number; onBuy?: () => void; onSell?: () => void } = {}) {
    const onBuy = overrides.onBuy ?? vi.fn()
    const onSell = overrides.onSell ?? vi.fn()
    const view = render(
      <QuickTradeBar
        snapshot={snap}
        priceTick={0.2}
        volume={overrides.volume ?? 2}
        onBuy={onBuy}
        onSell={onSell}
      />,
    )
    return { onBuy, onSell, ...view }
  }

  it('默认显示对手价（卖一价），按 tick 精度格式化', () => {
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
      <QuickTradeBar snapshot={null} priceTick={0.2} volume={2} onBuy={vi.fn()} onSell={vi.fn()} />,
    )
    expect(screen.getByTestId('qtb-price')).toBeDisabled()
    expect(screen.getByTestId('qtb-buy')).toBeDisabled()
    expect(screen.getByTestId('qtb-sell')).toBeDisabled()
  })
})
