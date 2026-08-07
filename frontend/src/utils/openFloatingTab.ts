import { useTabStore, generateTabId, type TabType } from '@/stores/tabs'
import { defaultFloatingSize } from '@/stores/floatingWindows'
import { detachTabAt } from './detachDrag'

interface OpenFloatingTabOptions {
  type: TabType
  title: string
  props?: Record<string, unknown>
  /** 浮动窗初始尺寸；缺省用 defaultFloatingSize() */
  size?: { w: number; h: number }
}

/** 报单浮动窗初始尺寸（对齐原 OrderPopup 弹窗：宽 540 固定、高按内容约 620） */
export const ORDER_FLOATING_SIZE = { w: 620, h: 540 }

/**
 * openFloatingTab — 打开标签页并立即脱离为浮动窗口（统一「弹窗」入口）
 *
 * 浮动窗口机制天然支持 标签页 ↔ 浮动窗口 双向转换（⇩ 停靠回标签栏 / 拖拽脱离），
 * 所有右上角入口统一走此函数：标签不进标签栏、以浮动窗形态弹出。
 * 返回 false 表示标签页数量达上限或脱离失败。
 */
export function openFloatingTab({ type, title, props = {}, size }: OpenFloatingTabOptions): boolean {
  const opened = useTabStore.getState().openTab({ type, title, props })
  if (!opened) return false

  const tabId = generateTabId(type, props)
  const { w, h } = size ?? defaultFloatingSize()
  const x = Math.max(0, Math.round((window.innerWidth - w) / 2))
  const y = Math.max(0, Math.round((window.innerHeight - h) / 2 - 20))
  return detachTabAt(tabId, { x, y }, size)
}
