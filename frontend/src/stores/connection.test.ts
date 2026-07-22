import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './connection'

describe('useConnectionStore', () => {
  beforeEach(() => {
    // 每个测试前重置 store 状态
    useConnectionStore.setState({
      md: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      td: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      mdConnected: false,
      tdConnected: false,
    })
  })

  it('初始状态：md 和 td 均未连接', () => {
    const { md, td, mdConnected, tdConnected } = useConnectionStore.getState()
    expect(md.phase).toBe('disconnected')
    expect(td.phase).toBe('disconnected')
    expect(mdConnected).toBe(false)
    expect(tdConnected).toBe(false)
  })

  it('setMdPhase("connected") 更新 md 状态和 mdConnected', () => {
    useConnectionStore.getState().setMdPhase('connected')
    const { md, mdConnected } = useConnectionStore.getState()
    expect(md.phase).toBe('connected')
    expect(mdConnected).toBe(true)
    expect(md.lastConnectedAt).not.toBeNull()
    expect(md.reconnectCount).toBe(0)
  })

  it('setTdPhase("connected") 更新 td 状态和 tdConnected', () => {
    useConnectionStore.getState().setTdPhase('connected')
    const { td, tdConnected } = useConnectionStore.getState()
    expect(td.phase).toBe('connected')
    expect(tdConnected).toBe(true)
    expect(td.lastConnectedAt).not.toBeNull()
  })

  it('setMdPhase("disconnected") 可恢复为未连接', () => {
    useConnectionStore.getState().setMdPhase('connected')
    useConnectionStore.getState().setMdPhase('disconnected')
    const { md, mdConnected } = useConnectionStore.getState()
    expect(md.phase).toBe('disconnected')
    expect(mdConnected).toBe(false)
    expect(md.lastDisconnectedAt).not.toBeNull()
  })

  it('setMdPhase("error") 记录错误信息', () => {
    useConnectionStore.getState().setMdPhase('error', '连接超时')
    const { md, mdConnected } = useConnectionStore.getState()
    expect(md.phase).toBe('error')
    expect(mdConnected).toBe(false)
    expect(md.error).toBe('连接超时')
    expect(md.lastDisconnectedAt).not.toBeNull()
  })

  it('setMdReconnectCount 更新重连计数', () => {
    useConnectionStore.getState().setMdReconnectCount(3)
    expect(useConnectionStore.getState().md.reconnectCount).toBe(3)
  })
})
