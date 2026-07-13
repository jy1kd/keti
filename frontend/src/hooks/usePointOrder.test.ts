import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePointOrder } from './usePointOrder'

describe('usePointOrder', () => {
  it('returns handler functions', () => {
    const { result } = renderHook(() => usePointOrder())
    expect(typeof result.current.handleClick).toBe('function')
    expect(typeof result.current.handleDoubleClick).toBe('function')
  })

  it('handleClick calls onOrder callback with instrument and price', () => {
    const onOrder = vi.fn()
    const { result } = renderHook(() => usePointOrder({ onOrder }))

    act(() => {
      result.current.handleClick('au2508', 480.5)
    })

    expect(onOrder).toHaveBeenCalledWith({
      instrumentID: 'au2508',
      price: 480.5,
    })
  })

  it('handleDoubleClick calls onFill callback with instrument and price', () => {
    const onFill = vi.fn()
    const { result } = renderHook(() => usePointOrder({ onFill }))

    act(() => {
      result.current.handleDoubleClick('au2508', 480.5)
    })

    expect(onFill).toHaveBeenCalledWith({
      instrumentID: 'au2508',
      price: 480.5,
    })
  })

  it('handleClick does nothing when onOrder not provided', () => {
    const { result } = renderHook(() => usePointOrder())
    // should not throw
    act(() => {
      result.current.handleClick('au2508', 480.5)
    })
  })

  it('handleDoubleClick does nothing when onFill not provided', () => {
    const { result } = renderHook(() => usePointOrder())
    act(() => {
      result.current.handleDoubleClick('au2508', 480.5)
    })
  })
})
