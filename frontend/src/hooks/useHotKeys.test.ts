import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHotKeys } from './useHotKeys'

describe('useHotKeys', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function fireKey(key: string, ctrlKey = false) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
  }

  it('calls onBuy when B key pressed and enabled', () => {
    const onBuy = vi.fn()
    renderHook(() => useHotKeys({ onBuy, enabled: true }))

    act(() => {
      fireKey('b')
    })

    expect(onBuy).toHaveBeenCalledTimes(1)
  })

  it('calls onSell when S key pressed and enabled', () => {
    const onSell = vi.fn()
    renderHook(() => useHotKeys({ onSell, enabled: true }))

    act(() => {
      fireKey('s')
    })

    expect(onSell).toHaveBeenCalledTimes(1)
  })

  it('calls onCancelAll when C key pressed and enabled', () => {
    const onCancelAll = vi.fn()
    renderHook(() => useHotKeys({ onCancelAll, enabled: true }))

    act(() => {
      fireKey('c')
    })

    expect(onCancelAll).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when disabled', () => {
    const onBuy = vi.fn()
    renderHook(() => useHotKeys({ onBuy, enabled: false }))

    act(() => {
      fireKey('b')
    })

    expect(onBuy).not.toHaveBeenCalled()
  })

  it('does NOT fire for unknown keys', () => {
    const onBuy = vi.fn()
    const onSell = vi.fn()
    const onCancelAll = vi.fn()
    renderHook(() => useHotKeys({ onBuy, onSell, onCancelAll, enabled: true }))

    act(() => {
      fireKey('x')
    })

    expect(onBuy).not.toHaveBeenCalled()
    expect(onSell).not.toHaveBeenCalled()
    expect(onCancelAll).not.toHaveBeenCalled()
  })

  it('does not fire when input element is focused (allow normal typing)', () => {
    const onBuy = vi.fn()
    renderHook(() => useHotKeys({ onBuy, enabled: true }))

    // Create an input, focus it, and dispatch the key event on it
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
    })

    expect(onBuy).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('accepts uppercase B/S/C keys', () => {
    const onBuy = vi.fn()
    const onSell = vi.fn()
    const onCancelAll = vi.fn()
    renderHook(() => useHotKeys({ onBuy, onSell, onCancelAll, enabled: true }))

    act(() => {
      fireKey('B')
    })
    act(() => {
      fireKey('S')
    })
    act(() => {
      fireKey('C')
    })

    expect(onBuy).toHaveBeenCalledTimes(1)
    expect(onSell).toHaveBeenCalledTimes(1)
    expect(onCancelAll).toHaveBeenCalledTimes(1)
  })

  it('does not fire when Ctrl+B is pressed (browser shortcut)', () => {
    const onBuy = vi.fn()
    renderHook(() => useHotKeys({ onBuy, enabled: true }))

    act(() => {
      fireKey('b', true)
    })

    expect(onBuy).not.toHaveBeenCalled()
  })

  it('cleans up event listener on unmount', () => {
    const onBuy = vi.fn()
    const { unmount } = renderHook(() => useHotKeys({ onBuy, enabled: true }))

    unmount()

    act(() => {
      fireKey('b')
    })

    expect(onBuy).not.toHaveBeenCalled()
  })
})
