import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { subscribeMarket, unsubscribeMarket } from '@/services/api'

/** 订阅/退订防抖间隔（毫秒） */
const SUBSCRIPTION_DEBOUNCE_MS = 100

/**
 * 订阅管理器 Hook
 *
 * 实现按需订阅逻辑：
 * - 可见区域合约自动订阅
 * - 自选合约始终订阅
 * - 锁定合约永不退订
 *
 * 订阅公式：应该订阅 = 可见区域 + 自选合约 + 锁定合约
 * 退订公式：需要退订 = 已订阅 - 应该订阅
 */
export function useSubscriptionManager() {
  const visibleInstrumentIDs = useMarketStore((s) => s.visibleInstrumentIDs)
  const lockedContracts = useMarketStore((s) => s.lockedContracts)
  const favorites = useContractsStore((s) => s.favorites)

  // 当前已订阅的合约 ID 集合
  const subscribedRef = useRef<Set<string>>(new Set())
  // 防抖定时器
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 计算应该订阅的合约列表
   * 应该订阅 = 可见区域 + 自选合约 + 锁定合约
   */
  const calculateShouldSubscribe = useCallback((): Set<string> => {
    const shouldSubscribe = new Set<string>()

    // 添加可见区域合约
    for (const id of visibleInstrumentIDs) {
      shouldSubscribe.add(id)
    }

    // 添加自选合约
    for (const fav of favorites) {
      shouldSubscribe.add(fav.instrumentID)
    }

    // 添加锁定合约
    for (const id of lockedContracts.keys()) {
      shouldSubscribe.add(id)
    }

    return shouldSubscribe
  }, [visibleInstrumentIDs, favorites, lockedContracts])

  /**
   * 计算需要订阅和退订的合约
   */
  const calculateSubscriptionChanges = useCallback(() => {
    const shouldSubscribe = calculateShouldSubscribe()
    const currentlySubscribed = subscribedRef.current

    // 需要订阅 = 应该订阅 - 已订阅
    const toSubscribe: string[] = []
    for (const id of shouldSubscribe) {
      if (!currentlySubscribed.has(id)) {
        toSubscribe.push(id)
      }
    }

    // 需要退订 = 已订阅 - 应该订阅
    const toUnsubscribe: string[] = []
    for (const id of currentlySubscribed) {
      if (!shouldSubscribe.has(id)) {
        toUnsubscribe.push(id)
      }
    }

    return { toSubscribe, toUnsubscribe }
  }, [calculateShouldSubscribe])

  /**
   * 执行订阅/退订操作
   */
  const applySubscriptionChanges = useCallback(async () => {
    const { toSubscribe, toUnsubscribe } = calculateSubscriptionChanges()

    // 批量订阅
    if (toSubscribe.length > 0) {
      try {
        await subscribeMarket(toSubscribe)
        for (const id of toSubscribe) {
          subscribedRef.current.add(id)
        }
      } catch (err) {
        console.error('[SubscriptionManager] Subscribe failed:', err)
      }
    }

    // 批量退订
    if (toUnsubscribe.length > 0) {
      try {
        await unsubscribeMarket(toUnsubscribe)
        for (const id of toUnsubscribe) {
          subscribedRef.current.delete(id)
        }
      } catch (err) {
        console.error('[SubscriptionManager] Unsubscribe failed:', err)
      }
    }
  }, [calculateSubscriptionChanges])

  /**
   * 防抖执行订阅变更
   */
  const debouncedApply = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(applySubscriptionChanges, SUBSCRIPTION_DEBOUNCE_MS)
  }, [applySubscriptionChanges])

  // 当可见区域、自选合约或锁定合约变化时，执行订阅变更
  useEffect(() => {
    debouncedApply()
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [visibleInstrumentIDs, favorites, lockedContracts, debouncedApply])

  return {
    /** 当前已订阅的合约 ID 集合 */
    subscribed: subscribedRef.current,
    /** 手动触发订阅变更 */
    applySubscriptionChanges,
  }
}
