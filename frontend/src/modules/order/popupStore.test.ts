import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderPopupStore } from './popupStore'

const STORAGE_KEY = 'simnow-order-popup'

describe('useOrderPopupStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useOrderPopupStore.setState({ instrumentID: null, expanded: false })
  })

  it('初始为关闭状态（精简态）', () => {
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
    expect(useOrderPopupStore.getState().expanded).toBe(false)
  })

  it('openPopup 打开弹窗并设置合约', () => {
    useOrderPopupStore.getState().openPopup('IF2608')
    expect(useOrderPopupStore.getState().instrumentID).toBe('IF2608')
  })

  it('closePopup 关闭弹窗', () => {
    useOrderPopupStore.getState().openPopup('IF2608')
    useOrderPopupStore.getState().closePopup()
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
  })

  it('弹窗已开时 openPopup 切换合约', () => {
    useOrderPopupStore.getState().openPopup('IF2608')
    useOrderPopupStore.getState().openPopup('AU2406')
    expect(useOrderPopupStore.getState().instrumentID).toBe('AU2406')
  })

  it('toggleExpanded 在精简/完整态间切换', () => {
    expect(useOrderPopupStore.getState().expanded).toBe(false)
    useOrderPopupStore.getState().toggleExpanded()
    expect(useOrderPopupStore.getState().expanded).toBe(true)
    useOrderPopupStore.getState().toggleExpanded()
    expect(useOrderPopupStore.getState().expanded).toBe(false)
  })

  it('setExpanded 显式展开 / 收起', () => {
    useOrderPopupStore.getState().setExpanded(true)
    expect(useOrderPopupStore.getState().expanded).toBe(true)
    useOrderPopupStore.getState().setExpanded(false)
    expect(useOrderPopupStore.getState().expanded).toBe(false)
  })

  it('展开状态持久化到 localStorage（partialize 仅 expanded，弹窗开关不跨会话）', () => {
    useOrderPopupStore.getState().setExpanded(true)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const data = JSON.parse(raw!)
    expect(data.state.expanded).toBe(true)
    // 仅持久化 expanded；instrumentID（弹窗开关）不跨会话恢复
    expect(data.state.instrumentID).toBeUndefined()
  })

  it('rehydrate 从 localStorage 恢复展开状态', async () => {
    useOrderPopupStore.setState({ expanded: false })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { expanded: true }, version: 0 }))
    await useOrderPopupStore.persist.rehydrate()
    expect(useOrderPopupStore.getState().expanded).toBe(true)
  })
})
