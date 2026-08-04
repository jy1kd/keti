import { describe, it, expect, beforeEach } from 'vitest'
import { useQueryPopupStore } from './popupStore'
import { useMarketStore } from '@/modules/market/store'

describe('useQueryPopupStore', () => {
  beforeEach(() => {
    useQueryPopupStore.setState({ isOpen: false })
    useMarketStore.setState({ selectedInstrument: null })
  })

  it('初始 isOpen 应为 false', () => {
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })

  it('open 应设置 isOpen 为 true', () => {
    useQueryPopupStore.getState().open()
    expect(useQueryPopupStore.getState().isOpen).toBe(true)
  })

  it('open 传入合约应设置全局选中合约并打开弹窗', () => {
    useQueryPopupStore.getState().open('IF2608')
    expect(useQueryPopupStore.getState().isOpen).toBe(true)
    expect(useMarketStore.getState().selectedInstrument).toBe('IF2608')
  })

  it('close 应设置 isOpen 为 false', () => {
    useQueryPopupStore.getState().open()
    useQueryPopupStore.getState().close()
    expect(useQueryPopupStore.getState().isOpen).toBe(false)
  })
})
