import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractQuery } from './ContractQuery'

vi.mock('../../services/api', () => ({
  getContracts: vi.fn(),
}))

import { getContracts } from '../../services/api'
const mockGetContracts = vi.mocked(getContracts)

describe('ContractQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockGetContracts.mockReturnValue(new Promise(() => {})) // never resolves
    render(<ContractQuery instrumentID="IF2608" />)
    expect(screen.getByText('加载中…')).toBeInTheDocument()
  })

  it('renders empty state when no instrumentID', () => {
    render(<ContractQuery instrumentID="" />)
    expect(screen.getByText('请在行情面板选择合约查看详情')).toBeInTheDocument()
  })

  it('renders contract info after load', async () => {
    mockGetContracts.mockResolvedValue({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300股指期货2608', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260821', isTrading: true },
      ],
      count: 1,
    })

    render(<ContractQuery instrumentID="IF2608" />)

    expect(await screen.findByText('IF2608')).toBeInTheDocument()
    expect(screen.getByText('沪深300股指期货2608')).toBeInTheDocument()
    expect(screen.getByText('CFFEX')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.getByText('0.2')).toBeInTheDocument()
  })

  it('renders error state on API failure', async () => {
    mockGetContracts.mockRejectedValue(new Error('network'))

    render(<ContractQuery instrumentID="IF2608" />)

    expect(await screen.findByText('加载失败')).toBeInTheDocument()
  })

  it('renders not found when contract does not exist', async () => {
    mockGetContracts.mockResolvedValue({ contracts: [], count: 0 })

    render(<ContractQuery instrumentID="INVALID" />)

    expect(await screen.findByText('未找到合约 INVALID')).toBeInTheDocument()
  })

  it('renders with contract-query class', async () => {
    mockGetContracts.mockResolvedValue({
      contracts: [
        { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '20260821', isTrading: true },
      ],
      count: 1,
    })

    const { container } = render(<ContractQuery instrumentID="IF2608" />)
    expect(container.firstChild).toHaveClass('contract-query')
    // Wait for data to load
    await screen.findByText('沪深300')
    expect(container.firstChild).toHaveClass('contract-query')
  })
})
