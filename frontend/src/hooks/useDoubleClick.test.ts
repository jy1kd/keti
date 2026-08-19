import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDoubleClick } from './useDoubleClick'

describe('useDoubleClick', () => {
  it('fires onClick after interval when single click', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDoubleClick(300))
    const onClick = vi.fn()
    const onDouble = vi.fn()
    const handler = result.current.register(onClick, onDouble)
    act(() => handler())
    expect(onClick).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onDouble).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('fires onDouble instead of onClick on double click', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDoubleClick(300))
    const onClick = vi.fn()
    const onDouble = vi.fn()
    const handler = result.current.register(onClick, onDouble)
    act(() => handler())
    act(() => handler())
    expect(onClick).not.toHaveBeenCalled()
    expect(onDouble).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
