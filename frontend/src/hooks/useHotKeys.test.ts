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

  // ── PR-15: custom key bindings ──────────────────────────────────────

  it('uses custom hotKeys mapping when provided', () => {
    const onBuy = vi.fn()
    const onSell = vi.fn()
    const onCancelAll = vi.fn()

    renderHook(() =>
      useHotKeys({
        onBuy,
        onSell,
        onCancelAll,
        enabled: true,
        hotKeys: { buy: 'x', sell: 'y', cancel: 'z' },
      })
    )

    act(() => {
      fireKey('x')
    })
    expect(onBuy).toHaveBeenCalledTimes(1)
    expect(onSell).not.toHaveBeenCalled()

    act(() => {
      fireKey('y')
    })
    expect(onSell).toHaveBeenCalledTimes(1)

    act(() => {
      fireKey('z')
    })
    expect(onCancelAll).toHaveBeenCalledTimes(1)
  })

  it('falls back to default B/S/C when hotKeys not provided', () => {
    const onBuy = vi.fn()
    const onSell = vi.fn()
    const onCancelAll = vi.fn()

    renderHook(() =>
      useHotKeys({ onBuy, onSell, onCancelAll, enabled: true })
    )

    act(() => {
      fireKey('b')
    })
    expect(onBuy).toHaveBeenCalledTimes(1)

    act(() => {
      fireKey('s')
    })
    expect(onSell).toHaveBeenCalledTimes(1)

    act(() => {
      fireKey('c')
    })
    expect(onCancelAll).toHaveBeenCalledTimes(1)
  })

  it('reacts to hotKeys changes (dynamic key bindings)', () => {
    const onBuy = vi.fn()

    const { rerender } = renderHook(
      ({ hotKeys }) => useHotKeys({ onBuy, enabled: true, hotKeys }),
      { initialProps: { hotKeys: { buy: 'a', sell: 's', cancel: 'c' } } }
    )

    // First with 'a'
    act(() => {
      fireKey('a')
    })
    expect(onBuy).toHaveBeenCalledTimes(1)

    // Switch to 'x'
    rerender({ hotKeys: { buy: 'x', sell: 's', cancel: 'c' } })

    act(() => {
      fireKey('x')
    })
    expect(onBuy).toHaveBeenCalledTimes(2)

    // The old 'a' key should no longer trigger
    act(() => {
      fireKey('a')
    })
    expect(onBuy).toHaveBeenCalledTimes(2)
  })

  it('only triggers handlers that have callbacks set', () => {
    const onBuy = vi.fn()

    renderHook(() =>
      useHotKeys({
        onBuy,
        enabled: true,
        hotKeys: { buy: 'b', sell: 's', cancel: 'c' },
      })
    )

    // 's' is mapped to onSell but onSell callback is not provided
    act(() => {
      fireKey('s')
    })

    // Should not error and should not call onBuy
    expect(onBuy).not.toHaveBeenCalled()
  })
})
