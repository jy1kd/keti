import { useEffect, useMemo } from 'react'
import type { HotKeyConfig } from '../services/types'
import { DEFAULT_HOT_KEYS } from '../stores/userPrefs'

interface UseHotKeysOptions {
  onBuy?: () => void
  onSell?: () => void
  onCancelAll?: () => void
  onReverse?: () => void
  onLock?: () => void
  onBatchCancel?: () => void
  onOpenOrder?: () => void
  onOpenKline?: () => void
  onOpenSettings?: () => void
  enabled: boolean
  hotKeys?: HotKeyConfig
}

type ActionKey = 'buy' | 'sell' | 'cancel' | 'reverse' | 'lock' | 'batchCancel' | 'openOrder' | 'openKline' | 'openSettings'

export function useHotKeys({
  onBuy,
  onSell,
  onCancelAll,
  onReverse,
  onLock,
  onBatchCancel,
  onOpenOrder,
  onOpenKline,
  onOpenSettings,
  enabled,
  hotKeys,
}: UseHotKeysOptions) {
  // Merge with defaults so partial hotKeys fall back
  const effectiveKeys: HotKeyConfig = useMemo(
    () => (hotKeys ? { ...DEFAULT_HOT_KEYS, ...hotKeys } : DEFAULT_HOT_KEYS),
    [hotKeys]
  )

  // Build key → action mapping from effective keys
  const keyToAction = useMemo(() => {
    const map: Record<string, ActionKey> = {}
    for (const [action, key] of Object.entries(effectiveKeys)) {
      if (key) {
        map[key.toLowerCase()] = action as ActionKey
        map[key.toUpperCase()] = action as ActionKey
      }
    }
    return map
  }, [effectiveKeys])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Don't fire with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const action = keyToAction[e.key]
      if (!action) return

      e.preventDefault()

      if (action === 'buy') onBuy?.()
      if (action === 'sell') onSell?.()
      if (action === 'cancel') onCancelAll?.()
      if (action === 'reverse') onReverse?.()
      if (action === 'lock') onLock?.()
      if (action === 'batchCancel') onBatchCancel?.()
      if (action === 'openOrder') onOpenOrder?.()
      if (action === 'openKline') onOpenKline?.()
      if (action === 'openSettings') onOpenSettings?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, keyToAction, onBuy, onSell, onCancelAll, onReverse, onLock, onBatchCancel, onOpenOrder, onOpenKline, onOpenSettings])
}
