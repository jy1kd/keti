import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './connection'

describe('useConnectionStore', () => {
  beforeEach(() => {
    // 每个测试前重置 store 状态
    useConnectionStore.setState({ mdConnected: false, tdConnected: false })
  })

  it('初始状态：md 和 td 均未连接', () => {
    const { mdConnected, tdConnected } = useConnectionStore.getState()
    expect(mdConnected).toBe(false)
    expect(tdConnected).toBe(false)
  })

  it('setMdConnected(true) 更新 mdConnected', () => {
    useConnectionStore.getState().setMdConnected(true)
    expect(useConnectionStore.getState().mdConnected).toBe(true)
  })

  it('setTdConnected(true) 更新 tdConnected', () => {
    useConnectionStore.getState().setTdConnected(true)
    expect(useConnectionStore.getState().tdConnected).toBe(true)
  })

  it('setMdConnected(false) 可恢复为未连接', () => {
    useConnectionStore.getState().setMdConnected(true)
    useConnectionStore.getState().setMdConnected(false)
    expect(useConnectionStore.getState().mdConnected).toBe(false)
  })
})
