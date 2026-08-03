import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderQuotePanel } from './OrderQuotePanel'
import { useOrderStore } from './store'
import { useContractsStore } from '@/stores/contracts'
import type { MarketSnapshot } from '@/services/types'

function makeSnapshot(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    instrumentID: 'IF2608',
    lastPrice: 4695,
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
    volume: 20892,
    openInterest: 45105,
    openPrice: 4680,
    highestPrice: 4705,
    lowestPrice: 4675,
    preSettlementPrice: 4690,
    upperLimitPrice: 5100,
    lowerLimitPrice: 4300,
    ...overrides,
  } as MarketSnapshot
}

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

describe('OrderQuotePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrderStore.getState().resetOrderForm()
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      favorites: [],
      isLoaded: true,
    })
  })

  it('渲染合约代码与名称', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    // IF2608 出现在合约头与盘口头两处
    expect(screen.getAllByText('IF2608').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('沪深300')).toBeInTheDocument()
  })

  it('渲染 5 卖档 + 5 买档', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`ask-${i}`)).toBeInTheDocument()
      expect(screen.getByTestId(`bid-${i}`)).toBeInTheDocument()
    }
  })

  it('点击卖一档 → 买入价写入表单', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('ask-1'))
    const form = useOrderStore.getState().orderForm
    expect(form.direction).toBe('buy')
    expect(form.limitPrice).toBe(4696) // askPrice1
  })

  it('点击买一档 → 卖出价写入表单', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    fireEvent.click(screen.getByTestId('bid-1'))
    const form = useOrderStore.getState().orderForm
    expect(form.direction).toBe('sell')
    expect(form.limitPrice).toBe(4694) // bidPrice1
  })

  it('无快照时盘口显示 --、速览显示 —', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={null} priceTick={0.2} />)
    // DepthQuote 空态（两个 ASCII 连字符）
    expect(screen.getByText('--')).toBeInTheDocument()
    // 速览空态（em-dash）
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('速览字段千分位格式化', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('20,892')).toBeInTheDocument()
    expect(screen.getByText('45,105')).toBeInTheDocument()
  })

  it('展示交易所', () => {
    render(<OrderQuotePanel instrumentID="IF2608" snapshot={makeSnapshot()} priceTick={0.2} />)
    expect(screen.getByText('CFFEX')).toBeInTheDocument()
  })
})
