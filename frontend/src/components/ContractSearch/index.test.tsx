import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractSearch } from './index'

describe('ContractSearch', () => {
  it('renders search input', () => {
    render(<ContractSearch />)
    expect(screen.getByPlaceholderText('搜索合约...')).toBeInTheDocument()
  })

  it('renders with empty value by default', () => {
    render(<ContractSearch />)
    const input = screen.getByPlaceholderText('搜索合约...') as HTMLInputElement
    expect(input.value).toBe('')
  })
})
