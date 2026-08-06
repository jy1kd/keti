import { create } from 'zustand'
import { useTabStore } from './tabs'

/** 浮动窗口顶部标题条高度（px），TabContent 浮动面板需下移该高度 */
export const FLOATING_CHROME_H = 32

/** 拖出标签时的默认窗口尺寸（钳制到视口） */
export function defaultFloatingSize(): { w: number; h: number } {
  const w = Math.round(Math.min(900, window.innerWidth * 0.9))
  const h = Math.round(Math.min(620, window.innerHeight * 0.8))
  return { w: Math.max(320, w), h: Math.max(200, h) }
}

export interface FloatingRect {
  x: number
  y: number
  w: number
  h: number
  z: number
}

interface FloatingWindowStore {
  /** 悬浮窗口：tabId → 几何信息 */
  windows: Record<string, FloatingRect>
  /** 非浮动窗口类弹窗（OrderPopup/QueryPopup）的 z 值：key → z */
  popupZ: Record<string, number>
  /** 悬浮一个标签；固定标签（closable:false）拒绝。返回是否成功 */
  detach: (tabId: string, rect: { x: number; y: number; w: number; h: number }) => boolean
  /** 停靠回标签栏（移除窗口登记） */
  dock: (tabId: string) => void
  /** 拖标题条移动窗口 */
  move: (tabId: string, pos: { x: number; y: number }) => void
  /** 缩放窗口（含移动，从任意边/角调整） */
  resize: (tabId: string, rect: { x: number; y: number; w: number; h: number }) => void
  /** 点击浮动窗口置顶（z 递增） */
  focus: (tabId: string) => void
  /** 通用置顶：任意弹窗（order/query 等）点击/打开时升到全局最高 z，返回新 z */
  bringToFront: (key: string) => number
}

let zCounter = 1400

export const useFloatingWindowStore = create<FloatingWindowStore>((set) => ({
  windows: {},
  popupZ: {},
  detach: (tabId, rect) => {
    const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
    if (!tab || !tab.closable) return false
    zCounter += 1
    set((s) => ({ windows: { ...s.windows, [tabId]: { ...rect, z: zCounter } } }))
    return true
  },
  dock: (tabId) => {
    set((s) => {
      // 未知标签视为 no-op，避免恒等新引用触发订阅者
      if (!(tabId in s.windows)) return s
      const rest = { ...s.windows }
      delete rest[tabId]
      return { windows: rest }
    })
  },
  move: (tabId, pos) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      return { windows: { ...s.windows, [tabId]: { ...cur, x: pos.x, y: pos.y } } }
    })
  },
  resize: (tabId, rect) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      return { windows: { ...s.windows, [tabId]: { ...cur, x: rect.x, y: rect.y, w: rect.w, h: rect.h } } }
    })
  },
  focus: (tabId) => {
    set((s) => {
      const cur = s.windows[tabId]
      if (!cur) return s
      zCounter += 1
      return { windows: { ...s.windows, [tabId]: { ...cur, z: zCounter } } }
    })
  },
  bringToFront: (key) => {
    zCounter += 1
    set((s) => ({ popupZ: { ...s.popupZ, [key]: zCounter } }))
    return zCounter
  },
}))
