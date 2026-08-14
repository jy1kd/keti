import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuoteStatsBar } from './QuoteStatsBar'
import { useMarketStore } from '@/modules/market/store'
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
    volume: 86120,
    openInterest: 128940,
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

describe('QuoteStatsBar', () => {
  beforeEach(() => {
    useMarketStore.setState({ snapshots: new Map() })
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      isLoaded: true,
    })
  })

  it('渲染 今开/昨结/最高/最低/成交量/持仓量 六项', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<QuoteStatsBar instrumentID="IF2608" />)
    const bar = screen.getByTestId('quote-stats-bar')
    expect(bar).toBeInTheDocument()
    ;['今开', '昨结', '最高', '最低', '成交量', '持仓量'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('价格按 priceTick 精度显示，成交量/持仓量千分位', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<QuoteStatsBar instrumentID="IF2608" />)
    expect(screen.getByTestId('qs-今开').textContent).toBe('4680.0')
    expect(screen.getByTestId('qs-昨结').textContent).toBe('4690.0')
    expect(screen.getByTestId('qs-成交量').textContent).toBe('86,120')
    expect(screen.getByTestId('qs-持仓量').textContent).toBe('128,940')
  })

  it('涨跌着色：最高 up（红）、最低 down（绿）、今开/昨结中性', () => {
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<QuoteStatsBar instrumentID="IF2608" />)
    expect(screen.getByTestId('qs-最高').className).toContain('quote-stats-bar__value--up')
    expect(screen.getByTestId('qs-最低').className).toContain('quote-stats-bar__value--down')
    expect(screen.getByTestId('qs-今开').className).toContain('quote-stats-bar__value--flat')
    expect(screen.getByTestId('qs-昨结').className).toContain('quote-stats-bar__value--flat')
  })

  it('无快照时全部显示 — 占位', () => {
    render(<QuoteStatsBar instrumentID="IF2608" />)
    ;['今开', '昨结', '最高', '最低', '成交量', '持仓量'].forEach((label) => {
      expect(screen.getByTestId(`qs-${label}`).textContent).toBe('--')
    })
  })

  it('快照无 priceTick 时按默认 0.2 精度（期权等取合约价）', () => {
    // 无合约匹配 → priceTick 默认 0.2
    useContractsStore.setState({ contracts: [], isLoaded: true })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<QuoteStatsBar instrumentID="IF2608" />)
    expect(screen.getByTestId('qs-今开').textContent).toBe('4680.0')
  })
})
