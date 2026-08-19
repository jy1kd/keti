import { describe, it, expect, beforeEach } from 'vitest'
import { useUserPrefsStore, DEFAULT_HOT_KEYS, DEFAULT_ORDER_TRIGGER } from './userPrefs'

const STORAGE_KEY = 'simnow-user-prefs'

describe('useUserPrefsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { ...DEFAULT_HOT_KEYS },
      orderTrigger: { ...DEFAULT_ORDER_TRIGGER },
    })
  })

  it('初始状态：默认快捷键配置（4 个导航/批量撤单）', () => {
    const { hotKeys } = useUserPrefsStore.getState()
    expect(hotKeys.openOrder).toBe('o')
    expect(hotKeys.openKline).toBe('k')
    expect(hotKeys.openSettings).toBe(',')
    expect(hotKeys.batchCancel).toBe('Escape')
  })

  it('初始状态：默认下单触发 = 单击 + 二次确认', () => {
    const { orderTrigger } = useUserPrefsStore.getState()
    expect(orderTrigger).toEqual({ triggerMode: 'single', confirmBeforeOrder: true })
  })

  it('setHotKey 更新指定动作的快捷键', () => {
    useUserPrefsStore.getState().setHotKey('openOrder', 'F1')
    expect(useUserPrefsStore.getState().hotKeys.openOrder).toBe('F1')
  })

  it('saveToLocalStorage 持久化到 localStorage', () => {
    useUserPrefsStore.getState().setHotKey('openOrder', 'F1')
    useUserPrefsStore.getState().saveToLocalStorage()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.hotKeys.openOrder).toBe('F1')
  })

  it('setOrderTrigger 更新并持久化', () => {
    useUserPrefsStore.getState().setOrderTrigger({ triggerMode: 'double', confirmBeforeOrder: false })
    useUserPrefsStore.getState().saveToLocalStorage()
    expect(useUserPrefsStore.getState().orderTrigger).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.orderTrigger).toEqual({ triggerMode: 'double', confirmBeforeOrder: false })
  })

  it('loadFromLocalStorage 从 localStorage 恢复状态', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hotKeys: { openOrder: 'F2', openKline: 'k', openSettings: ',', batchCancel: 'Escape' } })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    const state = useUserPrefsStore.getState()
    expect(state.hotKeys.openOrder).toBe('F2')
  })

  it('loadFromLocalStorage localStorage 为空时保持默认值', () => {
    useUserPrefsStore.getState().loadFromLocalStorage()
    const state = useUserPrefsStore.getState()
    expect(state.hotKeys).toEqual(DEFAULT_HOT_KEYS)
    expect(state.orderTrigger).toEqual(DEFAULT_ORDER_TRIGGER)
  })
})

describe('useUserPrefsStore collections', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({ collections: [], hotKeys: { ...DEFAULT_HOT_KEYS }, orderTrigger: { ...DEFAULT_ORDER_TRIGGER } })
  })

  it('setCollections + saveToLocalStorage 持久化', () => {
    const coll = [{ id: 'coll-x', name: 'A', instrumentIDs: ['au2406'] }]
    useUserPrefsStore.getState().setCollections(coll)
    useUserPrefsStore.getState().saveToLocalStorage()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.collections).toEqual(coll)
  })

  it('loadFromLocalStorage 迁移：旧 selectedContracts → 默认收藏夹', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts: ['au2406', 'rb2406'], hotKeys: { openOrder: 'F2' } })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    expect(useUserPrefsStore.getState().collections).toEqual([
      { id: 'coll-default', name: '默认收藏夹', instrumentIDs: ['au2406', 'rb2406'] },
    ])
  })

  it('已有 collections 时不覆盖（无迁移）', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedContracts: ['au2406'], collections: [{ id: 'a', name: 'A', instrumentIDs: ['rb2406'] }] })
    )
    useUserPrefsStore.getState().loadFromLocalStorage()
    expect(useUserPrefsStore.getState().collections).toEqual([{ id: 'a', name: 'A', instrumentIDs: ['rb2406'] }])
  })
})
