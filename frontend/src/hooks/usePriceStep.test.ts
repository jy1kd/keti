import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePriceStep } from './usePriceStep'

describe('usePriceStep', () => {
  it('stepUp increases price by priceTick', () => {
    const { result } = renderHook(() => usePriceStep(100.0, 0.5))

    act(() => {
      result.current.stepUp()
    })

    expect(result.current.price).toBe(100.5)
  })

  it('stepDown decreases price by priceTick', () => {
    const { result } = renderHook(() => usePriceStep(100.0, 0.5))

    act(() => {
      result.current.stepDown()
    })

    expect(result.current.price).toBe(99.5)
  })

  it('stepDown does not go below 0', () => {
    const { result } = renderHook(() => usePriceStep(0.2, 0.5))

    act(() => {
      result.current.stepDown()
    })

    expect(result.current.price).toBe(0)
  })

  it('stepUp works with larger tick sizes', () => {
    const { result } = renderHook(() => usePriceStep(4800, 0.2))

    act(() => {
      result.current.stepUp()
    })

    expect(result.current.price).toBe(4800.2)
  })

  it('alignToTick rounds to nearest valid tick', () => {
    const { result } = renderHook(() => usePriceStep(100.23, 0.05))

    act(() => {
      result.current.alignToTick(100.23)
    })

    // 100.23 / 0.05 = 2004.6, round = 2005, * 0.05 = 100.25
    expect(result.current.price).toBe(100.25)
  })

  it('alignToTick rounds 100.22 to 100.20 with tick 0.05', () => {
    const { result } = renderHook(() => usePriceStep(100.0, 0.05))

    act(() => {
      result.current.alignToTick(100.22)
    })

    // 100.22 / 0.05 = 2004.4, round = 2004, * 0.05 = 100.20
    expect(result.current.price).toBe(100.20)
  })

  it('reacts to changes in initialPrice prop', () => {
    const { result, rerender } = renderHook(
      ({ price, tick }) => usePriceStep(price, tick),
      { initialProps: { price: 100, tick: 0.1 } }
    )

    expect(result.current.price).toBe(100)

    rerender({ price: 200, tick: 0.1 })
    expect(result.current.price).toBe(200)
  })

  it('returns current price via getter', () => {
    const { result } = renderHook(() => usePriceStep(50, 1))
    expect(result.current.price).toBe(50)
  })
})
