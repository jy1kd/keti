import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderTrigger } from './useOrderTrigger'
import { useUserPrefsStore, DEFAULT_ORDER_TRIGGER } from '@/stores/userPrefs'

describe('useOrderTrigger', () => {
  beforeEach(() => {
    useUserPrefsStore.setState({ orderTrigger: { ...DEFAULT_ORDER_TRIGGER } })
  })

  it('returns default orderTrigger config', () => {
    const { result } = renderHook(() => useOrderTrigger())
    expect(result.current).toEqual({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('re-renders with updated store value', () => {
    const { result } = renderHook(() => useOrderTrigger())
    act(() => {
      useUserPrefsStore.getState().setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    })
    expect(result.current).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
  })
})
