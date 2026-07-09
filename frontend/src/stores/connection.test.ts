import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './connection'

describe('useConnectionStore', () => {
  beforeEach(() => {
    // 每个测试前重置 store 状态
    useConnectionStore.setState({ md_connected: false, td_connected: false })
  })

  it('初始状态：md 和 td 均未连接', () => {
    const { md_connected, td_connected } = useConnectionStore.getState()
    expect(md_connected).toBe(false)
    expect(td_connected).toBe(false)
  })

  it('setMdConnected(true) 更新 md_connected', () => {
    useConnectionStore.getState().setMdConnected(true)
    expect(useConnectionStore.getState().md_connected).toBe(true)
  })

  it('setTdConnected(true) 更新 td_connected', () => {
    useConnectionStore.getState().setTdConnected(true)
    expect(useConnectionStore.getState().td_connected).toBe(true)
  })

  it('setMdConnected(false) 可恢复为未连接', () => {
    useConnectionStore.getState().setMdConnected(true)
    useConnectionStore.getState().setMdConnected(false)
    expect(useConnectionStore.getState().md_connected).toBe(false)
  })
})
