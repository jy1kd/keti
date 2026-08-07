import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore } from '@/modules/market/store'
import { useContractsStore } from '@/stores/contracts'
import { subscribeMarket, unsubscribeMarket, getSnapshots } from '@/services/api'

/**
 * 延迟退订宽限期（毫秒）。
 * 从 30s 收紧到 10s：订阅集随滚动膨胀，拖多次后可能顶到 SOFT_LIMIT，
 * 更短的宽限期能更快释放滑出视野的合约，减缓膨胀。
 * 注意：宽限期长短不影响「拖动到底不刷新」——那由机制 7（滚动松手立即 diff）
 * + 拖动中零 HTTP 保证；滑回时重新订阅 + 快照回填仍秒出数据。
 */
const GRACE_MS = 10_000
/** 拖动检测窗口（毫秒） */
const DRAG_WINDOW_MS = 300
/** 窗口内变化次数阈值 → 视为拖动中 */
const DRAG_THRESHOLD = 2
/** 订阅软上限（< 后端 500） */
const SOFT_LIMIT = 480

export function useSubscriptionManager() {
  const visibleInstrumentIDs = useMarketStore((s) => s.visibleInstrumentIDs)
  const lockedContracts = useMarketStore((s) => s.lockedContracts)
  const favorites = useContractsStore((s) => s.favorites)
  const scrollEndSeq = useMarketStore((s) => s.scrollEndSeq)

  /** 已订阅合约 → 最近可见时间戳（ms） */
  const subscribedRef = useRef<Map<string, number>>(new Map())
  /** 宽限期到期重排定时器（由 runFullDiff 调度，到期再检查一次） */
  const unsubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 最近可见区变化时间戳（用于拖动检测） */
  const recentChangesRef = useRef<number[]>([])
  /** 是否已完成首次挂载（挂载本身不计入拖动变化，避免把首个可见窗口误判为拖动） */
  const didMountRef = useRef(false)
  /** 最近一次完整 diff 的定时器（拖动停止后执行） */
  const fullDiffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 已消费的滚动松手信号序号（判重，避免重复处理） */
  const lastHandledScrollEndRef = useRef(0)
  /** 始终指向最新 runFullDiff，避免重排定时器闭包捕获旧版本 */
  const runFullDiffRef = useRef<() => void>(() => {})

  const calculateShouldSubscribe = useCallback((): Set<string> => {
    const shouldSubscribe = new Set<string>()
    for (const id of visibleInstrumentIDs) shouldSubscribe.add(id)
    for (const fav of favorites) shouldSubscribe.add(fav.instrumentID)
    for (const id of lockedContracts.keys()) shouldSubscribe.add(id)
    return shouldSubscribe
  }, [visibleInstrumentIDs, favorites, lockedContracts])

  /**
   * LRU 上限保护（共享）：当 subscribedRef 超过 SOFT_LIMIT 时，返回最久未见且
   * 已不在 should（可见/自选/锁定）中的合约 ID，按 lastVisible 从旧到新淘汰。
   * extra 为「即将加入但尚未写入 subscribedRef」的订阅数（runFullDiff 用）；
   * 拖动路径订阅成功后 extra=0（新合约已写入）。
   * 语义：不减掉刚滑入/可见的合约；淘汰的是早已滑出且最久未见的低优先级合约，
   * 是拖动持续期间的必要的上限保护。仅计算候选，退订统一走 doUnsubscribe。
   */
  const computeLruEvictions = useCallback((should: Set<string>, extra = 0): string[] => {
    const over = subscribedRef.current.size + extra - SOFT_LIMIT
    if (over <= 0) return []

    const candidates: { id: string; lastVisible: number }[] = []
    for (const [id, lastVisible] of subscribedRef.current) {
      if (should.has(id)) continue // 跳过当前应订阅（可见/自选/锁定）
      candidates.push({ id, lastVisible })
    }
    candidates.sort((a, b) => a.lastVisible - b.lastVisible)
    return candidates.slice(0, over).map((c) => c.id)
  }, [])

  /** 退订并 success 门控：仅成功后从 subscribedRef 删除（失败保留，等待下次重试）；返回 Promise 供「退订先行」串行化 await 使用 */
  const doUnsubscribe = useCallback((ids: string[]): Promise<void> => {
    if (ids.length === 0) return Promise.resolve()
    return unsubscribeMarket(ids)
      .then((resp) => {
        if (resp?.success) {
          for (const id of ids) subscribedRef.current.delete(id)
        }
      })
      .catch((err) => console.error('[SubscriptionManager] Unsubscribe failed:', err))
  }, [])

  /** 方案 A：订阅成功后立即拉后端缓存快照填表，实时 tick 再覆盖；失败静默 */
  const prefetchSnapshots = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    getSnapshots(ids)
      .then(({ snapshots }) => {
        const snaps = Object.values(snapshots)
        if (snaps.length > 0) {
          useMarketStore.getState().batchUpdate(snaps)
        }
      })
      .catch(() => {
        // 静默：缓存回填失败不影响订阅，实时 tick 兜底
      })
  }, [])

  /** 是否处于拖动态：300ms 窗口内可见区变化 ≥ 2 次 */
  const isDragging = useCallback((): boolean => {
    const now = Date.now()
    recentChangesRef.current = recentChangesRef.current.filter((t) => now - t < DRAG_WINDOW_MS)
    return recentChangesRef.current.length >= DRAG_THRESHOLD
  }, [])

  /**
   * 完整 diff：subscribe + 宽限期退订 + LRU 淘汰。
   * 静止态直接调用，拖动停止后 500ms 调用。
   * 仍在宽限期内的合约记录 nextCheckIn，到期后再检查一次（保留到期重排链）。
   * 新批次超 SOFT_LIMIT 时「退订先行」串行化（await 退订后再订阅），规避后端 500 上限原子整批拒绝。
   */
  const runFullDiff = useCallback(() => {
    const should = calculateShouldSubscribe()
    const now = Date.now()

    // 1. 需要订阅的缺失合约
    const toSubscribe: string[] = []
    for (const id of should) {
      if (!subscribedRef.current.has(id)) toSubscribe.push(id)
    }

    // 2. 宽限期退订候选 + 记录最早到期时间（到期重排）
    const graceCandidates: { id: string; lastVisible: number }[] = []
    let nextCheckIn: number | null = null
    for (const [id, lastVisible] of subscribedRef.current) {
      if (should.has(id)) continue
      const elapsed = now - lastVisible
      graceCandidates.push({ id, lastVisible })
      if (elapsed <= GRACE_MS) {
        const remaining = GRACE_MS - elapsed + 1
        if (nextCheckIn === null || remaining < nextCheckIn) nextCheckIn = remaining
      }
    }

    // 3. 合并退订集：宽限期过期 + LRU 上限淘汰
    const toUnsubscribe = new Set<string>()
    for (const c of graceCandidates) {
      if (now - c.lastVisible > GRACE_MS) toUnsubscribe.add(c.id)
    }
    for (const id of computeLruEvictions(should, toSubscribe.length)) {
      toUnsubscribe.add(id)
    }
    const unsubscribeIds = Array.from(toUnsubscribe)

    // 4. 订阅动作（success 门控 + 快照回填），供串行化/并行共用
    const subscribeNow = (ids: string[]) => {
      if (ids.length === 0) return
      subscribeMarket(ids)
        .then((resp) => {
          if (resp?.success) {
            for (const id of ids) subscribedRef.current.set(id, Date.now())
            prefetchSnapshots(ids)
          }
        })
        .catch((err) => console.error('[SubscriptionManager] Subscribe failed:', err))
    }

    // 5. 退订先行（串行化兜底）：新批次会顶到 SOFT_LIMIT 时，
    //    先等退订（后端确认腾出名额）再订阅，规避后端 500 上限原子整批拒绝；
    //    平时（无需腾名额）订阅与退订并行，不加延迟
    const needRoom = subscribedRef.current.size + toSubscribe.length > SOFT_LIMIT
    if (needRoom && unsubscribeIds.length > 0) {
      doUnsubscribe(unsubscribeIds).then(() => subscribeNow(toSubscribe))
    } else {
      subscribeNow(toSubscribe)
      if (unsubscribeIds.length > 0) doUnsubscribe(unsubscribeIds)
    }

    // 6. 宽限期尚未到期的合约：等到期后再检查一次（到期重排链）
    if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
    unsubTimerRef.current = nextCheckIn !== null
      ? setTimeout(() => runFullDiffRef.current(), nextCheckIn)
      : null
  }, [calculateShouldSubscribe, computeLruEvictions, doUnsubscribe, prefetchSnapshots])

  runFullDiffRef.current = runFullDiff

  // 可见区变化时：刷新可见合约的 lastVisibleTime，按拖动态分流订阅/完整 diff
  useEffect(() => {
    // 滚动松手信号：跳过拖动态推断，立即完整 diff
    if (scrollEndSeq > lastHandledScrollEndRef.current) {
      lastHandledScrollEndRef.current = scrollEndSeq
      recentChangesRef.current = []  // 清除拖动历史，后续变化不再被误判为拖动态
      if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)  // 取消待定 500ms，避免重复 diff
      runFullDiff()
      return () => {
        if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
        if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
      }
    }

    const now = Date.now()
    if (didMountRef.current) {
      // 非首次：记录本次可见区变化，用于拖动检测
      recentChangesRef.current = [...recentChangesRef.current.filter((t) => now - t < DRAG_WINDOW_MS), now]
    } else {
      // 首次挂载：不计入拖动变化（避免把首个可见窗口误判为拖动，导致首次订阅被拖到停止后）
      didMountRef.current = true
    }
    for (const id of visibleInstrumentIDs) {
      if (subscribedRef.current.has(id)) subscribedRef.current.set(id, now)
    }

    if (isDragging()) {
      // 拖动中零 HTTP：不订阅不退订，只调度停止后的完整 diff
      if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
      fullDiffTimerRef.current = setTimeout(runFullDiff, 500)
    } else {
      // 静止态：直接完整 diff
      if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
      runFullDiff()
    }

    return () => {
      if (unsubTimerRef.current) clearTimeout(unsubTimerRef.current)
      if (fullDiffTimerRef.current) clearTimeout(fullDiffTimerRef.current)
    }
  }, [visibleInstrumentIDs, isDragging, runFullDiff, scrollEndSeq])

  return {
    subscribed: subscribedRef.current,
    applySubscriptionChanges: runFullDiff,
  }
}
