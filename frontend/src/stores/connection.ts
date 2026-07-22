import { create } from 'zustand'

/** 连接状态枚举 */
export type ConnectionPhase = 'disconnected' | 'connecting' | 'connected' | 'error'

/** 单个连接的详细状态 */
export interface ConnectionState {
  phase: ConnectionPhase
  /** 上次连接成功时间戳 */
  lastConnectedAt: number | null
  /** 上次断开时间戳 */
  lastDisconnectedAt: number | null
  /** 累计重连次数（断线后归零） */
  reconnectCount: number
  /** 错误信息（仅 error 状态） */
  error: string | null
}

interface ConnectionStore {
  md: ConnectionState
  td: ConnectionState
  setMdPhase: (phase: ConnectionPhase, error?: string) => void
  setTdPhase: (phase: ConnectionPhase, error?: string) => void
  setMdReconnectCount: (count: number) => void
  setTdReconnectCount: (count: number) => void
  /** 便捷访问（兼容旧代码） */
  mdConnected: boolean
  tdConnected: boolean
}

const now = () => Date.now()

function transitionState(
  prev: ConnectionState,
  phase: ConnectionPhase,
  error?: string,
): ConnectionState {
  const next: ConnectionState = { ...prev, phase, error: error ?? null }
  if (phase === 'connected') {
    next.lastConnectedAt = now()
    next.reconnectCount = 0
  } else if (phase === 'disconnected' || phase === 'error') {
    next.lastDisconnectedAt = now()
  }
  return next
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  md: {
    phase: 'disconnected',
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    reconnectCount: 0,
    error: null,
  },
  td: {
    phase: 'disconnected',
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    reconnectCount: 0,
    error: null,
  },
  mdConnected: false,
  tdConnected: false,

  setMdPhase: (phase, error) =>
    set((state) => {
      const md = transitionState(state.md, phase, error)
      return { md, mdConnected: phase === 'connected' }
    }),

  setTdPhase: (phase, error) =>
    set((state) => {
      const td = transitionState(state.td, phase, error)
      return { td, tdConnected: phase === 'connected' }
    }),

  setMdReconnectCount: (count) =>
    set((state) => ({ md: { ...state.md, reconnectCount: count } })),

  setTdReconnectCount: (count) =>
    set((state) => ({ td: { ...state.td, reconnectCount: count } })),
}))
