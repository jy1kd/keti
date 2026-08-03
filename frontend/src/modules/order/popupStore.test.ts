import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderPopupStore } from './popupStore'

describe('useOrderPopupStore', () => {
  beforeEach(() => {
    useOrderPopupStore.setState({ instrumentID: null })
  })

  it('初始为关闭状态', () => {
    expect(useOrderPopupStore.getState().instrumentID).toBeNull()
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
})
