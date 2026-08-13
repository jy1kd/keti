import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfiniteOrderPage } from './InfiniteOrderPage'

vi.mock('@/services/api')
vi.mock('@/components/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useInfiniteOrderStore } from '@/modules/infinite/store'
import { useMarketStore } from '@/modules/market/store'
import type { MarketSnapshot } from '@/services/types'

function makeSnapshot(): MarketSnapshot {
  return {
    instrumentID: 'IF2608', lastPrice: 4695, preSettlementPrice: 4690,
    upperLimitPrice: 4700, lowerLimitPrice: 4690,
    bidPrice1: 4694, bidVolume1: 10, bidPrice2: 0, bidVolume2: 0,
    bidPrice3: 0, bidVolume3: 0, bidPrice4: 0, bidVolume4: 0, bidPrice5: 0, bidVolume5: 0,
    askPrice1: 4696, askVolume1: 15, askPrice2: 0, askVolume2: 0,
    askPrice3: 0, askVolume3: 0, askPrice4: 0, askVolume4: 0, askPrice5: 0, askVolume5: 0,
    volume: 5000, openInterest: 3000,
  } as MarketSnapshot
}

describe('InfiniteOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useInfiniteOrderStore.setState({ instrumentID: '', exchangeID: 'CFFEX' })
    useMarketStore.setState({ snapshots: new Map([['IF2608', makeSnapshot()]]) })
  })

  it('渲染账户栏、参数区、阶梯、右侧功能 tab', () => {
    render(<InfiniteOrderPage instrumentID="IF2608" />)
    expect(screen.getByTestId('infinite-order-page')).toBeInTheDocument()
    expect(screen.getByTestId('account-bar')).toBeInTheDocument()
    expect(screen.getByText('可撤')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '持仓' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '委托' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '成交' })).toBeInTheDocument()
  })
})
