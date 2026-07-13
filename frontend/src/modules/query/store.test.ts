import { describe, it, expect } from 'vitest'
import { useQueryStore } from './store'

describe('QueryStore', () => {
  it('has empty activeTab by default', () => {
    expect(useQueryStore.getState().activeTab).toBe('orders')
  })

  it('sets active tab', () => {
    useQueryStore.getState().setActiveTab('trades')
    expect(useQueryStore.getState().activeTab).toBe('trades')
  })

  it('supports all tab values', () => {
    const tabs = ['orders', 'trades', 'positions', 'account'] as const
    for (const tab of tabs) {
      useQueryStore.getState().setActiveTab(tab)
      expect(useQueryStore.getState().activeTab).toBe(tab)
    }
  })
})
