import { useEffect, useMemo } from 'react'
import type { HotKeyConfig } from '../services/types'

const DEFAULT_KEYS: HotKeyConfig = {
  buy: 'b',
  sell: 's',
  cancel: 'c',
}

interface UseHotKeysOptions {
  onBuy?: () => void
  onSell?: () => void
  onCancelAll?: () => void
  enabled: boolean
  hotKeys?: HotKeyConfig
}

type ActionKey = 'buy' | 'sell' | 'cancel'

export function useHotKeys({
  onBuy,
  onSell,
  onCancelAll,
  enabled,
  hotKeys,
}: UseHotKeysOptions) {
  const effectiveKeys: HotKeyConfig = useMemo(
    () => hotKeys ?? DEFAULT_KEYS,
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
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, keyToAction, onBuy, onSell, onCancelAll])
}
