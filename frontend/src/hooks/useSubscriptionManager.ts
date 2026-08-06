import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { subscribeMarket, unsubscribeMarket } from '@/services/api'

/** subscribe 防抖间隔（毫秒） */
const SUB_DEBOUNCE_MS = 100
/** unsubscribe 防抖间隔（毫秒） */
const UNSUB_DEBOUNCE_MS = 500
/** 延迟退订宽限期（毫秒） */
const GRACE_MS = 30_000

export function useSubscriptionManager() {
  const visibleInstrumentIDs = useMarketStore((s) => s.visibleInstrumentIDs)
  const lockedContracts = useMarketStore((s) => s.lockedContracts)
  const favorites = useContractsStore((s) => s.favorites)

  /** 已订阅合约 → 最近可见时间戳（ms） */
  const subscribedRef = useRef<Map<string, number>>(new Map())
  const subTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calculateShouldSubscribe = useCallback((): Set<string> => {
    const shouldSubscribe = new Set<string>()
    for (const id of visibleInstrumentIDs) shouldSubscribe.add(id)
    for (const fav of favorites) shouldSubscribe.add(fav.instrumentID)
    for (const id of lockedContracts.keys()) shouldSubscribe.add(id)
    return shouldSubscribe
  }, [visibleInstrumentIDs, favorites, lockedContracts])

  /** 立即订阅缺失合约（subscribe 防抖 100ms） */
  const debouncedSubscribe = useCallback(() => {
    if (subTimerRef.current) clearTimeout(subTimerRef.current)
    subTimerRef.current = setTimeout(() => {
      const should = calculateShouldSubscribe()
      const toSubscribe: string[] = []
      for (const id of should) {
        if (!subscribedRef.current.has(id)) toSubscribe.push(id)
      }
      if (toSubscribe.length === 0) return
      subscribeMarket(toSubscribe)
        .then(() => {
          for (const id of toSubscribe) subscribedRef.current.set(id, Date.now())
        })
        .catch((err) => console.error('[SubscriptionManager] Subscribe failed:', err))
    }, SUB_DEBOUNCE_MS)
  }, [calculateShouldSubscribe])

  /** 延迟退订：仅当合约不在应该订阅集合 且 超过宽限期未可见 */
  const debouncedUnsubscribe = useCallback(() => {
    if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)

    const runCheck = () => {
      const should = calculateShouldSubscribe()
      const now = Date.now()
      const toUnsubscribe: string[] = []
      // 仍在宽限期内的合约，记录最早到期的剩余时间，用于下次检查
      let nextCheckIn: number | null = null
      for (const [id, lastVisible] of subscribedRef.current) {
        if (should.has(id)) continue
        const elapsed = now - lastVisible
        if (elapsed > GRACE_MS) {
          toUnsubscribe.push(id)
        } else {
          const remaining = GRACE_MS - elapsed + 1
          if (nextCheckIn === null || remaining < nextCheckIn) nextCheckIn = remaining
        }
      }
      if (toUnsubscribe.length > 0) {
        unsubscribeMarket(toUnsubscribe)
          .then(() => {
            for (const id of toUnsubscribe) subscribedRef.current.delete(id)
          })
          .catch((err) => console.error('[SubscriptionManager] Unsubscribe failed:', err))
      }
      // 宽限期尚未到期的合约：等到期后再检查一次
      if (nextCheckIn !== null) {
        unsubTimerRef.current = setTimeout(runCheck, nextCheckIn)
      }
    }

    unsubTimerRef.current = setTimeout(runCheck, UNSUB_DEBOUNCE_MS)
  }, [calculateShouldSubscribe])

  // 可见区变化时：刷新可见合约的 lastVisibleTime，触发订阅与退订
  useEffect(() => {
    const now = Date.now()
    for (const id of visibleInstrumentIDs) {
      if (subscribedRef.current.has(id)) subscribedRef.current.set(id, now)
    }
    debouncedSubscribe()
    debouncedUnsubscribe()
    return () => {
      if (subTimerRef.current) clearTimeout(subTimerRef.current)
      if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
    }
  }, [visibleInstrumentIDs, debouncedSubscribe, debouncedUnsubscribe])

  return {
    subscribed: subscribedRef.current,
    applySubscriptionChanges: debouncedSubscribe,
  }
}
