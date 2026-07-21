import { useEffect } from 'react'

interface UseHotKeysOptions {
  onBuy?: () => void
  onSell?: () => void
  onCancelAll?: () => void
  enabled: boolean
}

const KEY_MAP: Record<string, keyof UseHotKeysOptions> = {
  b: 'onBuy',
  B: 'onBuy',
  s: 'onSell',
  S: 'onSell',
  c: 'onCancelAll',
  C: 'onCancelAll',
}

export function useHotKeys({ onBuy, onSell, onCancelAll, enabled }: UseHotKeysOptions) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Don't fire with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const action = KEY_MAP[e.key]
      if (!action) return

      e.preventDefault()

      if (action === 'onBuy') onBuy?.()
      if (action === 'onSell') onSell?.()
      if (action === 'onCancelAll') onCancelAll?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onBuy, onSell, onCancelAll])
}
