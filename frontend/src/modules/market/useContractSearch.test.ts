import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContractSearch } from './useContractSearch'
import type { ContractInfo } from '@/services/types'

describe('useContractSearch', () => {
  const mockContracts: ContractInfo[] = [
    { instrumentID: 'IF2608', instrumentName: '沪深300', exchangeID: 'CFFEX', productID: 'IF', volumeMultiple: 300, priceTick: 0.2, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
    { instrumentID: 'IC2608', instrumentName: '中证500', exchangeID: 'CFFEX', productID: 'IC', volumeMultiple: 200, priceTick: 0.2, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
    { instrumentID: 'au2608', instrumentName: '黄金2608', exchangeID: 'SHFE', productID: 'au', volumeMultiple: 1000, priceTick: 0.02, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
    { instrumentID: 'ag2608', instrumentName: '白银2608', exchangeID: 'SHFE', productID: 'ag', volumeMultiple: 15, priceTick: 1, expireDate: '2026-08-15', isTrading: 1, productClass: '1' },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态：无搜索关键词，返回所有合约', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))
    expect(result.current.query).toBe('')
    expect(result.current.filteredContracts).toEqual(mockContracts)
  })

  it('输入关键词后过滤合约（按合约代码）', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('IF')
    })

    // 300ms 防抖
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toHaveLength(1)
    expect(result.current.filteredContracts[0].instrumentID).toBe('IF2608')
  })

  it('输入关键词后过滤合约（按合约名称）', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('黄金')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toHaveLength(1)
    expect(result.current.filteredContracts[0].instrumentName).toBe('黄金2608')
  })

  it('输入关键词后过滤合约（按品种代码）', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('au')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // au2608 匹配 instrumentID 和 productID
    expect(result.current.filteredContracts).toHaveLength(1)
    expect(result.current.filteredContracts[0].instrumentID).toBe('au2608')
  })

  it('搜索不区分大小写', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('if')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toHaveLength(1)
    expect(result.current.filteredContracts[0].instrumentID).toBe('IF2608')
  })

  it('300ms 防抖正常工作', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('IF')
    })

    // 200ms 时还未执行搜索
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.filteredContracts).toEqual(mockContracts)

    // 300ms 时执行搜索
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.filteredContracts).toHaveLength(1)
  })

  it('清空搜索关键词后返回所有合约', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('IF')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toHaveLength(1)

    act(() => {
      result.current.setQuery('')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toEqual(mockContracts)
  })

  it('无匹配时返回空数组', () => {
    const { result } = renderHook(() => useContractSearch(mockContracts))

    act(() => {
      result.current.setQuery('不存在的合约')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredContracts).toHaveLength(0)
  })
})
