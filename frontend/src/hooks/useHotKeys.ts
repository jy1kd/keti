import { useEffect, useMemo } from 'react'
import type { HotKeyConfig } from '../services/types'
import { DEFAULT_HOT_KEYS } from '../stores/userPrefs'

interface UseHotKeysOptions {
  onOpenOrder?: () => void
  onOpenKline?: () => void
  onOpenSettings?: () => void
  onBatchCancel?: () => void
  enabled: boolean
  hotKeys?: HotKeyConfig
}

type ActionKey = 'openOrder' | 'openKline' | 'openSettings' | 'batchCancel'

export function useHotKeys({
  onOpenOrder,
  onOpenKline,
  onOpenSettings,
  onBatchCancel,
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
        // Also register the raw key so mixed-case keys (e.g. 'Escape',
        // whose KeyboardEvent.key is 'Escape', not 'escape'/'ESCAPE') match.
        map[key] = action as ActionKey
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

      if (action === 'openOrder') onOpenOrder?.()
      if (action === 'openKline') onOpenKline?.()
      if (action === 'openSettings') onOpenSettings?.()
      if (action === 'batchCancel') onBatchCancel?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, keyToAction, onOpenOrder, onOpenKline, onOpenSettings, onBatchCancel])
}
