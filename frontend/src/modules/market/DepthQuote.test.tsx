import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DepthQuote } from './DepthQuote'
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
    volume: 5000,
    openInterest: 3000,
    ...overrides,
  } as MarketSnapshot
}

describe('DepthQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders instrument ID in header', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    expect(screen.getByText('IF2608')).toBeInTheDocument()
  })

  it('renders last price in header', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    expect(screen.getByText('4695')).toBeInTheDocument()
  })

  it('renders 5 bid levels with price and volume', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    // 买一到买五的价格
    expect(screen.getByText('4694')).toBeInTheDocument()
    expect(screen.getByText('4693')).toBeInTheDocument()
    expect(screen.getByText('4692')).toBeInTheDocument()
    expect(screen.getByText('4691')).toBeInTheDocument()
    expect(screen.getByText('4690')).toBeInTheDocument()
    // 买一到买五的量
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('renders 5 ask levels with price and volume', () => {
    render(<DepthQuote snapshot={makeSnapshot()} />)
    // 卖一到卖五的价格
    expect(screen.getByText('4696')).toBeInTheDocument()
    expect(screen.getByText('4697')).toBeInTheDocument()
    expect(screen.getByText('4698')).toBeInTheDocument()
    expect(screen.getByText('4699')).toBeInTheDocument()
    expect(screen.getByText('4700')).toBeInTheDocument()
    // 卖一到卖五的量
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('shows placeholder when snapshot is null', () => {
    render(<DepthQuote snapshot={null} />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })
})
