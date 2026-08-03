import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderPopup } from './OrderPopup'
import { useOrderPopupStore } from './popupStore'
import { useOrderStore } from './store'
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

describe('OrderPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrderPopupStore.setState({ instrumentID: null })
    useOrderStore.getState().resetOrderForm()
    useContractsStore.setState({
      contracts: [IF2608_CONTRACT],
      favorites: [],
      isLoaded: true,
    })
    useMarketStore.setState({ snapshots: new Map() })
  })

  it('弹窗关闭时不渲染', () => {
    const { container } = render(<OrderPopup />)
    expect(container.firstChild).toBeNull()
  })

  it('打开后渲染标题、表单与盘口', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    expect(screen.getByText('📝 报单-IF2608')).toBeInTheDocument()
    expect(screen.getByText(/买入 IF2608/)).toBeInTheDocument()
    expect(screen.getByTestId('ask-1')).toBeInTheDocument()
    expect(screen.getByTestId('bid-1')).toBeInTheDocument()
  })

  it('打开后表单合约同步为弹窗合约', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    expect(useOrderStore.getState().orderForm.instrumentID).toBe('IF2608')
  })

  it('点击 × 关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.click(screen.getByLabelText('关闭报单弹窗'))
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('按 ESC 关闭弹窗', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    render(<OrderPopup />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('点击盘口卖一档回填买入价', () => {
    useOrderPopupStore.setState({ instrumentID: 'IF2608' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
    render(<OrderPopup />)
    fireEvent.click(screen.getByTestId('ask-1'))
    const form = useOrderStore.getState().orderForm
    expect(form.direction).toBe('buy')
    expect(form.limitPrice).toBe(4696)
  })
})
