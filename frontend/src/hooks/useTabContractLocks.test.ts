import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTabContractLocks } from './useTabContractLocks'
import { useTabStore } from '@/stores/tabs'
import { useMarketStore } from '@/modules/market/store'

function resetTabs() {
  useTabStore.setState({
    tabs: [{ id: 'tab-market', type: 'market', title: '📊 行情', props: {}, closable: false }],
    activeTabId: 'tab-market',
  })
}

function openTab(type: 'kline' | 'order' | 'settings', instrumentID?: string) {
  act(() => {
    useTabStore.getState().openTab({
      type,
      title: `${type}-${instrumentID ?? 'none'}`,
      props: instrumentID ? { instrumentID } : {},
    })
  })
}

function closeTabOfType(type: 'kline' | 'order') {
  const tab = useTabStore.getState().tabs.find((t) => t.type === type)
  if (!tab) throw new Error(`no tab of type ${type}`)
  act(() => {
    useTabStore.getState().closeTab(tab.id)
  })
}

describe('useTabContractLocks', () => {
  beforeEach(() => {
    resetTabs()
    useMarketStore.setState({ lockedContracts: new Map() })
  })

  it('kline 标签打开时锁定合约', () => {
    renderHook(() => useTabContractLocks())
    openTab('kline', 'IF2608')
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(true)
  })

  it('order 标签打开时锁定合约', () => {
    renderHook(() => useTabContractLocks())
    openTab('order', 'IF2608')
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(true)
  })

  it('非合约标签（settings）不锁定任何合约', () => {
    renderHook(() => useTabContractLocks())
    openTab('settings')
    expect(useMarketStore.getState().lockedContracts.size).toBe(0)
  })

  it('关闭 kline 标签后解锁合约', () => {
    renderHook(() => useTabContractLocks())
    openTab('kline', 'IF2608')
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(true)
    closeTabOfType('kline')
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(false)
  })

  it('保留其他来源（OrderPopup）的锁定，不误删', () => {
    renderHook(() => useTabContractLocks())
    act(() => {
      useMarketStore.getState().addLockedContract('AU2608')
    })
    openTab('kline', 'IF2608')
    const locked = useMarketStore.getState().lockedContracts
    expect(locked.has('IF2608')).toBe(true)
    expect(locked.has('AU2608')).toBe(true)
  })

  it('同合约被 OrderPopup + kline 标签同时锁定，关标签后仍锁定（引用计数）', () => {
    renderHook(() => useTabContractLocks())
    // OrderPopup 先锁定 IF2608
    act(() => {
      useMarketStore.getState().addLockedContract('IF2608')
    })
    // 再打开 IF2608 的 kline 标签（hook 会增加引用计数）
    openTab('kline', 'IF2608')
    expect(useMarketStore.getState().lockedContracts.get('IF2608')).toBe(2)
    // 关闭 kline 标签后 count 减为 1，合约仍锁定
    closeTabOfType('kline')
    expect(useMarketStore.getState().lockedContracts.get('IF2608')).toBe(1)
    // 再释放 OrderPopup 的锁定 → count 归零，合约解锁
    act(() => {
      useMarketStore.getState().removeLockedContract('IF2608')
    })
    expect(useMarketStore.getState().lockedContracts.has('IF2608')).toBe(false)
  })
})
