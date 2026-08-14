import { describe, it, expect, beforeEach } from 'vitest'
import { useUserPrefsStore, DEFAULT_HOT_KEYS } from './userPrefs'

const STORAGE_KEY = 'simnow-user-prefs'

describe('useUserPrefsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    // 重置 store 为默认值
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { ...DEFAULT_HOT_KEYS },
    })
  })

  it('初始状态：默认快捷键配置', () => {
    const { hotKeys } = useUserPrefsStore.getState()
    expect(hotKeys.buy).toBe('b')
    expect(hotKeys.sell).toBe('s')
    expect(hotKeys.cancel).toBe('c')
  })

  it('setHotKey 更新指定动作的快捷键', () => {
    useUserPrefsStore.getState().setHotKey('buy', 'F1')
    expect(useUserPrefsStore.getState().hotKeys.buy).toBe('F1')
  })

  it('saveToLocalStorage 持久化到 localStorage', () => {
    useUserPrefsStore.getState().setHotKey('buy', 'F1')
    useUserPrefsStore.getState().saveToLocalStorage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.hotKeys.buy).toBe('F1')
  })

  it('loadFromLocalStorage 从 localStorage 恢复状态', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hotKeys: { buy: 'F2', sell: 's', cancel: 'c' },
      })
    )

    useUserPrefsStore.getState().loadFromLocalStorage()

    const state = useUserPrefsStore.getState()
    expect(state.hotKeys.buy).toBe('F2')
  })

  it('loadFromLocalStorage localStorage 为空时保持默认值', () => {
    useUserPrefsStore.getState().loadFromLocalStorage()

    const state = useUserPrefsStore.getState()
    expect(state.hotKeys).toEqual(DEFAULT_HOT_KEYS)
  })
})

describe('useUserPrefsStore collections', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserPrefsStore.setState({
      collections: [],
      hotKeys: { ...DEFAULT_HOT_KEYS },
      quickTradeConfig: { lock: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, reverse: { close: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, open: { priceMode: 'counterparty', offsetTicks: 1, timeCondition: 'gfd' }, executionMode: 'serial' }, confirmBeforeExecute: true },
    })
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
      JSON.stringify({ selectedContracts: ['au2406', 'rb2406'], hotKeys: { buy: 'F2' } })
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
