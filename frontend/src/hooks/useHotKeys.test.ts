import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHotKeys } from './useHotKeys'

const KEYS = { openOrder: 'o', openKline: 'k', openSettings: ',', batchCancel: 'Escape' }

describe('useHotKeys', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function fireKey(key: string, ctrlKey = false) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
  }

  it('calls onOpenOrder when O pressed', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('o'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenKline when K pressed', () => {
    const onOpenKline = vi.fn()
    renderHook(() => useHotKeys({ onOpenKline, enabled: true }))
    act(() => fireKey('k'))
    expect(onOpenKline).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenSettings when , pressed', () => {
    const onOpenSettings = vi.fn()
    renderHook(() => useHotKeys({ onOpenSettings, enabled: true }))
    act(() => fireKey(','))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('calls onBatchCancel when Escape pressed', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('Escape'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults when hotKeys not provided', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('Escape'))
    expect(onBatchCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom hotKeys mapping when provided', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true, hotKeys: { ...KEYS, openOrder: 'x' } }))
    act(() => fireKey('x'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire when disabled', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: false }))
    act(() => fireKey('o'))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })

  it('does NOT fire for unknown keys', () => {
    const onBatchCancel = vi.fn()
    renderHook(() => useHotKeys({ onBatchCancel, enabled: true }))
    act(() => fireKey('x'))
    expect(onBatchCancel).not.toHaveBeenCalled()
  })

  it('accepts uppercase keys', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('O'))
    expect(onOpenOrder).toHaveBeenCalledTimes(1)
  })

  it('does not fire when input element focused', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true })) })
    expect(onOpenOrder).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not fire when Ctrl pressed', () => {
    const onOpenOrder = vi.fn()
    renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    act(() => fireKey('o', true))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })

  it('cleans up event listener on unmount', () => {
    const onOpenOrder = vi.fn()
    const { unmount } = renderHook(() => useHotKeys({ onOpenOrder, enabled: true }))
    unmount()
    act(() => fireKey('o'))
    expect(onOpenOrder).not.toHaveBeenCalled()
  })
})
