import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionChainGroup } from './OptionChainGroup'
import { useMarketStore } from '@/modules/market/store'
import { OptionGroup } from '@/modules/market/sort'
import { openTQuoteFloating } from '@/utils/openFloatingTab'

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return {
    ...actual,
    getOptionChains: vi.fn().mockResolvedValue({
      chains: [
        {
          underlying: 'FG609',
          expireDate: '20260930',
          calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'FG609-P-1250', strikePrice: 1300, lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
          updateTime: '',
        },
        {
          underlying: 'FG609',
          expireDate: '20261230',
          calls: [{ instrumentID: 'FG609-C-1300', strikePrice: 1300, lastPrice: 10, bidPrice: 9, askPrice: 11, volume: 100, openInterest: 200, impliedVolatility: 0 }],
          puts: [{ instrumentID: 'FG609-P-1250', strikePrice: 1300, lastPrice: 5, bidPrice: 4, askPrice: 6, volume: 50, openInterest: 80, impliedVolatility: 0 }],
          updateTime: '',
        },
      ],
    }),
    getSnapshots: vi.fn().mockResolvedValue({ snapshots: {} }),
  }
})
vi.mock('@/utils/openFloatingTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/openFloatingTab')>()
  return { ...actual, openTQuoteFloating: vi.fn() }
})

const group: OptionGroup = {
  underlyingID: 'FG609',
  underlying: { instrumentID: 'FG609', instrumentName: 'FG609', exchangeID: 'CZCE', productID: 'FG', volumeMultiple: 20, priceTick: 1, expireDate: '20260930', isTrading: 1, productClass: '1' },
  options: [],
}

describe('OptionChainGroup', () => {
  beforeEach(() => {
    useMarketStore.setState({ lockedContracts: new Map(), addLockedContract: vi.fn(), removeLockedContract: vi.fn() })
  })

  it('默认折叠：组头可见、无到期切换条', () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    expect(screen.getByText('FG609')).toBeDefined()
    expect(screen.queryByText(/到期/)).toBeNull()
  })

  it('展开：渲染到期切换条，默认最早到期 20260930', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(screen.getByText('20260930')).toBeDefined()
    expect(screen.queryByText('20261230')).toBeDefined()
  })

  it('展开调用 addLockedContract；折叠调用 removeLockedContract', async () => {
    const { addLockedContract, removeLockedContract } = useMarketStore.getState()
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    expect(addLockedContract).toHaveBeenCalled()
    fireEvent.click(screen.getByText('FG609'))
    expect(removeLockedContract).toHaveBeenCalled()
  })

  it('⇗ 新窗按钮调用 openTQuoteFloating(underlyingID)', async () => {
    render(<OptionChainGroup group={group} onSelectContract={vi.fn()} />)
    fireEvent.click(screen.getByText('FG609'))
    await screen.findByText('20260930')
    fireEvent.click(screen.getByText('⇗ 新窗'))
    expect(openTQuoteFloating).toHaveBeenCalledWith('FG609')
  })
})
