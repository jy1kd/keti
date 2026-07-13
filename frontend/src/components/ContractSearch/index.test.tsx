import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractSearch } from './index'
import type { ContractInfo } from '@/services/types'

describe('ContractSearch', () => {
  const mockContracts: ContractInfo[] = [
    { instrumentID: 'au2508', instrumentName: '黄金2508', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2025-08-15', isTrading: true },
    { instrumentID: 'ag2508', instrumentName: '白银2508', exchangeID: 'SHFE', productID: 'ag', volumeMultiple: 15, priceTick: 1, expireDate: '2025-08-15', isTrading: true },
    { instrumentID: 'cu2508', instrumentName: '铜2508', exchangeID: 'SHFE', productID: 'cu', volumeMultiple: 5, priceTick: 10, expireDate: '2025-08-15', isTrading: true },
    { instrumentID: 'rb2508', instrumentName: '螺纹钢2508', exchangeID: 'SHFE', productID: 'rb', volumeMultiple: 10, priceTick: 1, expireDate: '2025-08-15', isTrading: true },
  ]

  it('renders search input', () => {
    render(<ContractSearch contracts={[]} />)
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
  })

  it('renders with empty value by default', () => {
    render(<ContractSearch contracts={[]} />)
    const input = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('shows matching contracts when typing', () => {
    render(<ContractSearch contracts={mockContracts} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'au' } })
    expect(screen.getByText('au2508')).toBeInTheDocument()
    expect(screen.queryByText('ag2508')).not.toBeInTheDocument()
  })

  it('filters by instrumentName too', () => {
    render(<ContractSearch contracts={mockContracts} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: '黄金' } })
    expect(screen.getByText('au2508')).toBeInTheDocument()
    expect(screen.queryByText('ag2508')).not.toBeInTheDocument()
  })

  it('is case insensitive', () => {
    render(<ContractSearch contracts={mockContracts} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'AU' } })
    expect(screen.getByText('au2508')).toBeInTheDocument()
  })

  it('shows no results message when no match', () => {
    render(<ContractSearch contracts={mockContracts} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'xyz' } })
    expect(screen.getByText('无匹配合约')).toBeInTheDocument()
  })

  it('calls onSelect when contract mousedown', () => {
    const onSelect = vi.fn()
    render(<ContractSearch contracts={mockContracts} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'au' } })
    fireEvent.mouseDown(screen.getByText('au2508'))
    expect(onSelect).toHaveBeenCalledWith('au2508')
  })

  it('clears input after selection', () => {
    const onSelect = vi.fn()
    render(<ContractSearch contracts={mockContracts} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'au' } })
    fireEvent.mouseDown(screen.getByText('au2508'))
    expect(input.value).toBe('')
  })

  it('hides results after selection', () => {
    const onSelect = vi.fn()
    render(<ContractSearch contracts={mockContracts} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('搜索合约...')
    fireEvent.change(input, { target: { value: 'au' } })
    fireEvent.mouseDown(screen.getByText('au2508'))
    expect(screen.queryByText('au2508')).not.toBeInTheDocument()
  })
})
