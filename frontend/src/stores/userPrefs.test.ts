import { describe, it, expect, beforeEach } from 'vitest'
import { useUserPrefsStore, DEFAULT_HOT_KEYS } from './userPrefs'

const STORAGE_KEY = 'simnow-user-prefs'

describe('useUserPrefsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    // 重置 store 为默认值
    useUserPrefsStore.setState({
      selectedContracts: [],
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

  it('addSelectedContract 添加自选合约', () => {
    useUserPrefsStore.getState().addSelectedContract('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).toEqual(['au2406'])
  })

  it('addSelectedContract 重复添加不会产生重复项', () => {
    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().addSelectedContract('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).toEqual(['au2406'])
  })

  it('removeSelectedContract 移除自选合约', () => {
    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().addSelectedContract('rb2406')
    useUserPrefsStore.getState().removeSelectedContract('au2406')
    expect(useUserPrefsStore.getState().selectedContracts).toEqual(['rb2406'])
  })

  it('saveToLocalStorage 持久化到 localStorage', () => {
    useUserPrefsStore.getState().addSelectedContract('au2406')
    useUserPrefsStore.getState().setHotKey('buy', 'F1')
    useUserPrefsStore.getState().saveToLocalStorage()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.selectedContracts).toEqual(['au2406'])
    expect(stored.hotKeys.buy).toBe('F1')
  })

  it('loadFromLocalStorage 从 localStorage 恢复状态', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedContracts: ['rb2406'],
        hotKeys: { buy: 'F2', sell: 's', cancel: 'c' },
      })
    )

    useUserPrefsStore.getState().loadFromLocalStorage()

    const state = useUserPrefsStore.getState()
    expect(state.selectedContracts).toEqual(['rb2406'])
    expect(state.hotKeys.buy).toBe('F2')
  })

  it('loadFromLocalStorage localStorage 为空时保持默认值', () => {
    useUserPrefsStore.getState().loadFromLocalStorage()

    const state = useUserPrefsStore.getState()
    expect(state.selectedContracts).toEqual([])
    expect(state.hotKeys).toEqual(DEFAULT_HOT_KEYS)
  })
})
