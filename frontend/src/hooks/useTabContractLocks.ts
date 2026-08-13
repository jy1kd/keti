import { useEffect, useRef } from 'react'
import { useTabStore } from '@/stores/tabs'
import { useMarketStore } from '@/modules/market/store'

/**
 * 需要锁定订阅的标签类型（打开标签的合约永不退订）
 */
const LOCKABLE_TAB_TYPES = new Set(['kline', 'order', 'infinite'])

/**
 * useTabContractLocks — 打开标签的合约锁定
 *
 * 将「打开标签（报单/K线）的合约」同步到 market store 的 lockedContracts，
 * 保证打开 K线/报单标签的合约即使滚动出行情表格视野也保持订阅——
 * 否则后端 kline_service 收不到该合约的 tick，K线标签将无数据。
 *
 * 设计依据：docs/specs/redesign-plan.md 3.5 锁定合约机制
 *   "📈 打开标签的合约（报单/K线窗口）永不退订"
 *
 * 与 useSubscriptionManager 配合：lockedContracts（Map<string, number> 引用计数）
 * 内的合约被加入订阅集合，归零自动解锁。
 *
 * 注意：lockedContracts 已改为引用计数（Map），
 * 本 hook 的 addLockedContract/removeLockedContract 与报单浮动窗等来源
 * 安全叠加——同合约被多方锁定时，仅当所有来源释放后才真正解锁。
 */
export function useTabContractLocks() {
  const tabs = useTabStore((s) => s.tabs)
  const prevRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const store = useMarketStore.getState()
    const { addLockedContract, removeLockedContract } = store

    // 收集当前所有打开标签（kline/order）中的合约
    const current = new Set<string>()
    for (const tab of tabs) {
      if (!LOCKABLE_TAB_TYPES.has(tab.type)) continue
      const id = tab.props?.instrumentID
      if (typeof id === 'string' && id) {
        current.add(id)
      }
    }

    // 新增标签 → 锁定
    for (const id of current) {
      if (!prevRef.current.has(id)) {
        addLockedContract(id)
      }
    }
    // 关闭标签 → 解锁（仅限本 hook 曾锁定的）
    for (const id of prevRef.current) {
      if (!current.has(id)) {
        removeLockedContract(id)
      }
    }

    prevRef.current = current
  }, [tabs])
}
